// Contractor screens: the application and its review status, invitations, the sealed quote and
// the answer (WORKFLOW.md 9.3). Also the one invitation page both sides open from a link.

import { api, ApiError, session } from '../api.js';
import { h } from '../dom.js';
import { label, t } from '../i18n.js';
import { go } from '../router.js';
import {
  STYLES, TYPES, briefFacts, checks, facts, field, input, link, num, okBox, onSubmit, options, profileCard, quoteBlock, statusChip, str, textarea, timeLeft,
} from './common.js';

const split = (value) => String(value ?? '').split(/[,，、;；\s]+/).map((s) => s.trim()).filter(Boolean);

function repeater(title, addLabel, makeRow, initial) {
  const rows = h('div');
  const add = (values = {}) => {
    const row = makeRow(values);
    row.append(h('button', { type: 'button', class: 'link', onclick: () => row.remove() }, t('remove')));
    rows.append(row);
  };
  for (const item of initial) add(item);
  return h('div', {}, h('h3', {}, title), rows, h('button', { type: 'button', onclick: () => add() }, addLabel));
}

function readRows(form, prefix, keys) {
  return [...form.querySelectorAll(`[data-row="${prefix}"]`)].map((row) => Object.fromEntries(keys.map((k) => [k, row.querySelector(`[name="${k}"]`).value])));
}

export async function application() {
  let profile = null;
  try {
    profile = await api('GET', '/contractors/me');
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  const box = h('div');
  const status = profile?.status ?? 'none';
  const qualRows = (values) => h('div', { class: 'repeat', 'data-row': 'qual' },
    field(t('app.qual.name'), input('name', { value: values.name ?? '', maxlength: 80 })),
    h('div', { class: 'row2' }, field(t('app.qual.number'), input('number', { value: values.number ?? '', maxlength: 60 })), field(t('app.qual.until'), input('validUntil', { type: 'date', value: values.validUntil ?? '' }))));
  const pastRows = (values) => h('div', { class: 'repeat', 'data-row': 'past' },
    field(t('app.past.title'), input('title', { value: values.title ?? '', maxlength: 80 })),
    h('div', { class: 'row2' }, field(t('p.district'), input('district', { value: values.district ?? '', maxlength: 40 })), field(t('app.past.year'), input('year', { type: 'number', value: values.year ?? '', min: 1980, max: 2100 }))),
    field(t('p.desc'), input('description', { value: values.description ?? '', maxlength: 1000 })));

  const form = h(
    'form',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h1', {}, t('app.title')), status === 'none' ? null : statusChip(status)),
    status === 'none' ? h('p', { class: 'alert alert-warn' }, t('app.new')) : null,
    status === 'pending' ? h('p', { class: 'alert alert-warn' }, t('app.pending')) : null,
    status === 'verified' ? h('p', { class: 'alert alert-ok' }, t('app.verified')) : null,
    status === 'rejected' || status === 'suspended' ? h('p', { class: 'alert alert-error' }, t(`app.${status}`)) : null,
    profile?.reviewNote ? h('p', {}, `${t('app.note')}: ${profile.reviewNote}`) : null,
    h('div', { class: 'row2' }, field(t('app.company'), input('companyName', { required: true, maxlength: 80, value: profile?.companyName ?? '' })), field(t('f.kind'), h('select', { name: 'kind', value: profile?.kind ?? 'company' }, ['company', 'team'].map((k) => h('option', { value: k }, label('kind', k)))))),
    field(t('f.licence'), input('licenceNumber', { required: true, maxlength: 18, minlength: 18, value: profile?.licenceNumber ?? '', placeholder: '91310115MA1K4A2B3C' }), t('app.licence.hint')),
    h('div', { class: 'row2' }, field(t('f.city'), input('city', { required: true, maxlength: 40, value: profile?.city ?? '' })), field(t('app.districts'), input('districts', { required: true, value: profile?.districts.join('、') ?? '' }), t('app.districts.hint'))),
    field(t('f.types'), checks('renovationTypes', options('type', TYPES), profile?.renovationTypes ?? [])),
    field(t('f.styles'), checks('styles', options('style', STYLES), profile?.styles ?? [])),
    h('div', { class: 'row2' }, field(t('app.priceMin'), input('priceMinCnyPerM2', { type: 'number', min: 0, step: '1', value: profile?.priceMinCnyPerM2 ?? '' })), field(t('app.priceMax'), input('priceMaxCnyPerM2', { type: 'number', min: 0, step: '1', value: profile?.priceMaxCnyPerM2 ?? '' }))),
    h('div', { class: 'row3' },
      field(t('f.years'), input('yearsInBusiness', { type: 'number', required: true, min: 0, max: 100, value: profile?.yearsInBusiness ?? '' })),
      field(t('f.team'), input('teamSize', { type: 'number', required: true, min: 1, value: profile?.teamSize ?? '' })),
      field(t('app.capacity'), input('maxConcurrentProjects', { type: 'number', required: true, min: 1, max: 100, value: profile?.maxConcurrentProjects ?? '' }), t('app.capacity.hint')),
    ),
    field(t('p.desc'), textarea('description', { maxlength: 2000, value: profile?.description ?? '' })),
    repeater(t('f.quals'), t('add'), qualRows, profile?.qualifications.length ? profile.qualifications : [{}]),
    repeater(t('app.past'), t('add'), pastRows, profile?.pastProjects.length ? profile.pastProjects : [{}, {}, {}]),
    h('p', { class: 'small muted' }, t('app.recheck')),
    box,
    h('button', { type: 'submit', class: 'primary' }, t('app.save')),
  );
  onSubmit(form, box, async (data) => {
    const body = {
      companyName: str(data.get('companyName')),
      kind: data.get('kind'),
      licenceNumber: str(data.get('licenceNumber')),
      qualifications: readRows(form, 'qual', ['name', 'number', 'validUntil'])
        .filter((q) => q.name.trim())
        .map((q) => ({ name: q.name.trim(), number: str(q.number), validUntil: str(q.validUntil) })),
      city: str(data.get('city')),
      districts: split(data.get('districts')),
      renovationTypes: data.getAll('renovationTypes'),
      styles: data.getAll('styles'),
      priceMinCnyPerM2: num(data.get('priceMinCnyPerM2')),
      priceMaxCnyPerM2: num(data.get('priceMaxCnyPerM2')),
      yearsInBusiness: num(data.get('yearsInBusiness')),
      teamSize: num(data.get('teamSize')),
      maxConcurrentProjects: num(data.get('maxConcurrentProjects')),
      description: str(data.get('description')) ?? '',
      pastProjects: readRows(form, 'past', ['title', 'district', 'year', 'description'])
        .filter((p) => p.title.trim())
        .map((p) => ({ title: p.title.trim(), district: str(p.district), year: num(p.year), description: str(p.description) })),
    };
    await api('PUT', '/contractors/me', { body });
    go('/application', true);
  });
  return h('section', {}, form);
}

export async function invitationsList() {
  const list = await api('GET', '/invitations/mine');
  return h(
    'section',
    {},
    h('h1', {}, t('inv.mine')),
    list.length === 0
      ? h('div', { class: 'card' }, h('p', {}, t('inv.mine.empty')))
      : list.map((inv) =>
          h(
            'div',
            { class: 'card' },
            h('div', { class: 'card-head' }, h('h3', {}, link(`/invitations/${inv.id}`, inv.project.title)), statusChip(inv.status)),
            h('p', { class: 'muted' }, `${inv.project.city} · ${inv.project.district} · ${inv.project.floorAreaM2} m²`),
            inv.status === 'invited' ? h('p', { class: 'small' }, t('inv.answer.in'), ' ', timeLeft(inv.expiresAt)) : null,
          ),
        ),
  );
}

/** One invitation, by its link: the invited team sees the brief and answers; the homeowner sees the team. */
export async function invitationDetail(ctx) {
  const inv = await api('GET', `/invitations/${ctx.args.id}`);
  return session.user.role === 'contractor' ? teamView(inv) : ownerView(inv);
}

function ownerView(inv) {
  return h(
    'section',
    {},
    link(`/projects/${inv.projectId}`, t('back')),
    h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h1', {}, inv.contractor.companyName), statusChip(inv.status)), quoteBlock(inv.quote), inv.contact ? facts([[t('contact.name'), inv.contact.name], [t('contact.phone'), inv.contact.phone]]) : null),
    h('div', { class: 'card' }, profileCard(inv.contractor)),
  );
}

function teamView(inv) {
  const answering = inv.status === 'invited' || inv.status === 'quoted';
  const box = h('div');
  const reload = () => go(location.pathname, true);
  const q = inv.quote;
  const quoteForm = h(
    'form',
    { class: 'card' },
    h('h2', {}, inv.quote ? t('quote.revise') : t('quote.give')),
    h('p', { class: 'small muted' }, t('quote.sealed')),
    field(t('q.total'), input('priceCny', { type: 'number', required: true, min: 1000, max: 100000000, step: '1', value: q?.priceCny ?? '' }), t('quote.total.hint')),
    h('div', { class: 'row3' },
      field(t('q.labour'), input('labourCny', { type: 'number', min: 0, step: '1', value: q?.labourCny ?? '' })),
      field(t('q.materials'), input('materialsCny', { type: 'number', min: 0, step: '1', value: q?.materialsCny ?? '' })),
      field(t('q.fee'), input('managementFeeCny', { type: 'number', min: 0, step: '1', value: q?.managementFeeCny ?? '' })),
    ),
    h('div', { class: 'row2' },
      field(t('q.days'), input('durationDays', { type: 'number', required: true, min: 1, max: 1000, value: q?.durationDays ?? '' })),
      field(t('q.start'), input('earliestStart', { type: 'date', required: true, min: new Date().toISOString().slice(0, 10), value: q?.earliestStart ?? '' })),
    ),
    field(t('q.main'), textarea('mainMaterials', { rows: 2, maxlength: 2000, value: q?.mainMaterials ?? '' })),
    field(t('q.note'), textarea('note', { rows: 3, maxlength: 5000, value: q?.note ?? '' }), t('quote.nocontact')),
    box,
    h('button', { type: 'submit', class: 'primary' }, inv.quote ? t('quote.save') : t('quote.send')),
  );
  onSubmit(quoteForm, box, async (data) => {
    await api('PUT', `/invitations/${inv.id}/quote`, {
      body: {
        priceCny: num(data.get('priceCny')),
        labourCny: num(data.get('labourCny')),
        materialsCny: num(data.get('materialsCny')),
        managementFeeCny: num(data.get('managementFeeCny')),
        durationDays: num(data.get('durationDays')),
        earliestStart: data.get('earliestStart'),
        mainMaterials: str(data.get('mainMaterials')),
        note: str(data.get('note')),
      },
    });
    reload();
  });
  const declineBox = h('div');
  const declineForm = h(
    'form',
    { class: 'card' },
    h('h3', {}, t('decline.title')),
    field(t('inv.reason'), textarea('reason', { rows: 2, maxlength: 500 })),
    declineBox,
    h('button', { type: 'submit', class: 'danger' }, t('decline.button')),
  );
  onSubmit(declineForm, declineBox, async (data) => {
    if (!confirm(t('decline.confirm'))) return;
    await api('POST', `/invitations/${inv.id}/decline`, { body: { reason: str(data.get('reason')) } });
    reload();
  });
  return h(
    'section',
    {},
    link('/invitations', t('back')),
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h1', {}, inv.project.title), statusChip(inv.status)),
      inv.status === 'invited' ? h('p', { class: 'small' }, t('inv.answer.in'), ' ', timeLeft(inv.expiresAt)) : null,
      inv.status === 'selected' ? okBox(t('inv.won')) : null,
      inv.status === 'not-selected' ? h('p', { class: 'alert alert-warn' }, t('inv.lost')) : null,
      inv.message ? h('p', {}, `${t('inv.message')}: ${inv.message}`) : null,
      briefFacts(inv.project),
      h('p', { class: 'small muted' }, t('inv.brief.note')),
      inv.homeowner ? facts([[t('contact.name'), inv.homeowner.name], [t('contact.phone'), inv.homeowner.phone]]) : null,
    ),
    inv.quote && !answering ? h('div', { class: 'card' }, h('h3', {}, t('quote.yours')), quoteBlock(inv.quote)) : null,
    answering ? quoteForm : null,
    inv.status === 'invited' ? declineForm : null,
    inv.status === 'declined' && inv.declineReason ? h('p', { class: 'muted' }, `${t('inv.reason')}: ${inv.declineReason}`) : null,
  );
}

