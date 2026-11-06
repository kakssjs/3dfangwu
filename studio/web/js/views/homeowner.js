// Homeowner screens: my projects, a new project, matches, invitations and quotes, the pick, and
// browsing verified contractors (WORKFLOW.md 9.2).

import { api, query } from '../api.js';
import { h } from '../dom.js';
import { label, t } from '../i18n.js';
import { go } from '../router.js';
import {
  STYLES, TYPES, briefFacts, cny, errorBox, facts, field, input, link, loading, num, okBox, onSubmit, options, profileCard, quoteBlock, range, select, statusChip, str, textarea, timeLeft,
} from './common.js';

const MAX_LIVE = 3;

export async function projectsList() {
  const projects = await api('GET', '/projects/mine');
  return h(
    'section',
    {},
    h('div', { class: 'card-head' }, h('h1', {}, t('proj.mine')), link('/projects/new', t('proj.new'), 'btn primary')),
    projects.length === 0
      ? h('div', { class: 'card' }, h('p', {}, t('proj.empty')), link('/projects/new', t('proj.new'), 'btn primary'))
      : projects.map((p) =>
          h(
            'div',
            { class: 'card' },
            h('div', { class: 'card-head' }, h('h3', {}, link(`/projects/${p.id}`, p.title)), statusChip(p.status)),
            h('p', { class: 'muted' }, `${p.city} · ${p.district} · ${p.floorAreaM2} m² · ${range(p.budgetMinCny, p.budgetMaxCny)}`),
            h('p', { class: 'small' }, t('proj.counts', { live: p.liveInvitations, quotes: p.quoteCount })),
          ),
        ),
  );
}

export async function projectNew() {
  const box = h('div');
  const today = new Date().toISOString().slice(0, 10);
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('proj.new')),
    h('p', { class: 'alert alert-warn small' }, t('proj.privacy')),
    field(t('p.title'), input('title', { required: true, minlength: 2, maxlength: 80 })),
    h('div', { class: 'row2' }, field(t('f.city'), input('city', { required: true, maxlength: 40, placeholder: '上海' })), field(t('p.district'), input('district', { required: true, maxlength: 40, placeholder: '浦东新区' }))),
    h('div', { class: 'row3' },
      field(t('p.area'), input('floorAreaM2', { type: 'number', required: true, min: 5, max: 10000, step: '0.01' }), 'm²'),
      field(t('p.layout'), input('layout', { maxlength: 40, placeholder: '3室2厅2卫' })),
      field(t('p.type'), select('renovationType', options('type', TYPES), 'old-home', { required: true })),
    ),
    field(t('p.style'), select('style', [['', t('p.style.none')], ...options('style', STYLES)], '')),
    h('div', { class: 'row3' },
      field(t('p.budgetMin'), input('budgetMinCny', { type: 'number', required: true, min: 1, step: '1' })),
      field(t('p.budgetMax'), input('budgetMaxCny', { type: 'number', required: true, min: 1, step: '1' })),
      field(t('p.start'), input('desiredStart', { type: 'date', required: true, min: today })),
    ),
    field(t('p.desc'), textarea('description', { required: true, minlength: 10, maxlength: 5000 }), t('p.desc.hint')),
    box,
    h('button', { type: 'submit', class: 'primary' }, t('proj.save')),
  );
  onSubmit(form, box, async (data) => {
    const body = {
      title: str(data.get('title')),
      city: str(data.get('city')),
      district: str(data.get('district')),
      floorAreaM2: num(data.get('floorAreaM2')),
      layout: str(data.get('layout')),
      renovationType: data.get('renovationType'),
      style: str(data.get('style')),
      budgetMinCny: num(data.get('budgetMinCny')),
      budgetMaxCny: num(data.get('budgetMaxCny')),
      desiredStart: data.get('desiredStart'),
      description: str(data.get('description')),
    };
    const created = await api('POST', '/projects', { body });
    go(`/projects/${created.id}`);
  });
  return form;
}

export async function projectDetail(ctx) {
  const id = ctx.args.id;
  const project = await api('GET', `/projects/${id}`);
  const open = project.status === 'open';
  const reload = () => go(location.pathname, true);
  const notice = h('div');

  const matchesBox = h('div', {}, loading());
  const invitesBox = h('div', {}, loading());

  const sections = [
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h1', {}, project.title), statusChip(project.status)),
      briefFacts(project),
      h('p', { class: 'small muted' }, t('proj.link'), ' ', location.origin + location.pathname),
      open
        ? h('button', { class: 'danger', onclick: async () => {
            if (!confirm(t('proj.close.confirm'))) return;
            try {
              await api('POST', `/projects/${id}/close`);
              reload();
            } catch (error) {
              notice.replaceChildren(errorBox(error));
            }
          } }, t('proj.close'))
        : null,
    ),
    notice,
  ];

  if (project.selected) {
    sections.push(
      h(
        'div',
        { class: 'card' },
        h('h2', {}, t('pick.done')),
        h('p', {}, project.selected.companyName),
        facts([[t('contact.name'), project.selected.contact.name], [t('contact.phone'), project.selected.contact.phone]]),
        h('p', { class: 'small muted' }, t('pick.contact.note')),
        link(`/invitations/${project.selected.invitationId}`, t('inv.open')),
      ),
    );
  }
  if (project.status === 'closed') sections.push(okBox(t('proj.closed.note')));

  if (open) {
    sections.push(h('h2', {}, t('match.title')), h('p', { class: 'muted' }, t('match.how', { max: MAX_LIVE })), matchesBox);
  }
  sections.push(h('h2', {}, t('inv.title')), h('p', { class: 'small muted' }, t('inv.order')), invitesBox);

  // The shortlist and the invitations load after the page, so a slow list doesn't hide the project.
  queueMicrotask(async () => {
    try {
      const invitations = await api('GET', `/projects/${id}/invitations`);
      invitesBox.replaceChildren(
        ...(invitations.length === 0
          ? [h('p', { class: 'muted' }, t('inv.none'))]
          : invitations.map((inv) => invitationCard(project, inv, notice, reload))),
      );
      if (open) {
        const matches = await api('GET', `/projects/${id}/matches`);
        const full = project.liveInvitations >= MAX_LIVE;
        matchesBox.replaceChildren(
          ...(full ? [h('p', { class: 'alert alert-warn' }, t('match.full', { max: MAX_LIVE }))] : []),
          ...(matches.length === 0
            ? [h('p', { class: 'muted' }, t('match.none'))]
            : matches.map((m) => matchCard(id, m, full, notice, reload))),
        );
      }
    } catch (error) {
      invitesBox.replaceChildren(errorBox(error));
      matchesBox.replaceChildren();
    }
  });
  return h('section', {}, sections);
}

function matchCard(projectId, match, full, notice, reload) {
  const form = h(
    'form',
    { class: 'inline-form' },
    field(t('inv.message'), textarea('message', { rows: 2, maxlength: 1000 }), t('inv.message.hint')),
    h('button', { type: 'submit', class: 'primary', disabled: full }, t('match.invite')),
  );
  onSubmit(form, notice, async (data) => {
    await api('POST', `/projects/${projectId}/invitations`, { body: { contractorId: match.contractor.id, message: str(data.get('message')) } });
    reload();
  });
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('strong', {}, t('match.fit')), statusChip(match.fit)),
    h('ul', { class: 'plain' }, match.reasons.map((r) => h('li', { class: `reason-${r.result}` }, h('strong', {}, `${label('factor', r.factor)}: ${label('result', r.result)}`), ' ', h('span', { class: 'muted small' }, r.note)))),
    profileCard(match.contractor),
    form,
  );
}

function invitationCard(project, inv, notice, reload) {
  const canPick = project.status === 'open' && inv.status === 'quoted';
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, link(`/invitations/${inv.id}`, inv.contractor.companyName)), statusChip(inv.status)),
    inv.status === 'invited' ? h('p', { class: 'small muted' }, t('inv.waiting'), ' · ', timeLeft(inv.expiresAt)) : null,
    inv.status === 'declined' && inv.declineReason ? h('p', { class: 'small muted' }, `${t('inv.reason')}: ${inv.declineReason}`) : null,
    quoteBlock(inv.quote),
    inv.contact ? facts([[t('contact.name'), inv.contact.name], [t('contact.phone'), inv.contact.phone]]) : null,
    h('details', {}, h('summary', {}, t('inv.profile')), profileCard(inv.contractor)),
    canPick
      ? h('button', { class: 'primary', onclick: async () => {
          if (!confirm(t('pick.confirm', { name: inv.contractor.companyName, price: cny(inv.quote.priceCny) }))) return;
          try {
            await api('POST', `/projects/${project.id}/selection`, { body: { invitationId: inv.id } });
            reload();
          } catch (error) {
            notice.replaceChildren(errorBox(error));
          }
        } }, t('pick.button'))
      : null,
  );
}

export async function browse(ctx) {
  const filters = { city: ctx.params.get('city') ?? '', district: ctx.params.get('district') ?? '', renovationType: ctx.params.get('renovationType') ?? '' };
  const list = h('div', {}, loading());
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('browse.title')),
    h('div', { class: 'row3' },
      field(t('f.city'), input('city', { value: filters.city })),
      field(t('p.district'), input('district', { value: filters.district })),
      field(t('p.type'), select('renovationType', [['', t('any')], ...options('type', TYPES)], filters.renovationType)),
    ),
    h('button', { type: 'submit', class: 'primary' }, t('browse.search')),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    go(`/browse${query({ city: str(data.get('city')), district: str(data.get('district')), renovationType: str(data.get('renovationType')) })}`);
  });
  queueMicrotask(async () => {
    try {
      const found = await api('GET', `/contractors${query(filters)}`);
      list.replaceChildren(
        ...(found.length === 0
          ? [h('p', { class: 'muted' }, t('browse.none'))]
          : found.map((p) => h('div', { class: 'card' }, profileCard(p), link(`/browse/${p.id}`, t('browse.open'))))),
      );
    } catch (error) {
      list.replaceChildren(errorBox(error));
    }
  });
  return h('section', {}, form, list);
}

export async function browseDetail(ctx) {
  const profile = await api('GET', `/contractors/${ctx.args.id}`);
  return h('section', {}, link('/browse', t('back')), h('div', { class: 'card' }, profileCard(profile)));
}

