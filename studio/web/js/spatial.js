import { h } from './dom.js';
import { lang } from './i18n.js';
import { go } from './router.js';
import { session } from './api.js';

function spaceObject(kind, className) {
  return h('div', { class: `${className} object-${kind}`, 'aria-hidden': 'true' },
    h('img', { class: 'spatial-object-image', src: `/object-${kind}-v1.png`, alt: '', decoding: 'async' }),
    className === 'draft-object' ? h('span', { class: 'object-caption' }, lang() === 'en' ? 'ILLUSTRATION' : '空间示意') : null);
}

export function studioSpace() {
  const en = lang() === 'en';
  const contractor = session.user?.role === 'contractor';
  const routes = contractor ? ['/invitations', '/application', '/'] : ['/projects', '/homes', '/browse'];
  const labels = contractor ? (en ? ['Invitations', 'Your studio', 'Reception'] : ['项目来信', '团队档案', '会客厅']) : (en ? ['The project desk', 'The model room', 'Meet the makers'] : ['项目书桌', '模型室', '材料与匠人']);
  const scene = h('div', { class: 'spatial-room' }, h('div', { class: 'room-ceiling' }), h('div', { class: 'room-floor' }), h('div', { class: 'room-wall' }), h('div', { class: 'room-window' }));
  const status = h('p', { class: 'spatial-status', 'aria-live': 'polite' }, en ? 'Choose a space to step inside.' : '选一处，进去看看。');
  const current = location.pathname;
  let transitionTimer;
  const entrances = routes.map((route, i) => h('button', { class: `space-door door-${i}${(route === '/' ? current === '/' : current.startsWith(route)) ? ' active' : ''}`, onclick: () => {
    if (current === route || scene.classList.contains('entering')) return;
    scene.classList.add('entering', `enter-${i}`);
    status.textContent = en ? `Entering ${labels[i]}…` : `正在进入${labels[i]}…`;
    transitionTimer = setTimeout(() => go(route), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850);
  } }, h('span', { class: 'door-number' }, `0${i+1}`), spaceObject((contractor ? ['desk', 'materials', 'model'] : ['desk', 'model', 'materials'])[i], 'door-object'), h('span', { class: 'door-label' }, labels[i]), h('span', { class: 'door-enter' }, en ? 'STEP INSIDE ↗' : '进入空间 ↗')));
  scene.append(...entrances);
  const lobby = h('section', { class: 'spatial-lobby' }, h('div', { class: 'spatial-heading' }, h('p', {}, 'HOMORA / DIGITAL ATELIER'), h('h1', {}, en ? 'The design atelier.' : '予舍设计室')), scene, h('div', { class: 'spatial-caption' }, status, h('span', {}, en ? 'THREE SPACES. YOUR NEXT MOVE.' : '三个空间，一次新的打算。')));
  lobby.disposeRoom = () => clearTimeout(transitionTimer);
  return lobby;
}

export function decorateWorkbench(view, path) {
  const en = lang() === 'en';
  view.classList.add('room-content');
  if (path === '/projects/new') view.classList.add('room-content-open');
  if (['/homes', '/projects', '/invitations'].includes(path)) {
    view.classList.add('room-gallery');
    const empty = view.querySelector('.empty');
    if (empty) {
      empty.classList.add('spatial-empty');
      const object = spaceObject(path === '/homes' ? 'model' : 'desk', 'draft-object');
      empty.prepend(object);
      empty.querySelector(':scope > .ico')?.remove();
    }
    const cards = [...view.querySelectorAll(':scope > .stack > .card')];
    if (cards.length) {
      const shelf = cards[0].parentElement;
      shelf.classList.add('spatial-shelf');
      const previous = h('button', { type: 'button', 'aria-label': en ? 'Previous' : '上一个', onclick: () => shelf.scrollBy({ left: -350, behavior: 'smooth' }) }, '←');
      const next = h('button', { type: 'button', 'aria-label': en ? 'Next' : '下一个', onclick: () => shelf.scrollBy({ left: 350, behavior: 'smooth' }) }, '→');
      view.append(h('div', { class: 'shelf-controls' }, previous, next));
    }
  }
  const file = view.querySelector('input[type=file]');
  if (file && path === '/homes/new') {
    const preview = h('img', { class: 'drawing-preview', src: '/object-plan-v1.png', alt: en ? 'Illustrative floor plan' : '户型图示意' });
    const caption = h('p', { class: 'small muted', role: 'status' }, en ? 'Illustration — choose your own drawing above.' : '图纸示意，请在上方选择你自己的户型图。');
    file.closest('.field')?.append(preview, caption);
    let previous = null;
    file.addEventListener('change', () => {
      if (previous) URL.revokeObjectURL(previous);
      const picked = file.files[0];
      if (!picked || !['image/png','image/jpeg','image/webp'].includes(picked.type)) { preview.classList.add('hide'); return; }
      const url = URL.createObjectURL(picked);
      previous = url;
      preview.onload = () => { URL.revokeObjectURL(url); if (previous === url) previous = null; };
      preview.alt = en ? 'Your floor plan preview' : '你的户型图预览';
      preview.src = url;
      preview.classList.remove('hide');
      caption.textContent = picked.name;
    });
  }
}
