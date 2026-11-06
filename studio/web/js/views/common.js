// Pieces every screen shares: links, formatting, status chips, form fields and error text.

import { ApiError } from '../api.js';
import { h } from '../dom.js';
import { label, lang, t } from '../i18n.js';

export const TYPES = ['new-home', 'old-home', 'partial'];
export const STYLES = ['modern-minimalist', 'cream', 'natural-wood', 'new-chinese', 'nordic', 'modern-luxury', 'industrial', 'wabi-sabi'];

export const link = (href, text, cls = '') => h('a', { href, 'data-link': true, class: cls }, text);

const locale = () => (lang() === 'en' ? 'en-US' : 'zh-CN');
export const cny = (n) => (n === null || n === undefined ? '—' : `¥${Number(n).toLocaleString(locale())}`);
export const day = (value) => (value ? new Date(value).toLocaleDateString(locale()) : '—');
export const range = (a, b) => `${cny(a)} – ${cny(b)}`;

export const chip = (kind, text) => h('span', { class: `chip chip-${kind}` }, text);

const KINDS = {
  open: 'info', awarded: 'ok', closed: 'muted',
  invited: 'info', declined: 'muted', quoted: 'warn', selected: 'ok', 'not-selected': 'muted', expired: 'muted',
  pending: 'warn', verified: 'ok', rejected: 'bad', suspended: 'bad',
  todo: 'info', doing: 'info', done: 'ok', failed: 'bad', escalated: 'warn',
  strong: 'ok', good: 'info', possible: 'muted',
};
export const statusChip = (status) => chip(KINDS[status] ?? 'muted', label('status', status));

export const loading = () => h('p', { class: 'muted' }, t('loading'));

/** The interface's own text for each error (WORKFLOW.md 9.1); the server's detail follows for 400 and 409. */
export function describe(error) {
  if (!(error instanceof ApiError)) return String(error?.message ?? error);
  if (error.status === 0) return t('err.offline');
  const known = [400, 401, 403, 404, 409, 429];
  const base = known.includes(error.status) ? t(`err.${error.status}`) : t('err.500');
  return [400, 409].includes(error.status) && error.message ? `${base} — ${error.message}` : base;
}
export const errorBox = (error) => h('div', { class: 'alert alert-error', role: 'alert' }, describe(error));
export const okBox = (text) => h('div', { class: 'alert alert-ok', role: 'status' }, text);

/** Shows how many whole days or hours are left until `iso`. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t('expired');
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 48 ? t('days.left', { n: Math.floor(hours / 24) }) : t('hours.left', { n: Math.max(1, hours) });
}

export function facts(pairs) {
  const dl = h('dl', { class: 'facts' });
  for (const [name, value] of pairs) {
    if (value === null || value === undefined || value === '') continue;
    dl.append(h('dt', {}, name), h('dd', {}, value));
  }
  return dl;
}

// ---- form fields ----

export const field = (text, control, hint) =>
  h('label', { class: 'field' }, h('span', { class: 'field-label' }, text), control, hint ? h('small', { class: 'muted' }, hint) : null);

const OPTION_KEYS = ['required', 'minlength', 'maxlength', 'min', 'max', 'step', 'placeholder', 'autocomplete', 'inputmode', 'value'];
export function input(name, options = {}) {
  const props = { name, type: options.type ?? 'text' };
  for (const key of OPTION_KEYS) if (options[key] !== undefined && options[key] !== null) props[key] = options[key];
  return h('input', props);
}
export const textarea = (name, options = {}) =>
  h('textarea', { name, rows: options.rows ?? 4, required: options.required, minlength: options.minlength, maxlength: options.maxlength }, options.value ?? '');
export const select = (name, options, value, extra = {}) =>
  h('select', { name, value, required: extra.required }, options.map(([v, text]) => h('option', { value: v }, text)));
export const checks = (name, options, values = []) =>
  h('div', { class: 'checks' }, options.map(([v, text]) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name, value: v, checked: values.includes(v) }), text)));
export const options = (group, list) => list.map((v) => [v, label(group, v)]);

/** Runs `work(formData)` on submit, with the buttons off meanwhile and any error shown in `box`. */
export function onSubmit(form, box, work) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const buttons = [...form.querySelectorAll('button[type=submit]')];
    for (const b of buttons) b.disabled = true;
    box.replaceChildren();
    try {
      await work(new FormData(form));
    } catch (error) {
      box.replaceChildren(errorBox(error));
    } finally {
      for (const b of buttons) b.disabled = false;
    }
  });
}

/** Optional number from a form value: empty gives undefined. */
export const num = (value) => (value === null || value === undefined || String(value).trim() === '' ? undefined : Number(value));
export const str = (value) => (value === null || value === undefined || String(value).trim() === '' ? undefined : String(value).trim());

// ---- a contractor's public profile, shown to homeowners (matches, quotes, browsing) ----

export function profileCard(profile, extra = []) {
  const band = profile.priceMinCnyPerM2 !== null && profile.priceMaxCnyPerM2 !== null ? `${cny(profile.priceMinCnyPerM2)} – ${cny(profile.priceMaxCnyPerM2)} ${t('per.m2')}` : null;
  return h(
    'div',
    {},
    h('div', { class: 'card-head' }, h('h3', {}, profile.companyName), profile.verified === false ? null : chip('ok', t('verified'))),
    facts([
      [t('f.kind'), label('kind', profile.kind)],
      [t('f.city'), `${profile.city} · ${profile.districts.join('、')}`],
      [t('f.types'), profile.renovationTypes.map((v) => label('type', v)).join('、')],
      [t('f.styles'), profile.styles.map((v) => label('style', v)).join('、') || null],
      [t('f.price'), band],
      [t('f.years'), `${profile.yearsInBusiness}`],
      [t('f.team'), `${profile.teamSize}`],
      [t('f.licence'), profile.licenceNumber],
    ]),
    profile.qualifications.length
      ? h('p', { class: 'small' }, `${t('f.quals')}: `, profile.qualifications.map((q) => q.name).join('；'))
      : null,
    profile.description ? h('p', {}, profile.description) : null,
    profile.pastProjects.length
      ? h('details', {}, h('summary', {}, t('f.past', { n: profile.pastProjects.length })), h('ul', { class: 'plain' }, profile.pastProjects.map((p) => h('li', {}, [p.title, p.district, p.year].filter(Boolean).join(' · ')))))
      : null,
    ...extra,
  );
}

export function quoteBlock(quote) {
  if (!quote) return null;
  return h(
    'div',
    { class: 'quote' },
    h('strong', {}, `${t('q.total')}: ${cny(quote.priceCny)}`),
    facts([
      [t('q.labour'), quote.labourCny === null ? null : cny(quote.labourCny)],
      [t('q.materials'), quote.materialsCny === null ? null : cny(quote.materialsCny)],
      [t('q.fee'), quote.managementFeeCny === null ? null : cny(quote.managementFeeCny)],
      [t('q.days'), `${quote.durationDays}`],
      [t('q.start'), quote.earliestStart],
      [t('q.main'), quote.mainMaterials],
      [t('q.note'), quote.note],
    ]),
  );
}

export function briefFacts(project) {
  return facts([
    [t('f.city'), `${project.city} · ${project.district}`],
    [t('p.area'), `${project.floorAreaM2} m²`],
    [t('p.layout'), project.layout],
    [t('p.type'), label('type', project.renovationType)],
    [t('p.style'), project.style ? label('style', project.style) : null],
    [t('p.budget'), range(project.budgetMinCny, project.budgetMaxCny)],
    [t('p.start'), project.desiredStart],
    [t('p.desc'), project.description],
  ]);
}
