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

function landingHero() {
  const base = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
  const second = h('video', { class: 'landing-video', muted: true, playsinline: true, preload: 'metadata', src: `${base}hf_20260624_055914_ee2b3b56-9a58-4885-989e-5b72a68b630d.mp4`, 'aria-hidden': 'true' });
  const first = h('video', { class: 'landing-video landing-video-first', muted: true, playsinline: true, autoplay: true, loop: true, src: `${base}hf_20260625_174131_395bc785-bb21-4e65-abf6-27c56f0764b6.mp4`, 'aria-hidden': 'true' });
  const introImage = h('img', { src: '/landing-fallback.png', alt: '' });
  const intro = h('div', { class: 'landing-intro', 'aria-hidden': 'true' }, introImage);
  first.addEventListener('playing', () => {
    const reveal = () => intro.classList.add('is-playing');
    if (introImage.complete && introImage.naturalWidth) reveal();
    else introImage.addEventListener('load', reveal, { once: true });
  }, { once: true });
  second.muted = first.muted = true;
  const hero = h('section', { class: 'landing-hero' }, h('div', { class: 'landing-sticky' },
    second, first, intro, h('div', { class: 'landing-transition', 'aria-hidden': 'true' }), h('div', { class: 'landing-shade' }),
    h('div', { class: 'landing-emblem', 'aria-hidden': 'true' }, h('img', { class: 'brand-emblem', src: '/homora-icon.png', alt: '' })),
    h('div', { class: 'landing-copy' }, h('p', { class: 'landing-eyebrow' }, lang() === 'en' ? 'HOMORA · HOME DESIGN & RENOVATION' : '予舍 · 住宅设计与装修'), h('h1', {}, t('home.title')), h('p', { class: 'landing-lead' }, t('home.lead')),
      h('div', { class: 'actions landing-actions' }, link('/register', [t('home.cta.homeowner'), icon('arrow')], 'btn light big'), link('/register?role=contractor', t('home.cta.contractor'), 'btn ghost big'))),
  ));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lifecycle = new AbortController();
  let scrolled = false;
  let pauseTimer;
  const updatePlayback = () => {
    first.pause(); second.pause();
    if (!document.hidden && !reduced.matches && hero.isConnected) (scrolled ? second : first).play().catch(() => {});
  };
  const scroll = () => {
    if (!hero.isConnected) { window.removeEventListener('scroll', scroll); return; }
    document.querySelector('.landing-bar')?.classList.toggle('over-content', hero.getBoundingClientRect().bottom < 100);
    const next = window.scrollY > 0;
    if (next === scrolled || reduced.matches) return;
    scrolled = next;
    clearTimeout(pauseTimer);
    if (next) {
      second.currentTime = 0; second.play().catch(() => {});
      pauseTimer = setTimeout(() => first.pause(), 700);
    } else {
      second.pause(); first.play().catch(() => {});
    }
    first.classList.toggle('is-scrolled', next);
  };
  if (reduced.matches) { first.autoplay = false; first.pause(); }
  window.addEventListener('scroll', scroll, { passive: true, signal: lifecycle.signal });
  document.addEventListener('visibilitychange', updatePlayback, { signal: lifecycle.signal });
  reduced.addEventListener('change', updatePlayback, { signal: lifecycle.signal });
  hero.disposeLanding = () => { clearTimeout(pauseTimer); lifecycle.abort(); first.pause(); second.pause(); };
  return hero;
}

export async function home() {
  const feature = (name, key) => h('div', { class: 'feature' }, h('div', { class: 'ico-box' }, icon(name)), h('h3', {}, t(`home.f.${key}.title`)), h('p', { class: 'muted' }, t(`home.f.${key}.body`)));
  const faq = (n) => h('details', {}, h('summary', {}, t(`home.q${n}`)), h('p', { class: 'muted' }, t(`home.a${n}`)));
  return h(
    'div',
    { class: 'stack landing-page' },
    landingHero(),
    h('div', { class: 'landing-benefits' }, ['shield', 'sealed', 'lock', 'scale'].map((name, i) => h('span', {}, icon(name), t(`home.pill${i + 1}`)))),
    h('section', { class: 'home-editorial' }, h('p', { class: 'editorial-kicker' }, '01 / THE HOMORA WAY'), h('h2', {}, t('home.editorial.title')), h('p', { class: 'muted' }, t('home.editorial.body'))),
    h('section', { class: 'grid3 home-features' }, feature('pin', 'match'), feature('sealed', 'sealed'), feature('lock', 'contact')),
    h(
      'section',
      { class: 'band home-process' },
      h('p', { class: 'editorial-kicker' }, '02 / FROM IDEA TO HOME'),
      h('h2', {}, t('home.how.title')),
      h('ol', { class: 'steps-list' }, [1, 2, 3, 4].map((n) => h('li', {}, h('strong', {}, t(`home.step${n}.title`)), h('p', { class: 'muted' }, t(`home.step${n}.body`))))),
    ),
    h('section', { class: 'band home-note' }, h('h2', {}, t('home.nobid.title')), h('p', {}, t('home.nobid.body'))),
    h('section', { class: 'band home-faq' }, h('p', { class: 'editorial-kicker' }, '03 / A LITTLE CLARITY'), h('h2', {}, t('home.faq')), faq(1), faq(2), faq(3), faq(4)),
    h('section', { class: 'band home-join' }, h('p', { class: 'editorial-kicker' }, 'BUILT TOGETHER'), h('h2', {}, t('home.contractor.title')), h('p', { class: 'muted' }, t('home.contractor.body')), link('/register?role=contractor', t('home.cta.contractor'), 'btn primary')),
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
