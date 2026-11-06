// Home, register and sign in (WORKFLOW.md 9.2, 9.3).

import { api, session } from '../api.js';
import { h } from '../dom.js';
import { lang, t } from '../i18n.js';
import { go } from '../router.js';
import { errorBox, field, input, link, onSubmit } from './common.js';

export function dashboardFor(user) {
  return user.role === 'contractor' ? '/application' : '/projects';
}

export async function home() {
  if (session.user) return go(dashboardFor(session.user), true);
  const step = (n) => h('div', { class: 'card' }, h('h3', {}, t(`home.s${n}.title`)), h('p', { class: 'muted' }, t(`home.s${n}.body`)));
  return h(
    'section',
    { class: 'hero' },
    h('h1', {}, t('home.title')),
    h('p', { class: 'lead' }, t('home.lead')),
    h('div', { class: 'actions' }, link('/register', t('home.cta.homeowner'), 'btn primary'), link('/register?role=contractor', t('home.cta.contractor'), 'btn')),
    h('div', { class: 'grid3' }, step(1), step(2), step(3)),
    h('div', { class: 'card' }, h('h3', {}, t('home.nobid.title')), h('p', {}, t('home.nobid.body'))),
  );
}

export async function register(ctx) {
  if (session.user) return go(dashboardFor(session.user), true);
  const wanted = ctx.params.get('role') === 'contractor' ? 'contractor' : 'homeowner';
  const box = h('div');
  const legalBox = h('div');
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('reg.title')),
    field(
      t('reg.role'),
      h(
        'div',
        { class: 'checks' },
        ['homeowner', 'contractor'].map((r) =>
          h('label', { class: 'check' }, h('input', { type: 'radio', name: 'role', value: r, checked: r === wanted, onchange: () => loadLegal(r) }), t(`role.${r}`)),
        ),
      ),
    ),
    field(t('reg.phone'), input('phone', { type: 'tel', required: true, inputmode: 'numeric', autocomplete: 'tel', placeholder: '13800138000' }), t('reg.phone.hint')),
    field(t('reg.name'), input('displayName', { required: true, maxlength: 40, autocomplete: 'name' })),
    field(t('reg.password'), input('password', { type: 'password', required: true, minlength: 8, maxlength: 128, autocomplete: 'new-password' }), t('reg.password.hint')),
    legalBox,
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'acceptTerms', required: true }), t('reg.accept')),
    box,
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, t('reg.submit')), link('/login', t('reg.have'))),
  );

  async function loadLegal(role) {
    legalBox.replaceChildren(h('p', { class: 'muted' }, t('loading')));
    try {
      const list = await api('GET', `/legal?lang=${lang()}&role=${role}`);
      legalBox.replaceChildren(
        h('p', { class: 'alert alert-warn small' }, t('legal.draft')),
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
                  const text = await api('GET', `/legal/${doc.document}?lang=${lang()}`);
                  body.textContent = text.body;
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

  onSubmit(form, box, async (data) => {
    const result = await api('POST', '/auth/register', {
      body: {
        role: data.get('role'),
        phone: String(data.get('phone')).trim(),
        password: data.get('password'),
        displayName: String(data.get('displayName')).trim(),
        language: lang(),
        acceptTerms: data.get('acceptTerms') === 'on',
      },
    });
    session.token = result.accessToken;
    session.user = result.user;
    go(dashboardFor(result.user));
  });
  return form;
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
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, t('login.submit')), link('/register', t('login.new'))),
  );
  onSubmit(form, box, async (data) => {
    const result = await api('POST', '/auth/login', { body: { phone: String(data.get('phone')).trim(), password: data.get('password') } });
    session.token = result.accessToken;
    session.user = result.user;
    const next = ctx.params.get('next');
    go(next && next.startsWith('/') && !next.startsWith('//') ? next : dashboardFor(result.user));
  });
  return form;
}
