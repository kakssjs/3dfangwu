// Home, register and sign in (WORKFLOW.md 9.2, 9.3).

import { api, session } from '../api.js';
import { h } from '../dom.js';
import { lang, t } from '../i18n.js';
import { go } from '../router.js';
import { icon } from '../ui.js';
import { errorBox, field, input, link, onSubmit } from './common.js';

export function dashboardFor(user) {
  return user.role === 'contractor' ? '/application' : '/projects';
}

/** A floor plan drawn as line art: rooms, doors, a sofa and a bed. */
function floorPlanArt() {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = el('svg', { class: 'art', viewBox: '0 0 420 320', role: 'img', 'aria-label': t('home.art') });
  const line = { fill: 'none', stroke: '#8fd3c4', 'stroke-width': '4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const thin = { fill: 'none', stroke: '#5fb3a1', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  svg.append(
    el('rect', { x: 20, y: 20, width: 380, height: 280, rx: 6, ...line, fill: 'rgba(143,211,196,0.06)' }),
    el('path', { d: 'M20 150h150M170 20v130M170 150v150M170 220h230M290 220v80M290 20v200', ...line }),
    // doors
    el('path', { d: 'M110 150v-40a40 40 0 0 1 40 40', ...thin }),
    el('path', { d: 'M170 200a36 36 0 0 1 36 -36', ...thin }),
    el('path', { d: 'M290 270a30 30 0 0 0 30 -30', ...thin }),
    // sofa
    el('rect', { x: 200, y: 40, width: 80, height: 34, rx: 8, ...thin }),
    el('rect', { x: 206, y: 80, width: 68, height: 22, rx: 6, ...thin }),
    // bed
    el('rect', { x: 40, y: 190, width: 90, height: 90, rx: 8, ...thin }),
    el('rect', { x: 48, y: 198, width: 34, height: 22, rx: 5, ...thin }),
    el('rect', { x: 88, y: 198, width: 34, height: 22, rx: 5, ...thin }),
    // table and kitchen run
    el('circle', { cx: 330, cy: 110, r: 30, ...thin }),
    el('rect', { x: 306, y: 30, width: 80, height: 22, rx: 4, ...thin }),
    // bath
    el('rect', { x: 306, y: 236, width: 76, height: 50, rx: 8, ...thin }),
  );
  return svg;
}

export async function home() {
  if (session.user) return go(dashboardFor(session.user), true);
  const feature = (name, key) => h('div', { class: 'card feature' }, h('div', { class: 'ico-box' }, icon(name)), h('h3', {}, t(`home.f.${key}.title`)), h('p', { class: 'muted' }, t(`home.f.${key}.body`)));
  const faq = (n) => h('details', {}, h('summary', {}, t(`home.q${n}`)), h('p', { class: 'muted' }, t(`home.a${n}`)));
  return h(
    'div',
    { class: 'stack' },
    h(
      'section',
      { class: 'hero' },
      h(
        'div',
        {},
        h('h1', {}, t('home.title')),
        h('p', { class: 'lead' }, t('home.lead')),
        h('div', { class: 'actions' }, link('/register', [t('home.cta.homeowner'), icon('arrow')], 'btn primary big'), link('/register?role=contractor', t('home.cta.contractor'), 'btn ghost big')),
        h('div', { class: 'pill-row' }, ['shield', 'sealed', 'lock', 'scale'].map((name, i) => h('span', { class: 'pill' }, icon(name), t(`home.pill${i + 1}`)))),
      ),
      floorPlanArt(),
    ),
    h('section', { class: 'grid3' }, feature('pin', 'match'), feature('sealed', 'sealed'), feature('lock', 'contact')),
    h(
      'section',
      { class: 'band' },
      h('h2', {}, t('home.how.title')),
      h('ol', { class: 'steps-list' }, [1, 2, 3, 4].map((n) => h('li', {}, h('strong', {}, t(`home.step${n}.title`)), h('p', { class: 'muted' }, t(`home.step${n}.body`))))),
    ),
    h('section', { class: 'band' }, h('h2', {}, t('home.nobid.title')), h('p', {}, t('home.nobid.body'))),
    h('section', { class: 'band' }, h('h2', {}, t('home.faq')), faq(1), faq(2), faq(3), faq(4)),
    h('section', { class: 'band' }, h('h2', {}, t('home.contractor.title')), h('p', { class: 'muted' }, t('home.contractor.body')), link('/register?role=contractor', t('home.cta.contractor'), 'btn primary')),
  );
}

export async function register(ctx) {
  if (session.user) return go(dashboardFor(session.user), true);
  const wanted = ctx.params.get('role') === 'contractor' ? 'contractor' : 'homeowner';
  const box = h('div');
  const legalBox = h('div');
  const side = h('aside', { class: 'auth-side' });
  const fillSide = (role) =>
    side.replaceChildren(h('h2', {}, t(`reg.side.${role}.title`)), h('ul', { class: 'plain' }, [1, 2, 3].map((n) => h('li', {}, icon('check'), ' ', t(`reg.side.${role}.${n}`)))));
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('reg.title')),
    field(
      t('reg.role'),
      h('div', { class: 'checks' }, ['homeowner', 'contractor'].map((r) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'role', value: r, checked: r === wanted, onchange: () => { loadLegal(r); fillSide(r); } }), t(`role.${r}`)))),
    ),
    h('div', { class: 'row2' }, field(t('reg.phone'), input('phone', { type: 'tel', required: true, inputmode: 'numeric', autocomplete: 'tel' }), t('reg.phone.hint')), field(t('reg.name'), input('displayName', { required: true, maxlength: 40, autocomplete: 'name' }))),
    field(t('reg.password'), input('password', { type: 'password', required: true, minlength: 8, maxlength: 128, autocomplete: 'new-password' }), t('reg.password.hint')),
    legalBox,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'acceptTerms', required: true }), t('reg.accept')),
    box,
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary big' }, t('reg.submit')), link('/login', t('reg.have'))),
  );

  async function loadLegal(role) {
    legalBox.replaceChildren(h('p', { class: 'muted' }, t('loading')));
    try {
      const list = await api('GET', `/legal?lang=${lang()}&role=${role}`);
      legalBox.replaceChildren(
        h('p', { class: 'alert alert-warn small' }, icon('alert'), t('legal.draft')),
        ...list.documents.map((doc) => {
          const body = h('div', { class: 'legal' }, t('loading'));
          let loaded = false;
          return h(
            'details',
            {
              ontoggle: async (event) => {
                if (!event.target.open || loaded) return;
                loaded = true;
                try {
                  body.textContent = (await api('GET', `/legal/${doc.document}?lang=${lang()}`)).body;
                } catch (error) {
                  body.replaceChildren(errorBox(error));
                  loaded = false;
                }
              },
            },
            h('summary', {}, doc.title),
            body,
          );
        }),
      );
    } catch (error) {
      legalBox.replaceChildren(errorBox(error));
    }
  }
  loadLegal(wanted);
  fillSide(wanted);

  onSubmit(form, box, async (data) => {
    const result = await api('POST', '/auth/register', {
      body: { role: data.get('role'), phone: String(data.get('phone')).trim(), password: data.get('password'), displayName: String(data.get('displayName')).trim(), language: lang(), acceptTerms: data.get('acceptTerms') === 'on' },
    });
    session.token = result.accessToken;
    session.user = result.user;
    go(dashboardFor(result.user));
  });
  return h('div', { class: 'auth' }, form, side);
}

export async function login(ctx) {
  if (session.user) return go(dashboardFor(session.user), true);
  const box = h('div');
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('login.title')),
    field(t('reg.phone'), input('phone', { type: 'tel', required: true, inputmode: 'numeric', autocomplete: 'tel' })),
    field(t('reg.password'), input('password', { type: 'password', required: true, autocomplete: 'current-password' })),
    box,
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary big' }, t('login.submit')), link('/register', t('login.new'))),
  );
  onSubmit(form, box, async (data) => {
    const result = await api('POST', '/auth/login', { body: { phone: String(data.get('phone')).trim(), password: data.get('password') } });
    session.token = result.accessToken;
    session.user = result.user;
    const next = ctx.params.get('next');
    go(next && next.startsWith('/') && !next.startsWith('//') ? next : dashboardFor(result.user));
  });
  return h('div', { class: 'auth' }, form, h('aside', { class: 'auth-side' }, h('h2', {}, t('login.side.title')), h('p', {}, t('login.side.body'))));
}
