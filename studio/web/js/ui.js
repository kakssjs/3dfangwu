// Shared interface pieces: icons, the stage tracker, the real-place pickers, "use my location" and
// file uploads. The places come from `GET /api/regions` (real provinces, cities and districts), and
// "use my location" asks the browser first and then our own API: no screen talks to a third party.

import { ApiError, api } from './api.js';
import { h } from './dom.js';
import { t } from './i18n.js';

// ---- icons: small stroke icons, drawn inline so the page needs no image files ----

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  users: 'M16 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M5 20c0-3 3-5 7-5s7 2 7 5',
  file: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 13h6 M9 17h6',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12 M18 6 6 18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  alert: 'M12 3 2 20h20z M12 10v4 M12 17h.01',
  pin: 'M12 21s7-6 7-11.5a7 7 0 1 0-14 0C5 15 12 21 12 21z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  locate: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  upload: 'M12 16V5 M7 9l5-5 5 5 M5 20h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  sealed: 'M3 3l18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-3 4 M6.1 6.1C4 7.6 2.6 9.8 2.5 12c1 2.5 4.5 7 9.5 7 1.5 0 2.9-.4 4.1-1',
  build: 'M3 21h18 M5 21V8l7-4 7 4v13 M9 21v-5h6v6',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  image: 'M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  scale: 'M12 3v18 M5 21h14 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z',
  inbox: 'M3 13l3-8h12l3 8v6H3z M3 13h5l1 3h6l1-3h5',
};

export function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', PATHS[name] ?? PATHS.info);
  svg.append(path);
  return svg;
}

export const avatar = (name) => h('div', { class: 'avatar', 'aria-hidden': 'true' }, [...String(name ?? '?').trim()][0] ?? '?');

export const skeletons = (n = 3) => h('div', {}, Array.from({ length: n }, () => h('div', { class: 'skeleton' })));

export function empty(iconName, title, body, ...actions) {
  return h('div', { class: 'card empty' }, icon(iconName), h('h3', {}, title), body ? h('p', { class: 'muted' }, body) : null, actions.length ? h('div', { class: 'actions center' }, actions) : null);
}

// ---- the journey's stages ----

export const STAGES = ['requirements', 'design', 'matching', 'contract', 'construction', 'acceptance', 'after-sales'];

/** The stage tracker. `design` is optional, so it shows as skipped until it exists. */
export function stageTracker(currentStage, skipped = ['design']) {
  const at = STAGES.indexOf(currentStage);
  return h(
    'ol',
    { class: 'stages' },
    STAGES.map((stage, i) => h('li', { class: [i < at && !skipped.includes(stage) ? 'done' : '', i === at ? 'now' : '', skipped.includes(stage) && i !== at ? 'skip' : ''].join(' ') }, t(`stage.${stage}`))),
  );
}

// ---- real places ----

let regions = null;
export async function getRegions() {
  regions ??= (await api('GET', '/regions')).provinces;
  return regions;
}

const option = (value, text) => h('option', { value }, text);

/**
 * Province, city and district from the real list. `city` and `district` are the select names, so a
 * form reads them as usual. `set()` fills it from a position.
 */
export async function placePicker({ city = '', district = '', locate = true, required = true } = {}) {
  const provinces = await getRegions();
  const province = h('select', { 'aria-label': t('place.province') });
  const citySelect = h('select', { name: 'city', required, 'aria-label': t('f.city') });
  const districtSelect = h('select', { name: 'district', required, 'aria-label': t('p.district') });
  const fillProvinces = () => province.replaceChildren(option('', t('place.pick')), ...provinces.map((p) => option(p.name, p.name)));
  const fillCities = () => {
    const p = provinces.find((x) => x.name === province.value);
    citySelect.replaceChildren(option('', t('place.pick')), ...(p ? p.cities.map((c) => option(c.name, c.name)) : []));
    citySelect.disabled = !p;
    fillDistricts();
  };
  const fillDistricts = () => {
    const p = provinces.find((x) => x.name === province.value);
    const c = p?.cities.find((x) => x.name === citySelect.value);
    districtSelect.replaceChildren(option('', t('place.pick')), ...(c ? c.districts.map((d) => option(d, d)) : []));
    districtSelect.disabled = !c;
  };
  province.addEventListener('change', fillCities);
  citySelect.addEventListener('change', fillDistricts);
  fillProvinces();
  const set = (cityName, districtName) => {
    const p = provinces.find((x) => x.cities.some((c) => c.name === cityName));
    province.value = p?.name ?? '';
    fillCities();
    citySelect.value = p ? cityName : '';
    fillDistricts();
    districtSelect.value = districtName ?? '';
  };
  set(city, district);
  const labelled = (text, control) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, text), control);
  const el = h(
    'div',
    {},
    locate ? locateButton((place) => set(place.city, place.district)) : null,
    h('div', { class: 'row3' }, labelled(t('place.province'), province), labelled(t('f.city'), citySelect), labelled(t('p.district'), districtSelect)),
  );
  return { el, set };
}

/** One city and any number of its districts, for a contractor's service area. */
export async function areaPicker({ city = '', districts = [] } = {}) {
  const provinces = await getRegions();
  const province = h('select', { 'aria-label': t('place.province') });
  const citySelect = h('select', { name: 'city', required: true, 'aria-label': t('f.city') });
  const boxes = h('div', { class: 'districts' });
  const tick = new Set(districts);
  const fillCities = () => {
    const p = provinces.find((x) => x.name === province.value);
    citySelect.replaceChildren(option('', t('place.pick')), ...(p ? p.cities.map((c) => option(c.name, c.name)) : []));
    citySelect.disabled = !p;
    fillBoxes();
  };
  const fillBoxes = () => {
    const p = provinces.find((x) => x.name === province.value);
    const c = p?.cities.find((x) => x.name === citySelect.value);
    const names = c?.districts ?? [];
    for (const d of [...tick]) if (!names.includes(d)) tick.delete(d);
    boxes.replaceChildren(
      ...(names.length
        ? names.map((d) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'districts', value: d, checked: tick.has(d), onchange: (e) => (e.target.checked ? tick.add(d) : tick.delete(d)) }), d))
        : [h('p', { class: 'muted small' }, t('place.pickCity'))]),
    );
  };
  province.replaceChildren(option('', t('place.pick')), ...provinces.map((p) => option(p.name, p.name)));
  province.addEventListener('change', fillCities);
  citySelect.addEventListener('change', fillBoxes);
  const set = (cityName, districtName) => {
    const p = provinces.find((x) => x.cities.some((c) => c.name === cityName));
    province.value = p?.name ?? '';
    fillCities();
    citySelect.value = p ? cityName : '';
    if (districtName) tick.add(districtName);
    fillBoxes();
  };
  set(city, null);
  const labelled = (text, control) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, text), control);
  return {
    el: h('div', {}, locateButton((place) => set(place.city, place.district)), h('div', { class: 'row2' }, labelled(t('place.province'), province), labelled(t('f.city'), citySelect)), h('span', { class: 'field-label' }, t('app.districts')), boxes),
    selected: () => [...tick],
  };
}

// ---- use my location ----

function geoMessage(error) {
  if (error instanceof ApiError) return error.status === 503 ? t('geo.down') : error.status === 400 ? t('geo.outside') : t('geo.failed');
  switch (error?.code) {
    case 1: return t('geo.denied');
    case 2: return t('geo.unavailable');
    case 3: return t('geo.timeout');
    default: return t('geo.failed');
  }
}

/** Asks the browser for the position (it asks the person first), then our API for the real district. */
export function locateButton(onPlace) {
  const status = h('span', { class: 'small muted', role: 'status' });
  const button = h(
    'button',
    {
      type: 'button',
      onclick: async () => {
        if (!navigator.geolocation) {
          status.textContent = t('geo.unsupported');
          return;
        }
        button.disabled = true;
        status.textContent = t('geo.asking');
        try {
          const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, maximumAge: 600000 }));
          status.textContent = t('geo.finding');
          const place = await api('POST', '/geo/locate', { body: { lat: position.coords.latitude, lng: position.coords.longitude } });
          if (!place.matched) status.textContent = t('geo.nomatch');
          else {
            onPlace(place);
            status.textContent = t('geo.found', { place: `${place.city} · ${place.district}` });
          }
        } catch (error) {
          status.textContent = geoMessage(error);
        } finally {
          button.disabled = false;
        }
      },
    },
    icon('locate'),
    t('geo.button'),
  );
  return h('div', { class: 'locate' }, h('div', { class: 'actions' }, button, status), h('p', { class: 'small muted' }, t('geo.privacy')));
}

// ---- files ----

const MAX_FILE = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function blobOf(file) {
  const bytes = Uint8Array.from(atob(file.dataBase64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: file.contentType });
}

/** A grid of files. `admin` reads them with the console's key. */
export function fileGrid(files, { admin = false } = {}) {
  if (files.length === 0) return h('p', { class: 'muted small' }, t('files.none'));
  return h(
    'div',
    { class: 'files' },
    files.map((f) => {
      const thumb = h('div', { class: 'thumb' }, icon(f.contentType.startsWith('image/') ? 'image' : 'file'));
      const open = async () => {
        const full = await api('GET', admin ? `/admin/uploads/${f.id}` : `/uploads/${f.id}`, { admin });
        const url = URL.createObjectURL(blobOf(full));
        window.open(url, '_blank', 'noopener');
      };
      if (f.contentType.startsWith('image/')) {
        api('GET', admin ? `/admin/uploads/${f.id}` : `/uploads/${f.id}`, { admin })
          .then((full) => {
            thumb.replaceChildren(h('img', { src: URL.createObjectURL(blobOf(full)), alt: f.filename }));
          })
          .catch(() => {});
      }
      return h('button', { type: 'button', class: 'file', onclick: open, title: f.filename }, thumb, h('div', { class: 'meta' }, h('span', {}, f.filename), h('span', { class: 'muted' }, `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB`)));
    }),
  );
}

/**
 * Upload photos or PDFs, for a project when `projectId` is given. The server checks what each file
 * really is and removes the location data photos carry (N18); this only checks size and type first.
 */
export function uploadBox({ projectId, label, hint, loadList = true }) {
  const list = h('div');
  const message = h('div', { role: 'status' });
  const refresh = async () => {
    if (!loadList) return;
    try {
      const files = await api('GET', `/uploads${projectId ? `?projectId=${projectId}` : ''}`);
      list.replaceChildren(fileGrid(files));
    } catch (error) {
      list.replaceChildren(h('p', { class: 'alert alert-error' }, t('err.500')));
    }
  };
  const input = h('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
    multiple: true,
    class: 'hide',
    onchange: async () => {
      message.replaceChildren();
      for (const file of [...input.files]) {
        if (!TYPES.includes(file.type)) {
          message.append(h('p', { class: 'alert alert-error' }, t('files.type', { name: file.name })));
          continue;
        }
        if (file.size > MAX_FILE) {
          message.append(h('p', { class: 'alert alert-error' }, t('files.big', { name: file.name })));
          continue;
        }
        try {
          await api('POST', '/uploads', { body: { filename: file.name.replace(/[/\\]/g, '_'), contentType: file.type, dataBase64: await toBase64(file), ...(projectId ? { projectId } : {}) } });
          message.append(h('p', { class: 'alert alert-ok' }, t('files.done', { name: file.name })));
        } catch (error) {
          message.append(h('p', { class: 'alert alert-error' }, `${file.name}: ${error instanceof ApiError && error.message ? error.message : t('err.500')}`));
        }
      }
      input.value = '';
      await refresh();
    },
  });
  queueMicrotask(refresh);
  return h(
    'div',
    {},
    h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => input.click() }, icon('upload'), label), hint ? h('span', { class: 'small muted' }, hint) : null),
    input,
    message,
    list,
  );
}
