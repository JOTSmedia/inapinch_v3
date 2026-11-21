import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFile(join(root,name),'utf8');
const cities=JSON.parse(await read('cities.json'));
const embedded={'cities.json':cities,'assets/key-west-map.json':JSON.parse(await read('assets/key-west-map.json'))};
for(const c of cities)embedded[`data/${c.id}.json`]=JSON.parse(await read(`data/${c.id}.json`));
// A file://-friendly copy of the actual app. All data and code are embedded;
// city artwork and Key West videos remain ordinary adjacent assets.
let html=await read('index.html');
for(const name of ['assets/maplibre-gl.css','assets/leaflet.css','assets/MarkerCluster.css','styles.css','map-theme.css','tropic-theme.css','ocean.css','city-theme.css']){
 html=html.replace(`<link rel="stylesheet" href="${name}">`,`<style>${await read(name)}</style>`);
}
for(const name of ['assets/leaflet.js','assets/leaflet.markercluster.js','assets/maplibre-gl.js','assets/leaflet-maplibre-gl.js']){
 const vendor=await read(name);
 html=html.replace(`<script src="${name}"></script>`,()=>`<script>${vendor.replace(/<\/script/gi,'<\\/script')}</script>`);
}
const modules=[
 ['logic','logic.js',[],['escapeHTML','normalize','distanceMiles','scheduleStatus','filterPlaces','directionsURL','isFoodVenue','businessListingURL','shouldLocateOnStart','preferredMapStyle']],
 ['cartography','cartography.js',[],['buildMapStyle','cartographicPalette']],
 ['venues','venue-data.js',['const {distanceMiles,normalize}=logic;'],['venueKind','placeFromFeature','mergeVenuePlaces','cachedVenues','saveVenues']],
 ['street','street-map.js',[],['addStreetMap']],
 ['vector','vector-map.js',['const {buildMapStyle,cartographicPalette}=cartography;const {venueKind}=venues;const {addStreetMap}=street;'],['addVectorMap']],
 ['island','island-map.js',['const {escapeHTML:e}=logic;'],['addIslandMap']],
 ['ocean','ocean.js',[],['createOcean']],
 ['ratings','ratings.js',[],['initRatings','ratingSummaryHTML','ratingPanelHTML','getRating']],
 ['guide','city-guide.js',['const {escapeHTML:e,normalize}=logic;'],['initCityGuide','nearestCity','applyCity']],
];
const compressed=gzipSync(JSON.stringify(embedded)).toString('base64');
let script=`const packed=Uint8Array.from(atob('${compressed}'),c=>c.charCodeAt(0));
const directory=JSON.parse(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
const nativeFetch=window.fetch.bind(window);
window.fetch=(url,options)=>{const key=String(url).replace(/^\\.\\//,'');return Object.hasOwn(directory,key)?Promise.resolve(new Response(JSON.stringify(directory[key]),{headers:{'content-type':'application/json'}})):nativeFetch(url,options);};\n`;

for(const [name,file,imports,exports] of modules){
 const code=(await read(file)).replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
 script+=`const ${name}=(()=>{${imports.join('\n')}\n${code}\nreturn {${exports.join(',')}};})();\n`;
}
let app=(await read('app.js')).replace(/^import .*;\n/gm,'');
script+=`const {escapeHTML:e,distanceMiles,scheduleStatus,filterPlaces,directionsURL,isFoodVenue,businessListingURL,shouldLocateOnStart,preferredMapStyle}=logic;const {addVectorMap}=vector;const {placeFromFeature,mergeVenuePlaces,cachedVenues,saveVenues}=venues;const {addStreetMap}=street;const {addIslandMap}=island;const {createOcean}=ocean;const {initRatings,ratingSummaryHTML,ratingPanelHTML,getRating}=ratings;const {initCityGuide,nearestCity,applyCity}=guide;\n${app}`;
html=html.replace('<script type="module" src="app.js"></script>',()=>`<script type="module">${script.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(join(root,'OPEN_ME.html'),html);
console.log('Built OPEN_ME.html for double-click preview. Production entry remains index.html.');
