// The I Renovation interface (N1, N26, N8, D25): one page, served by the NestJS app at `/`, calling
// the API at `/api`. Homeowner, contractor and console screens share this shell.

import { decorateWorkbench, studioSpace } from './spatial.js';
import { ApiError, api, session } from './api.js';
import { h, mount } from './dom.js';
import { lang, setLang, t } from './i18n.js';
import { go, setRenderer } from './router.js';
import { icon } from './ui.js';
import { animatePage } from './motion.js';
import { admin } from './views/admin.js';
import { describe, errorBox, link, loading } from './views/common.js';
import { application, invitationDetail, invitationsList } from './views/contractor.js';
import { browse, browseDetail, homeNew, homesList, projectDetail, projectNew, projectsList } from './views/homeowner.js';
import { dashboardFor, home, login, register } from './views/public.js';

// [path, view, who may open it]: 'homeowner', 'contractor', 'any' signed-in account, 'admin', or public.
const ROUTES = [
  ['/', home],
  ['/register', register],
  ['/login', login],
  ['/projects', projectsList, 'homeowner'],
  ['/projects/new', projectNew, 'homeowner'],
  ['/projects/:id', projectDetail, 'homeowner'],
  ['/homes', homesList, 'homeowner'],
  ['/homes/new', homeNew, 'homeowner'],
  ['/browse', browse, 'homeowner'],
  ['/browse/:id', browseDetail, 'homeowner'],
  ['/application', application, 'contractor'],
  ['/invitations', invitationsList, 'contractor'],
  ['/invitations/:id', invitationDetail, 'any'],
  ['/admin', admin, 'admin'],
].map(([path, view, who]) => ({ regex: new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), view, who }));

function find(path) {
  for (const route of ROUTES) {
    const hit = route.regex.exec(path);
    if (hit) return { route, args: { ...hit.groups } };
  }
  return null;
}

async function ensureUser() {
  if (session.user || !session.token) return;
  try {
    session.user = await api('GET', '/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) session.signOut();
  }
}

function header(path) {
  const user = session.user;
  const items = !user
    ? [['/login', t('nav.login'), 'users'], ['/register', t('nav.register'), 'plus']]
    : user.role === 'homeowner'
      ? [['/projects', t('nav.projects'), 'home'], ['/homes', t('nav.homes'), 'build'], ['/projects/new', t('nav.new'), 'plus'], ['/browse', t('nav.browse'), 'users']]
      : [['/application', t('nav.application'), 'file'], ['/invitations', t('nav.invitations'), 'inbox']];
  const isOn = (href) =>
    path === href ||
    (href === '/projects' && path.startsWith('/projects/') && path !== '/projects/new') ||
    (href === '/homes' && path.startsWith('/homes/')) ||
    (href === '/browse' && path.startsWith('/browse/')) ||
    (href === '/invitations' && path.startsWith('/invitations/'));
  const badge = h('span', { class: 'badge hide' });
  const nav = h('nav', { class: 'nav' }, items.map(([href, text, name]) => h('a', { href, 'data-link': true, class: isOn(href) ? 'on' : '' }, icon(name), text, href === '/invitations' ? badge : null)));
  if (user?.role === 'contractor') {
    // How many invitations are waiting for an answer: shown without holding up the page.
    api('GET', '/invitations/mine')
      .then((list) => {
        const waiting = list.filter((i) => i.status === 'invited').length;
        if (waiting) {
          badge.textContent = String(waiting);
          badge.classList.remove('hide');
        }
      })
      .catch(() => {});
  }
  const menu = h('button', { class: 'landing-menu', type: 'button', 'aria-label': lang() === 'en' ? 'Open menu' : '打开菜单', 'aria-expanded': 'false', onclick: () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', lang() === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? '关闭菜单' : '打开菜单'));
    nav.classList.toggle('menu-open', open);
  } }, h('span'), h('span'));
  return h(
    'header',
    { class: path === '/' ? 'bar landing-bar' : 'bar' },
    h(
      'div',
      { class: 'bar-in' },
      h('a', { href: '/', 'data-link': true, class: 'brand' }, h('span', { class: 'logo' }, h('img', { src: path === '/' ? '/homora-icon.png' : '/homora-mark-v2.png', alt: '', width: 36, height: 36 })), lang() === 'en' ? 'Homora' : '予舍'),
      nav,
      path === '/' ? menu : null,
      h(
        'div',
        { class: 'who' },
        user ? h('span', {}, user.displayName) : null,
        h('button', { class: 'link', onclick: () => { setLang(lang() === 'en' ? 'zh-CN' : 'en'); render(); } }, t('nav.lang')),
        user ? h('button', { class: 'link', onclick: () => { session.signOut(); go('/', true); } }, t('nav.signout')) : null,
      ),
    ),
  );
}

let ticket = 0;
let disposeMotion = () => {};

async function render() {
  const mine = ++ticket;
  const app = document.getElementById('app');
  await ensureUser();
  if (mine !== ticket) return;
  document.title = lang() === 'en' ? 'Homora · Home design & renovation' : '予舍 · 住宅设计与装修';
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.body.dataset.space = ({ projects: 'projects', homes: 'homes', browse: 'teams', application: 'partners', invitations: 'invitations', admin: 'console', login: 'login', register: 'register' })[path.split('/')[1]] || 'home';
  document.body.classList.toggle('in-studio', path === '/');
  document.body.classList.toggle('in-room', path !== '/');
  const main = h('main', { class: path === '/' ? 'wrap landing-main' : 'wrap workspace' }, loading());
  disposeMotion();
  mount(app, header(path), main, h('footer', { class: 'foot' }, h('span', {}, t('footer.note')), ' ', link('/admin', t('nav.console'))));
  const found = find(path);
  if (!found) {
    main.replaceChildren(h('h1', {}, t('notfound.title')), link('/', t('back')));
    return;
  }
  const { route, args } = found;
  const user = session.user;
  if ((route.who === 'homeowner' || route.who === 'contractor' || route.who === 'any') && !user) {
    go(`/login?next=${encodeURIComponent(path + location.search)}`, true);
    return;
  }
  if ((route.who === 'homeowner' || route.who === 'contractor') && user.role !== route.who) {
    go(dashboardFor(user), true);
    return;
  }
  try {
    const view = await route.view({ args, params: new URLSearchParams(location.search) });
    if (mine !== ticket || view === null) return;
    const intro = path === '/' ? null : studioSpace();
    if (intro) decorateWorkbench(view, path);
    main.replaceChildren(...(intro ? [intro, view] : [view]));
    window.scrollTo(0, 0);
    disposeMotion = animatePage(main);
  } catch (error) {
    if (mine !== ticket) return;
    if (error instanceof ApiError && error.status === 401 && !error.admin) {
      session.signOut();
      go(`/login?next=${encodeURIComponent(path + location.search)}`, true);
      return;
    }
    main.replaceChildren(errorBox(error));
    console.error(describe(error));
  }
}

setRenderer(render);

document.addEventListener('click', (event) => {
  const a = event.target instanceof Element ? event.target.closest('a[data-link]') : null;
  if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || a.target === '_blank') return;
  event.preventDefault();
  go(a.getAttribute('href'));
});
window.addEventListener('popstate', render);
render();
