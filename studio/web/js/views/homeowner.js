// Homeowner screens: my projects, a new project, matches, invitations and quotes, the pick, and
// browsing verified contractors (WORKFLOW.md 9.2).

import { api, query, session } from '../api.js';
import { h } from '../dom.js';
import { label, t } from '../i18n.js';
import { go } from '../router.js';
import { communityPicker } from '../map.js';
import { avatar, empty, icon, placePicker, stageTracker, toBase64, uploadBox } from '../ui.js';
import {
  STYLES, TYPES, briefFacts, chip, cny, errorBox, facts, field, input, link, loading, noteBox, num, onSubmit, options, profileCard, quoteBlock, range, reasonList, sectionHead, select, statusChip, str, textarea, timeLeft,
} from './common.js';

const MAX_LIVE = 3;

/** Where a project is on the journey: the API tracks matching and the pick so far. */
const stageOf = (project) => (project.status === 'awarded' ? 'contract' : 'matching');

export async function projectsList() {
  const projects = await api('GET', '/projects/mine');
  return h(
    'section',
    {},
    h('div', { class: 'page-head' }, h('h1', {}, t('proj.mine')), link('/projects/new', [icon('plus'), t('proj.new')], 'btn primary')),
    projects.length === 0
      ? empty('home', t('proj.empty.title'), t('proj.empty'), link('/projects/new', [icon('plus'), t('proj.new')], 'btn primary'))
      : h(
          'div',
          { class: 'stack' },
          projects.map((p) =>
            h(
              'div',
              { class: 'card' },
              h('div', { class: 'card-head' }, h('h3', {}, link(`/projects/${p.id}`, p.title)), statusChip(p.status)),
              h('p', { class: 'muted small' }, `${p.city} · ${p.district} · ${p.floorAreaM2} m² · ${range(p.budgetMinCny, p.budgetMaxCny)}`),
              p.status === 'closed' ? null : stageTracker(stageOf(p)),
              h('div', { class: 'actions' }, h('span', { class: 'small' }, icon('inbox'), ' ', t('proj.counts', { live: p.liveInvitations, quotes: p.quoteCount })), link(`/projects/${p.id}`, [t('proj.open'), icon('arrow')], 'btn')),
            ),
          ),
        ),
  );
}

export async function projectNew() {
  const box = h('div');
  const place = await placePicker();
  // With an Amap key the home's community can be found on a map; without one the pickers do the job.
  const community = await communityPicker({ onChoose: (found) => place.set(found.city, found.district) });
  const today = new Date().toISOString().slice(0, 10);
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('proj.new')),
    noteBox('info', t('proj.privacy')),
    sectionHead(1, t('proj.s1')),
    community,
    place.el,
    sectionHead(2, t('proj.s2')),
    h('div', { class: 'row3' },
      field(t('p.area'), input('floorAreaM2', { type: 'number', required: true, min: 5, max: 10000, step: '0.01' }), 'm²'),
      field(t('p.layout'), input('layout', { maxlength: 40 }), t('p.layout.hint')),
      field(t('p.type'), select('renovationType', options('type', TYPES), 'old-home', { required: true })),
    ),
    field(t('p.style'), select('style', [['', t('p.style.none')], ...options('style', STYLES)], '')),
    sectionHead(3, t('proj.s3')),
    h('div', { class: 'row3' },
      field(t('p.budgetMin'), input('budgetMinCny', { type: 'number', required: true, min: 1, step: '1' })),
      field(t('p.budgetMax'), input('budgetMaxCny', { type: 'number', required: true, min: 1, step: '1' })),
      field(t('p.start'), input('desiredStart', { type: 'date', required: true, min: today })),
    ),
    sectionHead(4, t('proj.s4')),
    field(t('p.title'), input('title', { required: true, minlength: 2, maxlength: 80 })),
    field(t('p.desc'), textarea('description', { required: true, minlength: 10, maxlength: 5000, rows: 5 }), t('p.desc.hint')),
    box,
    h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary big' }, t('proj.save')), link('/projects', t('cancel'))),
  );
  onSubmit(form, box, async (data) => {
    const created = await api('POST', '/projects', {
      body: {
        title: str(data.get('title')), community: str(data.get('community')), city: data.get('city'), district: data.get('district'), floorAreaM2: num(data.get('floorAreaM2')), layout: str(data.get('layout')),
        renovationType: data.get('renovationType'), style: str(data.get('style')), budgetMinCny: num(data.get('budgetMinCny')), budgetMaxCny: num(data.get('budgetMaxCny')),
        desiredStart: data.get('desiredStart'), description: str(data.get('description')),
      },
    });
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
  const quotesBox = h('div', {}, loading());
  const matchesBox = h('div', {}, loading());
  const fail = (error) => notice.replaceChildren(errorBox(error));

  const summary = h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h1', {}, project.title), statusChip(project.status)),
    project.status === 'closed' ? null : stageTracker(stageOf(project)),
    briefFacts(project),
  );

  const side = h(
    'aside',
    { class: 'stack' },
    h('div', { class: 'card' }, h('h3', {}, t('files.plan.title')), h('p', { class: 'small muted' }, t('files.plan.body')), uploadBox({ projectId: id, label: t('files.plan.button'), hint: t('files.hint') })),
    h('div', { class: 'card' }, h('h3', {}, t('proj.link')), h('p', { class: 'small muted' }, location.origin + location.pathname)),
    open
      ? h('div', { class: 'card' }, h('h3', {}, t('proj.close')), h('p', { class: 'small muted' }, t('proj.close.body')), h('button', { class: 'danger', onclick: async () => {
          if (!confirm(t('proj.close.confirm'))) return;
          try {
            await api('POST', `/projects/${id}/close`);
            reload();
          } catch (error) {
            fail(error);
          }
        } }, t('proj.close')))
      : null,
  );

  const main = h('div', { class: 'stack' }, notice);
  if (project.selected) {
    main.append(
      h('div', { class: 'card quote-card picked' }, h('div', { class: 'who-line' }, avatar(project.selected.companyName), h('div', {}, h('h3', {}, `${t('pick.done')}: ${project.selected.companyName}`))),
        facts([[t('contact.name'), project.selected.contact.name], [t('contact.phone'), project.selected.contact.phone]]),
        h('p', { class: 'small muted' }, t('pick.contact.note')), link(`/invitations/${project.selected.invitationId}`, [t('inv.open'), icon('arrow')], 'btn')),
    );
  }
  if (project.status === 'closed') main.append(noteBox('info', t('proj.closed.note')));
  main.append(h('div', {}, h('h2', {}, t('inv.title')), h('p', { class: 'small muted' }, icon('sealed'), ' ', t('inv.order')), quotesBox));
  if (open) main.append(h('div', {}, h('h2', {}, t('match.title')), h('p', { class: 'small muted' }, t('match.how', { max: MAX_LIVE })), matchesBox));

  queueMicrotask(async () => {
    try {
      const invitations = await api('GET', `/projects/${id}/invitations`);
      quotesBox.replaceChildren(invitationsView(project, invitations, fail, reload));
      if (open) {
        const matches = await api('GET', `/projects/${id}/matches`);
        const full = project.liveInvitations >= MAX_LIVE;
        matchesBox.replaceChildren(
          ...(full ? [noteBox('warn', t('match.full', { max: MAX_LIVE }))] : []),
          ...(matches.length === 0
            ? [empty('users', t('match.none.title'), t('match.none'))]
            : [h('div', { class: 'stack' }, matches.map((m) => matchCard(id, m, full, notice, reload)))]),
        );
      }
    } catch (error) {
      quotesBox.replaceChildren(errorBox(error));
      matchesBox.replaceChildren();
    }
  });
  return h('section', { class: 'stack' }, summary, h('div', { class: 'grid2 side' }, main, side));
}

function matchCard(projectId, match, full, notice, reload) {
  const form = h(
    'form',
    {},
    field(t('inv.message'), textarea('message', { rows: 2, maxlength: 1000 }), t('inv.message.hint')),
    h('button', { type: 'submit', class: 'primary', disabled: full }, icon('arrow'), t('match.invite')),
  );
  onSubmit(form, notice, async (data) => {
    await api('POST', `/projects/${projectId}/invitations`, { body: { contractorId: match.contractor.id, message: str(data.get('message')) } });
    reload();
  });
  return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('strong', {}, t('match.fit')), statusChip(match.fit)), reasonList(match.reasons), h('hr'), profileCard(match.contractor), form);
}

/** The quotes side by side (never sorted by price), then the invitations still waiting or closed. */
function invitationsView(project, invitations, fail, reload) {
  if (invitations.length === 0) return empty('inbox', t('inv.none.title'), t('inv.none'));
  const quoted = invitations.filter((i) => i.status === 'quoted' || i.status === 'selected');
  const waiting = invitations.filter((i) => i.status === 'invited');
  const closed = invitations.filter((i) => !['quoted', 'selected', 'invited'].includes(i.status));
  const canPick = project.status === 'open';
  const quoteCard = (inv) =>
    h(
      'div',
      { class: `card quote-card${inv.status === 'selected' ? ' picked' : ''}` },
      h('div', { class: 'who-line' }, avatar(inv.contractor.companyName), h('div', {}, h('h3', {}, link(`/invitations/${inv.id}`, inv.contractor.companyName)), statusChip(inv.status))),
      h('div', { class: 'price' }, cny(inv.quote.priceCny)),
      quoteBlock(inv.quote),
      inv.contact ? facts([[t('contact.name'), inv.contact.name], [t('contact.phone'), inv.contact.phone]]) : null,
      h('details', {}, h('summary', {}, t('inv.profile')), profileCard(inv.contractor)),
      canPick && inv.status === 'quoted'
        ? h('button', { class: 'primary', onclick: async () => {
            if (!confirm(t('pick.confirm', { name: inv.contractor.companyName, price: cny(inv.quote.priceCny) }))) return;
            try {
              await api('POST', `/projects/${project.id}/selection`, { body: { invitationId: inv.id } });
              reload();
            } catch (error) {
              fail(error);
            }
          } }, icon('check'), t('pick.button'))
        : null,
    );
  const row = (inv) =>
    h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', { class: 'who-line' }, avatar(inv.contractor.companyName), h('strong', {}, link(`/invitations/${inv.id}`, inv.contractor.companyName))), statusChip(inv.status)),
      inv.status === 'invited' ? h('p', { class: 'small muted' }, icon('clock'), ' ', t('inv.waiting'), ' · ', timeLeft(inv.expiresAt)) : null,
      inv.declineReason ? h('p', { class: 'small muted' }, `${t('inv.reason')}: ${inv.declineReason}`) : null);
  return h('div', { class: 'stack' },
    quoted.length ? h('div', { class: 'quotes' }, quoted.map(quoteCard)) : null,
    waiting.length ? h('div', {}, h('h3', {}, t('inv.waiting.title')), h('div', { class: 'stack' }, waiting.map(row))) : null,
    closed.length ? h('details', {}, h('summary', {}, t('inv.closed.title', { n: closed.length })), h('div', { class: 'stack' }, closed.map(row))) : null);
}

export async function browse(ctx) {
  const filters = { city: ctx.params.get('city') ?? '', district: ctx.params.get('district') ?? '', renovationType: ctx.params.get('renovationType') ?? '' };
  const place = await placePicker({ city: filters.city, district: filters.district, required: false });
  const list = h('div', {}, loading());
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('browse.title')),
    h('p', { class: 'muted' }, t('browse.lead')),
    place.el,
    field(t('p.type'), select('renovationType', [['', t('any')], ...options('type', TYPES)], filters.renovationType)),
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
        found.length === 0
          ? empty('users', t('browse.none.title'), t('browse.none'))
          : h('div', { class: 'stack' }, found.map((p) => h('div', { class: 'card' }, profileCard(p, [link(`/browse/${p.id}`, [t('browse.open'), icon('arrow')], 'btn')])))),
      );
    } catch (error) {
      list.replaceChildren(errorBox(error));
    }
  });
  return h('section', { class: 'stack' }, form, list);
}

export async function browseDetail(ctx) {
  const profile = await api('GET', `/contractors/${ctx.args.id}`);
  return h('section', { class: 'stack' }, link('/browse', t('back')), h('div', { class: 'card' }, profileCard(profile)));
}

// ---- My homes (F1, F6, N4): the plan photo, the reading and the home's 3D link ----

/** An image behind the sign-in (the overlay): fetched with the token, shown from a blob URL. */
async function authImage(url) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${session.token}` } });
  return res.ok ? URL.createObjectURL(await res.blob()) : null;
}

function homeOverlay(home) {
  const img = h('img', { class: 'home-overlay', alt: t('homes.overlay'), loading: 'lazy' });
  authImage(`/api/homes/${home.id}/plan-overlay.svg`)
    .then((url) => url && (img.src = url))
    .catch(() => {});
  return img;
}

export async function homesList() {
  const homes = await api('GET', '/homes/mine');
  return h(
    'section',
    {},
    h('div', { class: 'page-head' }, h('h1', {}, t('homes.mine')), link('/homes/new', [icon('plus'), t('homes.new')], 'btn primary')),
    homes.length === 0
      ? empty('build', t('homes.empty.title'), t('homes.empty'), link('/homes/new', [icon('plus'), t('homes.new')], 'btn primary'))
      : h(
          'div',
          { class: 'stack' },
          homes.map((home) =>
            h(
              'div',
              { class: 'card' },
              h('div', { class: 'card-head' }, h('h3', {}, home.name), home.confirmedDesign ? chip('ok', t('homes.confirmed')) : null),
              homeOverlay(home),
              h(
                'div',
                { class: 'actions' },
                h('a', { href: home.link, class: 'btn primary', target: '_blank', rel: 'noopener' }, icon('build'), t('homes.open3d')),
              ),
            ),
          ),
        ),
  );
}

export async function homeNew() {
  const nameInput = input('name', { maxlength: 120 });
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', required: true });
  const box = h('div', { role: 'status' });
  const form = h(
    'form',
    { class: 'card' },
    h('h1', {}, t('homes.new')),
    noteBox('info', t('homes.note')),
    field(t('homes.name'), nameInput),
    field(t('homes.photo'), file),
    box,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'submit' }, t('homes.read')), link('/homes', t('back'))),
  );
  const wrap = h('div', {}, form);
  onSubmit(form, box, async () => {
    const picked = file.files[0];
    if (!picked) return;
    box.replaceChildren(loading(), h('p', { class: 'muted small' }, t('homes.reading')));
    const upload = await api('POST', '/uploads', {
      body: { filename: picked.name.replace(/[/\\]/g, '_'), contentType: picked.type, dataBase64: await toBase64(picked) },
    });
    const home = await api('POST', '/homes/from-image', { body: { uploadId: upload.id, ...(nameInput.value ? { name: nameInput.value } : {}) } });
    wrap.replaceChildren(
      h(
        'div',
        { class: 'card' },
        h('h1', {}, t('homes.result')),
        homeOverlay(home),
        h('p', { class: 'muted small' }, t('homes.stats', { rooms: home.plan.rooms.length, walls: home.plan.walls.length })),
        noteBox('info', t('homes.check')),
        h(
          'div',
          { class: 'actions' },
          h('a', { href: home.link, class: 'btn primary', target: '_blank', rel: 'noopener' }, icon('build'), t('homes.open3d')),
          link('/homes', t('homes.mine')),
        ),
      ),
    );
  });
  return h('section', {}, wrap);
}
