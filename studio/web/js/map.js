// The community search in the project form (D26): an iframe with the map page, and the form
// listens for what it chooses. The map page is separate because Amap's script needs a looser content
// policy than the rest of the app (see `map-frame.js`). With no Amap key there is no map and the
// typed pickers do the job.

import { api } from './api.js';
import { h } from './dom.js';
import { t } from './i18n.js';

let configPromise;
export function mapConfig() {
  configPromise ??= api('GET', '/config').then((c) => c.amap).catch(() => null);
  return configPromise;
}

/**
 * `onChoose({ community, city, district })` is called when a community is found by name or by a
 * click on the map. Returns null when no map is set up. The returned element carries a hidden
 * `community` field for the form.
 */
export async function communityPicker({ onChoose }) {
  if (!(await mapConfig())) return null;
  const hidden = h('input', { type: 'hidden', name: 'community' });
  const chosen = h('p', { class: 'small', role: 'status' });
  const frame = h('iframe', { class: 'map-frame', src: '/map-frame.html', title: t('map.title'), loading: 'lazy', referrerpolicy: 'no-referrer' });
  window.addEventListener('message', (event) => {
    // Only the map page of this site may speak, and only about a choice.
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.source !== 'ir-map' || event.data.type !== 'chosen') return;
    const { community, city, district } = event.data;
    hidden.value = typeof community === 'string' ? community.slice(0, 80) : '';
    chosen.textContent = hidden.value ? t('map.chosen', { name: hidden.value }) : '';
    if (typeof city === 'string' && typeof district === 'string' && city && district) onChoose({ community: hidden.value, city, district });
  });
  return h('div', { class: 'community' }, h('span', { class: 'field-label' }, t('map.title')), frame, chosen, hidden);
}
