import {escapeHTML as e, distanceMiles, scheduleStatus, filterPlaces, directionsURL, isFoodVenue, businessListingURL, shouldLocateOnStart, preferredMapStyle} from './logic.js';
import {initCityGuide, nearestCity, applyCity} from './city-guide.js';
import {addVectorMap} from './vector-map.js';
import {placeFromFeature,mergeVenuePlaces,cachedVenues,saveVenues} from './venue-data.js';
import {addStreetMap} from './street-map.js';
import {addIslandMap} from './island-map.js';
import {createOcean} from './ocean.js';
import {initRatings,ratingSummaryHTML,ratingPanelHTML,getRating} from './ratings.js';

const $ = id => document.getElementById(id);
const icon = (name, cls='') => {
  const shapes = {
    bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    walk:'<circle cx="14" cy="4" r="2"/><path d="m7 11 4-4 4 3 4 1M10 16l-3 6m5-10-2 4 5 2 2 4M11 7l1 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    share:'<path d="M12 16V3m-5 5 5-5 5 5M5 14v7h14v-7"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    access:'<circle cx="12" cy="4" r="2"/><path d="M11 8v6h6l3 6M11 10l5 1M8 11a6 6 0 1 0 7 9"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    source:'<path d="M14 3h7v7m-1-6-10 10M10 4H4v16h16v-6"/>',
    toilet:'<path d="M5 3h6v8H5zM5 11h15c0 5-3 7-7 7H9c-3 0-4-3-4-7Zm5 7v3h6v-4M18 8v3"/>',
  };
  return `<svg class="ui-icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.pin}</svg>`;
};

let places = [];
let city;
let cityGuide;
let cityRevision=0;
let positionAccuracy=0;
let resultRanks=new Map();
let placeIndex=new Map();
let visibleLimit=60;
let discoveryTimer;
let pendingDiscovered=[];
let mapObserver;
let meta = {};
let map;
let markerLayer;
let userMarker;
let userCircle;
let position = null;
let selectedId = null;
let savedOnly = false;
let locating = false;
let filters = new Set();
let markers = new Map();
let view = 'map';
let toastTimeout;
let lastDetailTrigger;
let saved = new Set();
try {
  const value = JSON.parse(localStorage.getItem('in-a-pinch:saved') || '[]');
  if (Array.isArray(value)) saved = new Set(value.filter(x => typeof x === 'string').slice(0,500));
} catch { /* The map also works when browser storage is unavailable. */ }

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  $('toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('toast').classList.remove('visible'); $('toast').hidden = true; }, 4300);
}

const accessLabel = p => ({public:'Free & public',paid:'Admission required',customers:'Purchase likely',unknown:'Check access'})[p.access] || 'Check access';
const accessClass = p => p.access === 'public' ? 'free' : p.access === 'paid' ? 'paid' : 'unknown';
const shortDistance = p => {
  if (!position) return '';
  const mi = distanceMiles(position,p);
  return mi < .1 ? `${Math.max(20,Math.round(mi*5280/20)*20)} ft` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()} mi`;
};

function getResults() {
  const results = filterPlaces(places,{query:$('search-input').value,filters,savedOnly,saved});
  const sort = $('sort-select').value;
  if (sort === 'name') results.sort((a,b) => a.name.localeCompare(b.name));
  else if (sort === 'rating') results.sort((a,b) => (getRating(b.id).average ?? -1)-(getRating(a.id).average ?? -1) || getRating(b.id).count-getRating(a.id).count || a.name.localeCompare(b.name));
  else if (sort === 'distance' && position) results.sort((a,b) => distanceMiles(position,a)-distanceMiles(position,b));
  else results.sort((a,b) => (a.access === 'public' ? 0:1)-(b.access === 'public' ? 0:1) || (a.priority ?? 50)-(b.priority ?? 50) || a.name.localeCompare(b.name));
  return results;
}

function render({fit=false}={}) {
  if(placeIndex.size!==places.length)placeIndex=new Map(places.map(p=>[p.id,p]));
  const results = getResults();
  resultRanks=new Map(results.map((p,i)=>[p.id,i+1]));
  $('result-count').textContent = `${results.length} ${results.length === 1 ? 'mapped stop' : 'mapped stops'}`;
  if ($('map-count')) $('map-count').textContent = `${city?.name || 'Your city'} · ${results.length} stops`;
  if ($('total-count')) $('total-count').textContent = `${places.length} mapped stops`;
  document.querySelectorAll('#filters [data-filter]').forEach(button => {
    const active = button.dataset.filter === 'all' ? filters.size === 0 : filters.has(button.dataset.filter);
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if ($('saved-btn')) {
    $('saved-btn').classList.toggle('active',savedOnly);
    $('saved-btn').setAttribute('aria-pressed',String(savedOnly));
    $('saved-btn').setAttribute('aria-label',`${savedOnly?'Show all places':'Show saved places'}${saved.size?` (${saved.size} saved)`:''}`);
    $('saved-btn').innerHTML = `${icon('bookmark')}${saved.size ? `<span class="saved-count">${saved.size}</span>`:''}`;
  }
  if (selectedId && !results.some(p => p.id === selectedId)) closeDetail(false);
  $('result-list').innerHTML = results.length ? results.slice(0,visibleLimit).map(p => {
    const status = scheduleStatus(p);
    return `<article class="result-card ${p.id === selectedId ? 'selected':''}" data-place="${e(p.id)}">
      <div class="card-topline"><span class="place-category"><b class="result-rank">${resultRanks.get(p.id)}</b>${e(p.category)} <span class="category-separator">·</span> ${e(p.neighborhood)}</span><button class="save-btn ${saved.has(p.id)?'is-saved':''}" data-save="${e(p.id)}" aria-label="${saved.has(p.id)?'Unsave':'Save'} ${e(p.name)}" aria-pressed="${saved.has(p.id)}">${icon('bookmark')}</button></div>
      <button class="card-main" data-select="${e(p.id)}" aria-label="View ${e(p.name)} details"><h3 class="place-name">${e(p.name)}</h3><p class="place-address">${e(p.address)}</p></button>
      <div class="card-tags"><span class="tag tag-${accessClass(p)}">${e(accessLabel(p))}</span>${p.bathroomConfirmed===false?'<span class="tag tag-unconfirmed">Bathroom unconfirmed</span>':''}${p.accessible === true ? `<span class="tag tag-accessible">${icon('access')}Accessible WC</span>`:''}</div>
      ${isFoodVenue(p)?`<a class="business-listing-link" href="${e(businessListingURL(p,city))}" target="_blank" rel="noopener" aria-label="Find ${e(p.name)} on Google Maps">${icon('source')}View on Google Maps</a>`:''}
      ${p.dynamicListing?'<p class="discovered-venue-note">Discovered on the map · access unverified</p>':ratingSummaryHTML(p.id)}
      <div class="card-bottom"><span class="hours-label status-${status.state}">${icon('clock')}${e(status.label)}</span>${position?`<span class="distance-label" title="Straight-line distance, not a walking route">${shortDistance(p)} away</span>`:`<button class="card-detail-link" data-select="${e(p.id)}" aria-label="More details about ${e(p.name)}">Details</button>`}</div>
    </article>`;
  }).join('')+(results.length>visibleLimit?`<button type="button" class="load-more-venues" data-more-venues>Show 60 more places <span>${Math.min(visibleLimit,results.length)} of ${results.length}</span></button>`:'') : `<div class="empty-state">${icon(savedOnly?'bookmark':'pin')}<h3>${savedOnly ? 'Your next favorite pit stop.' : 'No stops match just yet.'}</h3><p>${savedOnly ? 'Tap a bookmark on any bathroom to save it on this device. Saved places still follow your search and filters.' : filters.has('open') ? 'Only published restroom hours qualify. Unknown hours are excluded. Try removing a filter or search term.' : filters.has('accessible') ? 'This filter only includes specifically documented accessible restrooms. Other places may be accessible; their details are not confirmed.' : 'Try a different place name, neighborhood, or a broader set of filters.'}</p><button class="secondary-action" data-clear>Show all bathrooms</button></div>`;
  updateMarkers(results);
  if (fit && results.length && map) fitResults(results);
  if ($('filter-note')) $('filter-note').textContent = filters.has('open') ? `Published hours · ${city?.name || 'City'} local time · not live availability` : position ? 'Distances are straight-line estimates, not walking routes.' : 'Public facilities first. Tap a stop for access details.';
}

function pinIcon(place) {
  const access=place.access==='public'?'public':place.access==='paid'?'paid':'unknown';
  const rank=resultRanks.get(place.id)||'';
  return window.L.divIcon({className:'pin-wrapper',html:`<div class="map-pin ${access} ${selectedId===place.id?'selected':''}"><span class="pin-pictogram">${icon('toilet')}</span><span class="pin-rank">${rank}</span><span class="pin-access-mark" aria-hidden="true">${access==='public'?'✓':access==='paid'?'$':'?'}</span></div>`,iconSize:[44,54],iconAnchor:[22,49],tooltipAnchor:[0,-44]});
}

function updateMarkers(results) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  markers.clear();
  results.forEach(place => {
    const marker = window.L.marker([place.lat,place.lng],{icon:pinIcon(place),title:place.name,alt:place.name,keyboard:true,riseOnHover:true,zIndexOffset:selectedId===place.id?500:0});
    marker.bindTooltip(`<strong>${e(place.name)}</strong><span>${e(accessLabel(place))}</span>`,{className:'place-tooltip',direction:'top',offset:[0,-4],permanent:selectedId===place.id,opacity:1});
    marker.on('click',()=>openDetail(place.id,{fromMap:true}));
    markerLayer.addLayer(marker);
    markers.set(place.id,marker);
  });
}

function fitResults(results=places) {
  if (!map || !results.length) return;
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const mobileTop = Math.min(document.querySelector('.sidebar').getBoundingClientRect().bottom - document.querySelector('.workspace').getBoundingClientRect().top + 62, map.getSize().y * .48);
  map.fitBounds(window.L.latLngBounds(results.map(p=>[p.lat,p.lng])),{paddingTopLeft:[mobile?35:70,mobile?mobileTop:85],paddingBottomRight:[mobile?35:70,mobile?115:85],maxZoom:15,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});
}

async function initializeMap() {
  if (!window.L) {
    $('map-status').hidden = false;
    $('map-status').textContent = 'The map could not load. All bathroom details and directions are available in the list.';
    setView('list');
    return;
  }
  const L = window.L;
  map = L.map('map',{zoomControl:false,minZoom:3,maxZoom:19,zoomSnap:.5,scrollWheelZoom:true,attributionControl:true,...(city.id==='key-west'?{maxBounds:[[24.51,-81.855],[24.615,-81.705]],maxBoundsViscosity:.9}:{})});
  map.attributionControl.setPrefix(false);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.control.scale({imperial:true,metric:false,position:'bottomleft',maxWidth:100}).addTo(map);
  fitResults();
  try{
    const revision=cityRevision;
    addVectorMap(map,L,city,$('map-status'),features=>{if(revision===cityRevision)queueDiscovered(features);});
    $('map-status').hidden=true;
  }catch(error){
    addStreetMap(map,L,$('map-status'));
    console.warn('Using street-map fallback:',error.message);
  }
  markerLayer = L.markerClusterGroup ? L.markerClusterGroup({maxClusterRadius:38,disableClusteringAtZoom:17,showCoverageOnHover:false,spiderfyOnMaxZoom:true,iconCreateFunction:cluster=>L.divIcon({html:`<span>${cluster.getChildCount()}</span>`,className:'pin-cluster',iconSize:[44,44]})}) : L.layerGroup();
  markerLayer.addTo(map);
  fitResults();
  mapObserver?.disconnect();
  mapObserver=new ResizeObserver(()=>map?.invalidateSize({pan:false}));
  mapObserver.observe($('map'));
}

function renderDetails(place) {
  const status = scheduleStatus(place);
  const coordinateText = place.coordinateAccuracy === 'restroom' ? 'Pin marks a mapped restroom location. Follow signs for the entrance.' : 'Pin marks the facility area, not a surveyed restroom entrance. Follow signs or ask staff on arrival.';
  $('detail-content').innerHTML = `<div class="detail-header"><span class="place-category">${e(place.category)} · ${e(place.neighborhood)}</span><div class="detail-symbol">${icon('toilet')}</div><h2 id="detail-title" class="detail-title">${e(place.name)}</h2><p class="place-address">${icon('pin')}${e(place.address)}</p><div class="card-tags"><span class="tag tag-${accessClass(place)}">${e(accessLabel(place))}</span><span class="tag tag-${status.state}">${e(status.label)}</span></div></div>
    <div class="detail-actions">${isFoodVenue(place)?`<a class="business-listing-action" href="${e(businessListingURL(place,city))}" target="_blank" rel="noopener">${icon('source')}View ${e(place.name)} on Google Maps</a>`:''}<a class="primary-action" href="${e(directionsURL(place))}" target="_blank" rel="noopener">${icon('walk')}Walking directions</a><div class="detail-secondary-actions"><button class="secondary-action ${saved.has(place.id)?'is-saved':''}" data-save="${e(place.id)}">${icon('bookmark')}${saved.has(place.id)?'Saved':'Save this stop'}</button><button class="secondary-action" data-share="${e(place.id)}">${icon('share')}Share</button></div><p class="directions-note">Opens Google Maps. ${position?`${shortDistance(place)} away in a straight line.`:'Your starting point is selected in Maps.'}</p></div>
    ${place.dynamicListing?'<section class="detail-section"><h3>Discovered from the map</h3><p>This place was found while exploring. Shared ratings become available after it is included in a published directory snapshot.</p></section>':ratingPanelHTML(place.id)}
    <section class="detail-section"><h3>Before you go</h3>${place.bathroomConfirmed===false?'<p class="detail-unconfirmed">Venue listing · Bathroom not yet confirmed</p>':''}<p>${e(place.note)}</p><dl class="detail-meta"><div><dt>Access</dt><dd>${e(place.accessNote || accessLabel(place))}</dd></div><div><dt>Restroom hours</dt><dd>${e(place.hours?.label || 'Not confirmed. Check the source or ask on arrival.')}</dd></div>${place.venueHours?`<div><dt>Venue hours</dt><dd>${e(place.venueHours)}<small>Venue hours do not confirm restroom availability.</small></dd></div>`:''}<div><dt>Wheelchair access</dt><dd>${e(place.accessibilityNote || (place.accessible === true ? 'Accessible restrooms listed by the source.' : 'Restroom accessibility not confirmed.'))}</dd></div><div><dt>Changing table</dt><dd>${place.changingTable === true ? 'Listed by the source.' : 'Not confirmed.'}</dd></div></dl></section>
    <section class="detail-section location-accuracy">${icon('info')}<p>${e(coordinateText)} ${place.hours?.scope === 'restroom' ? `Schedule status uses ${e(city.name)} local time; temporary closures are not monitored.` : ''}</p></section>
    <section class="detail-section"><h3>From the source</h3><p class="source-intro">${place.evidenceType==='osm-venue'?'OpenStreetMap venue listing. Bathroom availability and purchase rules have not been confirmed by the venue.':place.evidenceType==='osm'?'Community-mapped listing. Access and facilities may need confirmation.':place.evidenceType==='vector-poi'?'A community-mapped point of interest. A business pin does not establish bathroom access; mapped restroom points may have unknown public access.':place.evidenceType==='venue-lead'?'Venue reference only. This source has not yet been verified for bathroom availability.':'Published facility information. Check with the operator for changes.'}</p><div class="source-links">${place.sources.map(source=>`<a class="source-link" href="${e(source.url)}" target="_blank" rel="noopener">${e(source.label)}${icon('source')}</a>`).join('')}</div><p class="source-checked">Directory reference: ${e(place.checkedLabel || meta.checkedLabel || 'November 2026')}. Community ratings describe past visits; current availability is not monitored.</p></section>`;
}

function openDetail(id,{fromMap=false,fromLink=false}={}) {
  const place=placeIndex.get(id);
  if(!place)return;
  lastDetailTrigger=document.activeElement;
  selectedId=id;
  $('detail-panel').hidden=false;
  $('detail-panel').classList.add('is-open');
  $('detail-panel').setAttribute('aria-hidden','false');
  $('detail-panel').setAttribute('aria-labelledby','detail-title');
  $('app').classList.add('detail-open');
  renderDetails(place);
  if(fromMap)setView('map');
  document.querySelectorAll('.result-card').forEach(card=>card.classList.toggle('selected',card.dataset.place===id));
  markers.forEach((marker,markerId)=>{ const p=places.find(x=>x.id===markerId); marker.setIcon(pinIcon(p)); marker.setZIndexOffset(markerId===id?500:0); });
  if(map && !fromMap){
    const marker=markers.get(id);
    const focus=()=>{
      const zoom=Math.max(map.getZoom(),16);
      map.setView([place.lat,place.lng],zoom,{animate:false});
      if(window.innerWidth>1000)map.panBy([180,0],{animate:false});
    };
    if(marker && markerLayer.zoomToShowLayer)markerLayer.zoomToShowLayer(marker,focus);else focus();
  }
  const url=new URL(location.href);url.searchParams.set('city',city.id);url.searchParams.set('spot',id);history.replaceState(null,'',url);
  $('detail-panel').scrollTop=0;
  if(!fromLink)$('detail-close').focus({preventScroll:true});
}

function closeDetail(restoreFocus=true) {
  selectedId=null;
  $('detail-panel').hidden=true;
  $('detail-panel').classList.remove('is-open');
  $('detail-panel').setAttribute('aria-hidden','true');
  $('app').classList.remove('detail-open');
  document.querySelectorAll('.result-card.selected').forEach(c=>c.classList.remove('selected'));
  markers.forEach((marker,id)=>marker.setIcon(pinIcon(placeIndex.get(id))));
  const url=new URL(location.href);url.searchParams.delete('spot');history.replaceState(null,'',url);
  if(restoreFocus && lastDetailTrigger?.isConnected)lastDetailTrigger.focus({preventScroll:true});
}

function toggleSaved(id) {
  const inDetail=$('detail-content').contains(document.activeElement);
  saved.has(id)?saved.delete(id):saved.add(id);
  let persisted=true;
  try{localStorage.setItem('in-a-pinch:saved',JSON.stringify([...saved]));}catch{persisted=false;}
  render();
  if(selectedId===id)renderDetails(placeIndex.get(id));
  const replacement=(inDetail?$('detail-content'):$('result-list')).querySelector(`[data-save="${CSS.escape(id)}"]`);
  if(replacement)replacement.focus({preventScroll:true});else $('saved-btn').focus({preventScroll:true});
  toast(saved.has(id)?persisted?'Saved on this device.':'Saved for this session. Browser storage is unavailable.':'Removed from your saved spots.');
}

async function sharePlace(id) {
  const place=placeIndex.get(id);
  const url=new URL(location.href);url.searchParams.set('city',city.id);url.searchParams.set('spot',id);
  if(place.dynamicListing)url.searchParams.set('near',`${place.lat},${place.lng}`);
  try{
    if(navigator.share)await navigator.share({title:`${place.name} · IN A PINCH`,text:'when you gotta go, you gotta go',url:url.href});
    else {await navigator.clipboard.writeText(url.href);toast('Bathroom link copied.');}
  }catch(error){
    if(error.name==='AbortError')return;
    toast('Copy the address from your browser to share this stop.');
  }
}

function setView(next) {
  view=next;
  $('app').dataset.view=next;
  $('app').classList.toggle('view-list',next==='list');
  $('app').classList.toggle('view-map',next==='map');
  $('map-view-btn').classList.toggle('active',next==='map');
  $('list-view-btn').classList.toggle('active',next==='list');
  $('map-view-btn').setAttribute('aria-pressed',String(next==='map'));
  $('list-view-btn').setAttribute('aria-pressed',String(next==='list'));
  if(map)requestAnimationFrame(()=>map.invalidateSize({pan:false}));
}

function drawPosition({focus=false}={}) {
  if(!map||!position)return;
  if(userMarker)map.removeLayer(userMarker);
  if(userCircle)map.removeLayer(userCircle);
  userMarker=null;userCircle=null;
  if(distanceMiles(position,city)>45)return;
  userMarker=window.L.marker([position.lat,position.lng],{icon:window.L.divIcon({className:'user-location-marker',html:'<span class="user-location-halo"></span><span class="user-location-dot"></span>',iconSize:[24,24],iconAnchor:[12,12]}),title:'Your approximate location',zIndexOffset:1500}).addTo(map);
  userMarker.bindTooltip('You are here',{direction:'top',offset:[0,-13]});
  userCircle=window.L.circle([position.lat,position.lng],{radius:Math.max(10,Math.min(positionAccuracy,2000)),color:'#40dceb',fillOpacity:.08,weight:1,interactive:false}).addTo(map);
  if(focus){
    const nearby=getResults().slice(0,3);
    map.fitBounds(window.L.latLngBounds([[position.lat,position.lng],...nearby.map(p=>[p.lat,p.lng])]),{padding:[65,100],maxZoom:17});
  }
}

function locate({auto=false}={}) {
  if(locating)return;
  if(!navigator.geolocation){$('location-status').textContent='Location unavailable. Choose any of the 24 mapped cities.';return;}
  const revision=cityRevision;
  locating=true;$('locate-btn').disabled=true;$('locate-btn').setAttribute('aria-busy','true');
  $('location-status').textContent=auto?'Finding your city and nearby stops…':'Waiting for your location…';
  const finish=()=>{locating=false;$('locate-btn').disabled=false;$('locate-btn').removeAttribute('aria-busy');};
  navigator.geolocation.getCurrentPosition(async result=>{
    position={lat:result.coords.latitude,lng:result.coords.longitude};positionAccuracy=result.coords.accuracy;
    // A slow permission prompt must not override a city chosen in the meantime.
    if(auto&&revision!==cityRevision){finish();render();drawPosition();return;}
    try{
      const closest=nearestCity(position);
      const nearby=closest&&distanceMiles(position,closest)<=45;
      if(nearby&&closest.id!==city.id)await cityGuide.select(closest.id);
      $('sort-select').value='distance';render();drawPosition({focus:true});
      $('location-status').textContent=nearby
        ?`Near you · ${city.name} · accuracy about ${Math.max(1,Math.round(positionAccuracy*3.28084))} ft`
        :'Your location is outside the 24 mapped metro areas. Choose a city to explore; distances are from you.';
      if(!auto){const results=getResults();toast(nearby&&results.length?`Closest match: ${results[0].name}. Check its access and hours.`:'No mapped city is near your current location. All 24 cities remain selectable.');}
    }catch(error){toast('Could not load your nearest city. Choose a city manually.');}
    finally{finish();}
  },error=>{
    finish();
    if(auto&&revision!==cityRevision)return;
    const message=error.code===1?'Location is off. Choose a city, or enable location and tap Find near me.':error.code===3?'Location timed out. Choose a city, or tap Find near me to retry.':'Location couldn’t be found. All 24 cities remain selectable.';
    $('location-status').textContent=message;
    if($('sort-select').value==='distance')$('sort-select').value='recommended';
    if(!auto)toast(message);
  },{enableHighAccuracy:true,timeout:12000,maximumAge:120000});
}

function initMapStyle() {
  let remembered='wireframe';try{remembered=localStorage.getItem('in-a-pinch:v3:map-style')||remembered;}catch{}
  function setStyle(value){
    const style=preferredMapStyle(value);document.body.dataset.mapStyle=style;
    for(const button of document.querySelectorAll('[data-map-style-option]'))button.setAttribute('aria-pressed',String(button.dataset.mapStyleOption===style));
    try{localStorage.setItem('in-a-pinch:v3:map-style',style);}catch{}
    document.dispatchEvent(new CustomEvent('mapstylechange',{detail:style}));
  }
  setStyle(remembered);
  document.querySelectorAll('[data-map-style-option]').forEach(button=>button.addEventListener('click',()=>setStyle(button.dataset.mapStyleOption)));
}

function clearFilters() {
  filters.clear();savedOnly=false;$('search-input').value='';closeDetail(false);render({fit:true});
}

function bindEvents() {
  $('search-input').addEventListener('input',()=>{visibleLimit=60;render({fit:true});});
  $('filters').addEventListener('click',event=>{
    const button=event.target.closest('[data-filter]');if(!button)return;
    visibleLimit=60;const value=button.dataset.filter;
    if(value==='all')filters.clear();else{if(value==='free')filters.delete('purchase');if(value==='purchase')filters.delete('free');filters.has(value)?filters.delete(value):filters.add(value);}
    render({fit:true});
  });
  $('sort-select').addEventListener('change',()=>{if($('sort-select').value==='distance'&&!position)locate();else render();});
  $('saved-btn')?.addEventListener('click',()=>{savedOnly=!savedOnly;render({fit:true});if(savedOnly)setView('list');});
  $('locate-btn').addEventListener('click',locate);
  $('reset-map-btn').addEventListener('click',()=>{closeDetail(false);fitResults(getResults());setView('map');});
  $('map-view-btn').addEventListener('click',()=>setView('map'));
  $('list-view-btn').addEventListener('click',()=>setView('list'));
  $('detail-close').addEventListener('click',()=>closeDetail());
  $('about-btn').addEventListener('click',()=>{$('about-dialog').showModal();});
  $('about-close').addEventListener('click',()=>{$('about-dialog').close();});
  $('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const r=$('about-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('about-dialog').close();}});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-more-venues]')){visibleLimit+=60;render();return;}
    if(event.target.closest('[data-discover-venues]')){setView('map');if(map)map.setZoom(Math.max(15.5,map.getZoom()));toast('Pan through a neighborhood to discover more mapped restaurants and bars.');return;}
    const saveButton=event.target.closest('[data-save]');if(saveButton){toggleSaved(saveButton.dataset.save);return;}
    const selectButton=event.target.closest('[data-select]');if(selectButton){openDetail(selectButton.dataset.select);return;}
    const shareButton=event.target.closest('[data-share]');if(shareButton){sharePlace(shareButton.dataset.share);return;}
    if(event.target.closest('[data-clear]'))clearFilters();
    const card=event.target.closest('.result-card');
    if(card && !event.target.closest('button,a,input,select'))openDetail(card.dataset.place);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && selectedId && !$('about-dialog').open && !$('cities-dialog').open)closeDetail();
    if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('about-dialog').open && !$('cities-dialog').open){event.preventDefault();$('search-input').focus();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&city){applyCity(city);render();if(selectedId)renderDetails(placeIndex.get(selectedId));}});
  setInterval(()=>{
    if(!city || document.hidden || $('result-list').contains(document.activeElement) || $('detail-panel').contains(document.activeElement))return;
    applyCity(city);render();if(selectedId)renderDetails(placeIndex.get(selectedId));
  },60000);
}

async function changeCity(next) {
  // Fetch first so a failed switch leaves the current city usable.
  const response=await fetch(`./data/${next.id}.json`);
  if(!response.ok)throw new Error('City data unavailable');
  const data=await response.json();
  if(!Array.isArray(data.locations)||!data.locations.length)throw new Error('No city listings');
  const retainedSpot=new URL(location.href).searchParams.get('spot');
  closeDetail(false);
  if(retainedSpot){const url=new URL(location.href);url.searchParams.set('spot',retainedSpot);history.replaceState(null,'',url);}
  mapObserver?.disconnect();
  if(map){map.remove();map=null;}
  document.body.dataset.mapRenderer='pending';
  markerLayer=null;userMarker=null;userCircle=null;markers.clear();
  city=next;cityRevision++;meta=data.meta;places=data.locations;visibleLimit=60;
  clearTimeout(discoveryTimer);pendingDiscovered=[];
  const restored=await cachedVenues(next.id);places.push(...mergeVenuePlaces(places,restored));
  city.count=places.length;city.confirmedCount=places.filter(p=>p.bathroomConfirmed===true).length;
  placeIndex=new Map(places.map(p=>[p.id,p]));
  filters.clear();savedOnly=false;$('search-input').value='';
  $('sort-select').value=position?'distance':'recommended';
  $('location-status').textContent='';
  $('map-status').hidden=true;
  applyCity(next);
  await initializeMap();
  render();drawPosition();
  if($('checked-date'))$('checked-date').textContent=meta.checkedLabel||'November 2026';
  if(map)requestAnimationFrame(()=>map.invalidateSize({pan:false}));
}

function queueDiscovered(features){
  for(const feature of features){const p=placeFromFeature(feature,city);if(p)pendingDiscovered.push(p);}
  clearTimeout(discoveryTimer);
  discoveryTimer=setTimeout(()=>{
    const added=mergeVenuePlaces(places,pendingDiscovered);pendingDiscovered=[];
    if(!added.length)return;
    places.push(...added);city.count=places.length;city.confirmedCount=places.filter(p=>p.bathroomConfirmed===true).length;
    void saveVenues(added);applyCity(city);render();
    if(!selectedId)restoreSpot();
  },700);
}

function restoreSpot(){
  const id=new URL(location.href).searchParams.get('spot');
  if(id&&places.some(p=>p.id===id))openDetail(id,{fromLink:true});
}

async function start() {
  // Keep the requested spot across initial loading, which clears stale details.
  const requestedSpot=new URL(location.href).searchParams.get('spot');
  const autoLocate=shouldLocateOnStart(location.href);
  bindEvents();initMapStyle();
  createOcean();
  new ResizeObserver(()=>{
    const top=document.querySelector('.sidebar').getBoundingClientRect().bottom-document.querySelector('.workspace').getBoundingClientRect().top+12;
    $('app').style.setProperty('--mobile-controls-top',`${top}px`);
  }).observe(document.querySelector('.sidebar'));
  document.addEventListener('restorecityspot',restoreSpot);
  try {
    cityGuide=await initCityGuide(changeCity);
    setView(map?'map':'list');
    if(autoLocate)locate({auto:true});
    const near=new URL(location.href).searchParams.get('near')?.split(',').map(Number);
    if(requestedSpot&&!places.some(p=>p.id===requestedSpot)&&near?.length===2&&near.every(Number.isFinite)&&Math.abs(near[0])<=90&&Math.abs(near[1])<=180&&distanceMiles({lat:near[0],lng:near[1]},city)<=45){map?.setView(near,16,{animate:false});}
    void initRatings(()=>{render();if(selectedId)renderDetails(placeIndex.get(selectedId));},toast);
    if(requestedSpot&&places.some(p=>p.id===requestedSpot)){
      const url=new URL(location.href);url.searchParams.set('spot',requestedSpot);history.replaceState(null,'',url);
      openDetail(requestedSpot,{fromLink:true});
    }
  } catch(error) {
    setView('list');$('result-count').textContent='The directory couldn’t load';
    $('result-list').innerHTML='<div class="empty-state"><h3>A small detour.</h3><p>Please refresh to load the city directory.</p><button class="secondary-action" id="reload-btn">Try again</button></div>';
    $('reload-btn').addEventListener('click',()=>location.reload());
    console.error(error);
  }
}
start();
