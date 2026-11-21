// Minimal reader for the public Mapbox Vector Tile protobuf format.
// Used only to extract named public POI features, never private user data.
export function decodeTile(bytes) {
  const decoder=new TextDecoder();
  function fields(bytes){
    let pos=0;const out=[];
    const uint=()=>{let n=0,m=1,b;do{b=bytes[pos++];n+=(b&127)*m;m*=128;if(pos>bytes.length||m>2**63)throw Error('Invalid protobuf');}while(b&128);return n;};
    while(pos<bytes.length){const tag=uint(),number=Math.floor(tag/8),wire=tag&7;let value;
      if(wire===0)value=uint();else if(wire===2){const length=uint();value=bytes.subarray(pos,pos+length);pos+=length;}
      else if(wire===1){value=new DataView(bytes.buffer,bytes.byteOffset+pos,8).getFloat64(0,true);pos+=8;}
      else if(wire===5){value=new DataView(bytes.buffer,bytes.byteOffset+pos,4).getFloat32(0,true);pos+=4;}
      else throw Error('Unsupported protobuf wire type '+wire);
      out.push([number,value]);
    }return out;
  }
  function packed(bytes){let pos=0;const out=[];while(pos<bytes.length){let n=0,m=1,b;do{b=bytes[pos++];n+=(b&127)*m;m*=128;}while(b&128);out.push(n);}return out;}
  const text=b=>decoder.decode(b);const result={};
  for(const [field,raw] of fields(bytes)){
    if(field!==3)continue;
    const layerFields=fields(raw);const name=text(layerFields.find(([n])=>n===1)[1]);
    const keys=layerFields.filter(([n])=>n===3).map(([,b])=>text(b));
    const values=layerFields.filter(([n])=>n===4).map(([,b])=>{const [n,v]=fields(b)[0]||[];return n===1?text(v):n===7?!!v:n===6?(v%2?-(v+1)/2:v/2):v;});
    const extent=layerFields.find(([n])=>n===5)?.[1]||4096;const features=[];
    for(const [,rawFeature] of layerFields.filter(([n])=>n===2)){
      const f=fields(rawFeature);const id=f.find(([n])=>n===1)?.[1];const type=f.find(([n])=>n===3)?.[1];const tags=f.find(([n])=>n===2)?.[1];const properties={};
      if(tags){const t=packed(tags);for(let i=0;i<t.length;i+=2)properties[keys[t[i]]]=values[t[i+1]];}
      const geometry=packed(f.find(([n])=>n===4)?.[1]||new Uint8Array());
      const command=geometry[0]&7;
      const x=command===1?(geometry[1]%2?-(geometry[1]+1)/2:geometry[1]/2):null;
      const y=command===1?(geometry[2]%2?-(geometry[2]+1)/2:geometry[2]/2):null;
      features.push({id,type,x,y,properties,extent});
    }result[name]=features;
  }return result;
}
export function pointToCoordinates(x,y,z,tx,ty,extent=4096){
  const size=2**z;const lng=(tx+x/extent)/size*360-180;
  const lat=Math.atan(Math.sinh(Math.PI*(1-2*(ty+y/extent)/size)))*180/Math.PI;
  return {lat,lng};
}
