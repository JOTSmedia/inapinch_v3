import {buildMapStyle,cartographicPalette} from './cartography.js';
import {venueKind} from './venue-data.js';
import {addStreetMap} from './street-map.js';
export function addVectorMap(map,L,city,status,onVenues=()=>{}) {
 if(!window.maplibregl||!L.maplibreGL)return addStreetMap(map,L,status);
 let layer,gl,disposed=false,fallback=false,seen=new Set(),loadingTimer;
 const fallbackToStreet=()=>{
  if(fallback||disposed)return;fallback=true;clearTimeout(loadingTimer);
  try{if(layer&&map.hasLayer(layer))map.removeLayer(layer);}catch{}
  document.body.dataset.mapRenderer='raster';addStreetMap(map,L,status);
  status.textContent='Vector styling is unavailable in this browser. Showing the standard street map.';status.hidden=false;
 };
 const style=()=>buildMapStyle(city,document.body.dataset.mapStyle||'wireframe');
 try{
  layer=L.maplibreGL({style:style(),interactive:false,attributionControl:false,padding:.1}).addTo(map);
  gl=layer.getMaplibreMap();document.body.dataset.mapRenderer='vector';
  map.attributionControl.addAttribution('© <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>');
  const palette=cartographicPalette(city);document.documentElement.style.setProperty('--cartographic-bg',palette.background);
  const updateStyle=()=>{if(!disposed&&!fallback)gl.setStyle(style());};
  document.addEventListener('mapstylechange',updateStyle);
  const discover=()=>{
   if(disposed||fallback||map.getZoom()<15||!gl.isSourceLoaded('openmaptiles'))return;
   try{
    const features=gl.querySourceFeatures('openmaptiles',{sourceLayer:'poi'});
    const fresh=[];
    for(const f of features){
     if(!venueKind(f.properties))continue;
     const key=String(f.id||'')+'|'+(f.properties?.name||'')+'|'+JSON.stringify(f.geometry?.coordinates);
     if(!seen.has(key)){seen.add(key);fresh.push(f);}
    }
    if(fresh.length)onVenues(fresh);
   }catch{}
  };
  gl.on('idle',()=>{if(!disposed&&!fallback){clearTimeout(loadingTimer);status.hidden=true;discover();}});
  loadingTimer=setTimeout(()=>{if(!disposed&&!fallback&&!gl.isSourceLoaded('openmaptiles'))fallbackToStreet();},15000);
  // A lost WebGL context can be recovered by the browser; a missing renderer
  // falls back to ordinary no-key street tiles instead of stopping the app.
  gl.on('webglcontextlost',fallbackToStreet);
  map.once('unload',()=>{disposed=true;clearTimeout(loadingTimer);document.removeEventListener('mapstylechange',updateStyle);});
  return layer;
 }catch{fallbackToStreet();return null;}
}
