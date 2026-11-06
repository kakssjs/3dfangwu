// The map page (D26), shown inside the project form as an iframe. Amap's script needs more than the
// rest of the app is allowed (it evaluates code), so it runs here, on a page of its own with its own
// content policy, and tells the form only what was chosen. It loads Amap with the public JS key from
// `GET /api/config`; Amap's searches go to `/_AMapService/` on our server, which adds the security code.

import { api } from './api.js';
import { h } from './dom.js';
import { t } from './i18n.js';

/** 上海市 → 上海: how the regions list writes a city. */
const shortCity = (name) => (name.length > 2 && name.endsWith('市') ? name.slice(0, -1) : name);
const lngLat = (location) => [location.lng ?? location.getLng(), location.lat ?? location.getLat()];

function loadAmap(cfg) {
  return new Promise((resolve, reject) => {
    window._AMapSecurityConfig = cfg.searchReady ? { serviceHost: `${location.origin}${cfg.serviceHost}` } : {};
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(cfg.key)}&plugin=AMap.PlaceSearch,AMap.Geocoder`;
    script.onload = () => (window.AMap ? resolve(window.AMap) : reject(new Error('AMap did not load')));
    script.onerror = () => reject(new Error('AMap could not be reached'));
    document.head.append(script);
  });
}

/** Tells the form what was chosen. Only our own page may listen. */
const tell = (message) => parent.postMessage({ source: 'ir-map', ...message }, location.origin);

async function start() {
  const root = document.getElementById('map-app');
  let cfg = null;
  try {
    cfg = (await api('GET', '/config')).amap;
  } catch {
    cfg = null;
  }
  if (!cfg) {
    root.append(h('p', { class: 'small muted pad' }, t('map.offline')));
    return;
  }
  const status = h('p', { class: 'small muted', role: 'status' });
  const results = h('div', { class: 'results' });
  const mapBox = h('div', { class: 'map', role: 'img', 'aria-label': t('map.label') });
  const search = h('input', { type: 'search', placeholder: t('map.placeholder'), 'aria-label': t('map.title'), autocomplete: 'off' });
  root.append(h('div', { class: 'pad' }, search, status, results, mapBox));

  let AMap;
  let map;
  let marker;
  let placeSearch;
  let geocoder;

  /** The real city and district of a point: Amap's search results don't carry them, its address lookup does. */
  const addressAt = (position) =>
    new Promise((resolve) => {
      geocoder ??= new AMap.Geocoder();
      geocoder.getAddress(position, (state, result) => {
        if (state !== 'complete' || !result.regeocode) return resolve({});
        const part = result.regeocode.addressComponent;
        resolve({ city: Array.isArray(part.city) ? part.province : part.city || part.province, district: part.district, neighbourhood: part.neighborhood?.name || part.township || '' });
      });
    });

  const choose = async (community, position) => {
    results.replaceChildren();
    if (position && map) {
      map.setZoomAndCenter(16, position);
      // A plain dot of our own: Amap's default marker is an image fetched over plain http.
      if (!marker) marker = new AMap.Marker({ position, content: h('div', { class: 'pin' }) });
      else marker.setPosition(position);
      map.add(marker);
    }
    const place = position && cfg.searchReady ? await addressAt(position) : {};
    tell({ type: 'chosen', community: community || place.neighbourhood || '', city: place.city ? shortCity(place.city) : '', district: place.district ?? '' });
  };

  // The map's script is large and can be slow to arrive: say so, and keep search off until it is ready.
  status.textContent = t('map.loading');
  search.disabled = true;

  loadAmap(cfg)
    .then((amap) => {
      AMap = amap;
      status.textContent = cfg.searchReady ? '' : t('map.setup');
      search.disabled = !cfg.searchReady;
      map = new AMap.Map(mapBox, { zoom: 4, center: [104.2, 35.6] });
      map.on('click', (event) => {
        if (cfg.searchReady) choose('', lngLat(event.lnglat));
      });
    })
    .catch(() => {
      status.textContent = t('map.offline');
      search.disabled = true;
    });

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    const keyword = search.value.trim();
    if (!keyword || !AMap) {
      results.replaceChildren();
      return;
    }
    timer = setTimeout(() => {
      placeSearch ??= new AMap.PlaceSearch({ type: '商务住宅', pageSize: 8, city: '全国', citylimit: false });
      status.textContent = '';
      placeSearch.search(keyword, (state, result) => {
        if (state === 'complete' && result.poiList?.pois?.length) {
          results.replaceChildren(
            ...result.poiList.pois.map((poi) =>
              h(
                'button',
                { type: 'button', class: 'result', onclick: () => choose(poi.name, lngLat(poi.location)) },
                h('strong', {}, poi.name),
                h('span', { class: 'small muted' }, [poi.pname, poi.cityname, poi.adname, poi.address].filter((x) => typeof x === 'string' && x).join(' · ')),
              ),
            ),
          );
        } else {
          results.replaceChildren();
          status.textContent = state === 'no_data' ? t('map.none') : t('map.error');
        }
      });
    }, 350);
  });
}

start();
