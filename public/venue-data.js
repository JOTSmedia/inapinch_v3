import {distanceMiles,normalize} from './logic.js';
const categories={restaurant:'Restaurant',bar:'Bar',pub:'Pub',beer:'Pub',biergarten:'Beer garden',cafe:'Café',fast_food:'Fast food',food_court:'Food hall',nightclub:'Nightclub',toilets:'Mapped restroom'};
export function venueKind(properties={}){return [properties.subclass,properties.class].find(k=>Object.hasOwn(categories,k))||null;}
export function placeFromFeature(feature,city){
 const p=feature.properties||{},kind=venueKind(p),name=p['name:latin']||p.name;
 if(!kind||feature.geometry?.type!=='Point'||(!name&&kind!=='toilets'))return null;
 const [lng,lat]=feature.geometry.coordinates;
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||distanceMiles({lat,lng},city)>45)return null;
 const restroom=kind==='toilets';const id=feature.id?`${city.id}-poi-${feature.id}`:`${city.id}-poi-${normalize(name||kind).replaceAll(' ','-')}-${lat.toFixed(5)}-${lng.toFixed(5)}`;
 return {id,cityId:city.id,timezone:city.timezone,name:name||'Mapped restroom',category:categories[kind],neighborhood:city.name+' area',address:'Street address not supplied by the map source',addressKnown:false,lat,lng,coordinateAccuracy:'mapped-point',access:'unknown',accessNote:'Bathroom access, fees and any purchase requirement are not documented. Ask staff.',bathroomConfirmed:restroom,accessible:null,changingTable:null,purchaseLikely:!restroom,priority:restroom?40:60,evidenceType:'vector-poi',dynamicListing:true,note:restroom?'Community-mapped restroom point. Hours, access and accessibility remain unverified.':'Mapped business location. A customer bathroom may be available, but bathroom access has not been confirmed. Ask staff before relying on this stop.',checkedLabel:'Community map data · access unverified',sources:[{label:'Inspect this mapped location',url:`https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=19/${lat.toFixed(6)}/${lng.toFixed(6)}`},{label:'Map data provider',url:'https://openfreemap.org/'}]};
}
export function mergeVenuePlaces(existing,candidates){
 const ids=new Set(existing.map(p=>p.id));const names=new Map();
 for(const p of existing){const key=normalize(p.name);if(!names.has(key))names.set(key,[]);names.get(key).push(p);}
 const added=[];
 for(const p of candidates){
  if(!p||ids.has(p.id))continue;
  const key=normalize(p.name);
  if((names.get(key)||[]).some(other=>distanceMiles(other,p)<.028))continue;
  ids.add(p.id);if(!names.has(key))names.set(key,[]);names.get(key).push(p);added.push(p);
 }return added;
}
let cachePromise;
function openCache(){
 if(!('indexedDB'in globalThis))return Promise.resolve(null);
 if(!cachePromise)cachePromise=new Promise(resolve=>{
  const request=indexedDB.open('in-a-pinch-v3-venue-cache',1);
  request.onupgradeneeded=()=>{const db=request.result;const store=db.createObjectStore('venues',{keyPath:'id'});store.createIndex('city','cityId');};
  request.onerror=()=>resolve(null);request.onsuccess=()=>resolve(request.result);
 });return cachePromise;
}
export async function cachedVenues(cityId){
 try{const db=await openCache();if(!db)return [];return await new Promise(resolve=>{const r=db.transaction('venues').objectStore('venues').index('city').getAll(cityId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve([]);});}catch{return [];}
}
export async function saveVenues(places){
 try{const db=await openCache();if(!db)return;await new Promise(resolve=>{const tx=db.transaction('venues','readwrite');for(const p of places)tx.objectStore('venues').put(p);tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();});}catch{}
}
