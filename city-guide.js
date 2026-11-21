import {escapeHTML as e, normalize} from './logic.js';
export let cities = [];
export function nearestCity(position) {
  const rad=Math.PI/180;
  return [...cities].sort((a,b)=>{
    const distance=c=>Math.acos(Math.min(1,Math.max(-1,Math.sin(position.lat*rad)*Math.sin(c.lat*rad)+Math.cos(position.lat*rad)*Math.cos(c.lat*rad)*Math.cos((position.lng-c.lng)*rad))));
    return distance(a)-distance(b);
  })[0];
}
export function applyCity(city) {
  const root=document.documentElement;
  for(const [key,value] of Object.entries({'city-deep':city.deep,'city-accent':city.accent,'city-highlight':city.highlight,'city-art':`url("${city.art}")`}))root.style.setProperty(`--${key}`,value);
  document.body.dataset.city=city.id;
  document.body.dataset.motif=city.motif;
  document.title=`IN A PINCH V3 · ${city.name} Bathroom Map`;
  document.querySelector('meta[name="theme-color"]').content=city.deep;
  document.querySelector('meta[name="description"]').content=`Find bathroom stops in ${city.name} and 23 more cities. Maps, access details, saved places and walking directions.`;
  document.getElementById('current-city-name').textContent=`${city.name}, ${city.state}`;
  document.getElementById('current-city-code').textContent=city.code;
  document.querySelector('.intro .eyebrow').textContent=`${city.name}, ${city.state} · ${city.theme}`;
  document.querySelector('.intro h1').innerHTML=`${e(city.headline[0])}<br><span>${e(city.headline[1])}</span>`;
  document.querySelector('.intro-copy').textContent=city.tagline;
  document.getElementById('city-local-label').textContent=city.theme;
  document.getElementById('city-coverage').innerHTML=`<strong>${city.count.toLocaleString()} places</strong><span>${city.confirmedCount.toLocaleString()} restroom-mapped · expands as you explore</span><button type="button" data-discover-venues>Explore more</button>`;
  document.getElementById('city-coverage').title='Includes documented bathrooms and unverified venue leads. Not an exhaustive city directory.';
  document.querySelector('.map-region').setAttribute('aria-label',`${city.name} bathroom map`);
  document.getElementById('map').setAttribute('aria-label',`Interactive map of bathroom stops in ${city.name}`);
  document.querySelector('.island-note').innerHTML=`<span>${e(city.code)} · IN A PINCH</span><strong>${e(city.name.toUpperCase())}</strong><span>${e(city.theme.toUpperCase())}</span>`;
  document.querySelector('.about-lead').textContent=`IN A PINCH helps you find bathroom stops in ${city.name} and 23 other destinations. Every city has its own map and personality.`;
  document.getElementById('about-hours').textContent=`“Open by schedule” uses published restroom hours in ${city.name}’s time zone (${city.timezone}). Unknown hours are excluded. Schedule status does not confirm live access or temporary closures.`;
  document.getElementById('about-data-link').href=`data/${city.id}.json`;
  document.getElementById('city-clock').textContent=new Intl.DateTimeFormat('en-US',{timeZone:city.timezone,hour:'numeric',minute:'2-digit'}).format(new Date())+' LOCAL';
  document.querySelectorAll('button[data-city]').forEach(button=>{
    button.classList.toggle('is-current',button.dataset.city===city.id);
    button.setAttribute('aria-pressed',String(button.dataset.city===city.id));
  });
  document.getElementById('header-motion-btn').hidden=city.id!=='key-west';
  document.getElementById('ocean-motion-btn').hidden=city.id!=='key-west';
  document.dispatchEvent(new CustomEvent('citychange',{detail:city}));
}

export async function initCityGuide(onSelect) {
  const response=await fetch('./cities.json');
  if(!response.ok)throw new Error('City guide unavailable');
  cities=await response.json();
  const $=id=>document.getElementById(id);
  let selectedId;let pending=false;
  const dialog=$('cities-dialog');
  function renderCities(){
    const query=normalize($('city-search').value);
    const region=$('city-region').value;
    const results=cities.filter(c=>(!region||c.region===region)&&normalize(`${c.name} ${c.state} ${c.code} ${c.region} ${c.theme}`).includes(query));
    $('city-search-count').textContent=`${results.length} ${results.length===1?'destination':'destinations'}`;
    $('city-grid').innerHTML=results.map(c=>`<button class="city-card ${c.id===selectedId?'is-current':''}" data-city="${e(c.id)}" aria-pressed="${c.id===selectedId}" ${pending?'disabled':''} style="--card-color:${c.deep};--card-accent:${c.highlight}"><span class="city-postcard"><img src="${c.art}" alt="" loading="lazy"><span class="city-code">${e(c.code)}</span><span class="city-current">Selected</span></span><span class="city-card-info"><strong>${e(c.name)}</strong><span>${e(c.state)} · ${e(c.theme)}</span><small>${c.count.toLocaleString()} places · ${c.confirmedCount} restroom-mapped</small></span></button>`).join('')||'<div class="city-empty"><h3>No cities found.</h3><p>Try a city, state, airport code, or another region.</p><button type="button" id="city-reset">Show every destination</button></div>';
  }
  const featured=['key-west','nyc','miami','la','austin','sf'];
  $('city-shortcuts').innerHTML=featured.map(id=>{const c=cities.find(c=>c.id===id);return `<button data-city="${id}" aria-pressed="false"><i style="background:${c.accent}"></i>${e(id==='nyc'?'NYC':id==='la'?'Los Angeles':c.name)}</button>`;}).join('');
  $('city-region').innerHTML='<option value="">Every region</option>'+[...new Set(cities.map(c=>c.region))].sort().map(r=>`<option>${e(r)}</option>`).join('');
  $('city-search').addEventListener('input',renderCities);
  $('city-region').addEventListener('change',renderCities);
  $('cities-close').addEventListener('click',()=>dialog.close());
  for(const id of ['city-picker-btn','explore-cities-btn'])$(id).addEventListener('click',()=>{renderCities();dialog.showModal();$('city-search').focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  async function select(id,{push=true}={}){
    if(pending)return;
    const city=cities.find(c=>c.id===id);if(!city)return;
    if(id===selectedId){dialog.close();return;}
    pending=true;
    document.querySelectorAll('button[data-city]').forEach(b=>b.disabled=true);
    $('city-picker-btn').setAttribute('aria-busy','true');
    try{
      await onSelect(city);
      selectedId=city.id;
      applyCity(city);
      if(push){const url=new URL(location.href);url.searchParams.set('city',city.id);url.searchParams.delete('spot');history.pushState(null,'',url);}
      try{localStorage.setItem('in-a-pinch:v3:city',city.id);}catch{}
      dialog.close();
    }catch(error){
      $('city-search-count').textContent='City could not load. Please try again.';
      throw error;
    }finally{
      pending=false;$('city-picker-btn').removeAttribute('aria-busy');
      document.querySelectorAll('button[data-city]').forEach(b=>b.disabled=false);
    }
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#city-reset')){$('city-search').value='';$('city-region').value='';renderCities();return;}
    const button=event.target.closest('button[data-city]');if(button)void select(button.dataset.city).catch(console.error);
  });
  window.addEventListener('popstate',()=>{
    const id=new URL(location.href).searchParams.get('city')||'key-west';
    void select(id,{push:false}).then(()=>document.dispatchEvent(new CustomEvent('restorecityspot'))).catch(console.error);
  });
  let preferred='key-west';try{preferred=localStorage.getItem('in-a-pinch:v3:city')||preferred;}catch{}
  const requested=new URL(location.href).searchParams.get('city');
  if(new URL(location.href).searchParams.has('spot')&&!requested)preferred='key-west';
  const first=cities.find(c=>c.id===(requested||preferred))||cities[0];
  await select(first.id,{push:false});
  const initialURL=new URL(location.href);initialURL.searchParams.set('city',first.id);history.replaceState(null,'',initialURL);
  renderCities();
  return {cities,select};
}
