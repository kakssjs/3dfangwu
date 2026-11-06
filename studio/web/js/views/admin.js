// Your console (N8, WORKFLOW.md 9.4): the admin key from `.env.local` is asked for here, kept for
// this tab only, and sent with every console request. Contractor review, the task queue with your
// decisions, and the runner.

import { ApiError, api, query, session } from '../api.js';
import { h } from '../dom.js';
import { label, t } from '../i18n.js';
import { go } from '../router.js';
import { day, errorBox, facts, field, input, loading, okBox, onSubmit, select, statusChip, str, textarea } from './common.js';

export async function admin(ctx) {
  const tab = ctx.params.get('tab') ?? 'contractors';
  if (!session.adminKey) return keyForm();
  const body = h('div', {}, loading());
  const tabs = h(
    'div',
    { class: 'tabs' },
    ['contractors', 'tasks', 'runner'].map((name) => h('button', { class: name === tab ? 'on' : '', onclick: () => go(`/admin?tab=${name}`) }, t(`adm.${name}`))),
    h('button', { class: 'link', onclick: () => { session.adminKey = null; go('/admin', true); } }, t('adm.forget')),
  );
  queueMicrotask(async () => {
    try {
      const view = tab === 'tasks' ? await tasksView(ctx) : tab === 'runner' ? runnerView() : await contractorsView(ctx);
      body.replaceChildren(view);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        session.adminKey = null;
        body.replaceChildren(h('p', { class: 'alert alert-error' }, t('adm.badkey')), keyForm());
      } else body.replaceChildren(errorBox(error));
    }
  });
  return h('section', {}, h('h1', {}, t('adm.title')), tabs, body);
}

function keyForm() {
  const box = h('div');
  const form = h('form', { class: 'card' }, h('h1', {}, t('adm.title')), field(t('adm.key'), input('key', { type: 'password', required: true, autocomplete: 'off' }), t('adm.key.hint')), box, h('button', { type: 'submit', class: 'primary' }, t('adm.enter')));
  onSubmit(form, box, async (data) => {
    session.adminKey = String(data.get('key'));
    await api('GET', '/admin/contractors?status=pending', { admin: true });
    go('/admin', true);
  });
  return form;
}

async function contractorsView(ctx) {
  const status = ctx.params.get('status') ?? 'pending';
  const list = await api('GET', `/admin/contractors${query({ status })}`, { admin: true });
  const filter = h('select', { value: status, onchange: (e) => go(`/admin?tab=contractors&status=${e.target.value}`) }, ['pending', 'verified', 'rejected', 'suspended'].map((s) => h('option', { value: s }, label('status', s))));
  filter.value = status;
  return h(
    'div',
    {},
    field(t('adm.status'), filter),
    list.length === 0 ? h('p', { class: 'muted' }, t('adm.none')) : list.map(reviewCard),
  );
}

function reviewCard(p) {
  const box = h('div');
  const decide = (decision) => async (event) => {
    const form = event.target.closest('form');
    const note = str(new FormData(form).get('note'));
    box.replaceChildren();
    try {
      await api('POST', `/admin/contractors/${p.id}/review`, { admin: true, body: { decision, note } });
      go(location.pathname + location.search, true);
    } catch (error) {
      box.replaceChildren(errorBox(error));
    }
  };
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, p.companyName), statusChip(p.status)),
    facts([
      [t('adm.account'), `${p.displayName} · ${p.phone}`],
      [t('f.licence'), p.licenceNumber],
      [t('f.city'), `${p.city} · ${p.districts.join('、')}`],
      [t('f.types'), p.renovationTypes.map((v) => label('type', v)).join('、')],
      [t('f.years'), `${p.yearsInBusiness}`],
      [t('f.team'), `${p.teamSize}`],
      [t('f.quals'), p.qualifications.map((q) => [q.name, q.number, q.validUntil].filter(Boolean).join(' ')).join('；')],
      [t('f.past', { n: p.pastProjects.length }), p.pastProjects.map((x) => [x.title, x.district, x.year].filter(Boolean).join(' ')).join('；')],
      [t('app.note'), p.reviewNote],
    ]),
    h('form', { onsubmit: (e) => e.preventDefault() }, field(t('adm.note'), textarea('note', { rows: 2, maxlength: 500 }), t('adm.note.hint')), box,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'primary', onclick: decide('verified') }, t('adm.verify')),
        h('button', { type: 'button', onclick: decide('rejected') }, t('adm.reject')),
        h('button', { type: 'button', class: 'danger', onclick: decide('suspended') }, t('adm.suspend')))),
  );
}

async function tasksView(ctx) {
  const to = ctx.params.get('to') ?? '';
  const status = ctx.params.get('status') ?? '';
  const list = await api('GET', `/admin/tasks${query({ to, status })}`, { admin: true });
  const apply = (e) => {
    e.preventDefault();
    const d = new FormData(e.target.closest('form'));
    go(`/admin${query({ tab: 'tasks', to: d.get('to'), status: d.get('status') })}`);
  };
  const filters = h('form', { class: 'row3' },
    field(t('adm.to'), select('to', [['', t('any')], ['you', t('adm.you')], ['agent-1', 'Agent 1'], ['agent-2', 'Agent 2']], to)),
    field(t('adm.status'), select('status', [['', t('any')], ...['todo', 'doing', 'done', 'failed', 'escalated'].map((s) => [s, label('status', s)])], status)),
    h('div', {}, h('button', { type: 'submit', onclick: apply }, t('browse.search'))));
  return h('div', {}, filters, list.length === 0 ? h('p', { class: 'muted' }, t('adm.none')) : list.map(taskCard));
}

function taskCard(task) {
  const waiting = task.status === 'escalated' || (task.to === 'you' && task.status === 'todo');
  const box = h('div');
  const decide = (decision) => async (event) => {
    const note = str(new FormData(event.target.closest('form')).get('note'));
    try {
      await api('POST', `/admin/tasks/${task.id}/decision`, { admin: true, body: { decision, note } });
      go(location.pathname + location.search, true);
    } catch (error) {
      box.replaceChildren(errorBox(error));
    }
  };
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, task.task), statusChip(task.status)),
    h('p', { class: 'small muted' }, `${task.from} → ${task.to}${task.stage ? ` · ${task.stage}` : ''} · ${day(task.createdAt)} · ${t('adm.attempts')}: ${task.attempts} · ${t('adm.tokens')}: ${task.usage.inputTokens + task.usage.outputTokens}`),
    h('p', {}, task.expected),
    task.result ? h('details', {}, h('summary', {}, t('adm.result')), h('pre', { class: 'log' }, JSON.stringify(task.result, null, 2))) : null,
    h('details', {}, h('summary', {}, t('adm.log')), h('pre', { class: 'log' }, task.log.map((l) => `${l.at}  ${l.by}: ${l.event}`).join('\n'))),
    waiting
      ? h('form', { onsubmit: (e) => e.preventDefault() }, field(t('adm.note'), textarea('note', { rows: 2, maxlength: 500 })), box,
          h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: decide('approve') }, t('adm.approve')), h('button', { type: 'button', onclick: decide('send-back') }, t('adm.sendback'))))
      : null,
  );
}

function runnerView() {
  const out = h('div');
  return h('div', { class: 'card' }, h('p', {}, t('adm.runner.body')),
    h('button', { class: 'primary', onclick: async (event) => {
      event.target.disabled = true;
      try {
        const r = await api('POST', '/admin/runner/tick', { admin: true });
        out.replaceChildren(okBox(t('adm.runner.result', r)));
      } catch (error) {
        out.replaceChildren(errorBox(error));
      } finally {
        event.target.disabled = false;
      }
    } }, t('adm.runner.run')), out);
}

