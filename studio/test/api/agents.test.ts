// End to end: the task queue, your decisions and the runner with a scripted MiMo (N3, D22).

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import type { MimoMessage, MimoResponse, MimoToolSpec, MimoTransport } from '../../src/api/agents/mimo.ts';
import { dateInChina, startApi, type Api } from './helpers.ts';

const USAGE = { inputTokens: 100, outputTokens: 20, images: 0 };

/** MiMo, played from a script: each call takes the next reply, and every call is kept. */
let script: (MimoResponse | Error)[] = [];
let calls: { messages: MimoMessage[]; tools: string[] }[] = [];
const scripted: MimoTransport = async (messages: MimoMessage[], tools: MimoToolSpec[]) => {
  calls.push({ messages: structuredClone(messages), tools: tools.map((t) => t.name) });
  const next = script.shift();
  if (!next) throw new Error('the script ran out');
  if (next instanceof Error) throw next;
  return next;
};
const say = (content: string): MimoResponse => ({ content, toolCalls: [], usage: USAGE });
const use = (name: string, args: unknown): MimoResponse => ({
  content: '',
  toolCalls: [{ id: `call-${name}`, name, arguments: JSON.stringify(args) }],
  usage: USAGE,
});

let api: Api;
let projectId: string;

before(async () => {
  api = await startApi({ mimo: scripted });
  const owner = await api.call('POST', '/auth/register', {
    body: { role: 'homeowner', phone: '13800139001', password: 'correct horse battery', displayName: '王女士', language: 'zh-CN', acceptTerms: true },
  });
  assert.equal(owner.status, 201, JSON.stringify(owner.body));
  const project = await api.call('POST', '/projects', {
    token: owner.body.accessToken,
    body: {
      title: '两居室老房翻新',
      city: '上海',
      district: '浦东新区',
      floorAreaM2: 89,
      renovationType: 'old-home',
      budgetMinCny: 150000,
      budgetMaxCny: 200000,
      desiredStart: dateInChina(30),
      description: '厨房和卫生间全部重做，客厅改成开放式。',
    },
  });
  assert.equal(project.status, 201, JSON.stringify(project.body));
  projectId = project.body.id;
});

after(async () => {
  await api.close();
});

beforeEach(() => {
  script = [];
  calls = [];
});

const admin = (method: string, path: string, body?: unknown) => api.call(method, path, { admin: api.adminKey, body });
const newTask = async (fields: Record<string, unknown>) => {
  const { status, body } = await admin('POST', '/admin/tasks', { from: 'you', expected: 'one line', ...fields });
  assert.equal(status, 201, JSON.stringify(body));
  return body;
};
const tick = async () => (await admin('POST', '/admin/runner/tick')).body;
const task = async (id: string) => (await admin('GET', `/admin/tasks/${id}`)).body;

describe('the runner', () => {
  test('runs a due task with the agent’s own tools, keeps its result and counts what it cost', async () => {
    const created = await newTask({ to: 'agent-2', task: 'shortlist', projectId, stage: 'matching' });
    script = [use('match_teams', { projectId }), use('save_result', { summary: 'no teams yet', data: { teams: 0 } }), say('done')];
    assert.deepEqual(await tick(), { started: 1, done: 1, escalated: 0, waiting: 0 });

    const done = await task(created.id);
    assert.equal(done.status, 'done');
    assert.deepEqual(done.result, { summary: 'no teams yet', data: { teams: 0 } });
    assert.deepEqual(done.usage, { inputTokens: 300, outputTokens: 60, images: 0 });
    assert.equal(done.attempts, 1);
    assert.ok(calls[0]!.tools.includes('match_teams'));
    assert.match(calls[0]!.messages[1]!.content, /Write in Chinese/);
    // The shortlist came back to the model as the tool's answer: no verified teams yet.
    assert.equal(calls[1]!.messages.at(-1)!.content, '[]');
  });

  test('an agent cannot call a tool that is not its own', async () => {
    await newTask({ to: 'agent-1', task: 'reading', projectId });
    script = [use('match_teams', { projectId }), say('ok')];
    await tick();
    assert.ok(!calls[0]!.tools.includes('match_teams'));
    assert.match(calls[1]!.messages.at(-1)!.content, /not one of your tools/);
  });

  test('a broken answer is retried once, then escalated to you', async () => {
    const created = await newTask({ to: 'agent-1', task: 'report', projectId });
    script = [say(''), say('   ')];
    assert.deepEqual(await tick(), { started: 1, done: 0, escalated: 1, waiting: 0 });
    const escalated = await task(created.id);
    assert.equal(escalated.status, 'escalated');
    assert.equal(escalated.attempts, 2);
    assert.match(calls[1]!.messages[1]!.content, /previous answer was broken/);
    const queue = (await admin('GET', '/admin/tasks?status=escalated')).body.map((t: { id: string }) => t.id);
    assert.ok(queue.includes(created.id));
  });

  test('when MiMo is down the task waits where it was', async () => {
    const created = await newTask({ to: 'agent-1', task: 'report', projectId });
    script = [new Error('connect ECONNREFUSED')];
    assert.deepEqual(await tick(), { started: 1, done: 0, escalated: 0, waiting: 1 });
    const waiting = await task(created.id);
    assert.equal(waiting.status, 'todo');
    assert.match(waiting.log.at(-1).event, /MiMo is unavailable/);
    await admin('POST', `/admin/tasks/${created.id}/decision`, { decision: 'send-back', note: 'cancelled in the test' });
  });

  test('tasks due later, and tasks for you, are not run', async () => {
    await newTask({ to: 'agent-2', task: 'follow-up', due: dateInChina(3) });
    await newTask({ to: 'you', task: 'sign-off' });
    assert.deepEqual(await tick(), { started: 0, done: 0, escalated: 0, waiting: 0 });
    assert.equal(calls.length, 0);
  });

  test('a hand-off creates the next task, and an agent’s sign-off waits in your queue', async () => {
    await newTask({ to: 'agent-1', task: 'design', projectId });
    script = [
      use('hand_off', { to: 'agent-2', task: 'shortlist', expected: 'the shortlist explained' }),
      use('ask_boss', { task: 'sign-off', question: 'Approve the design package?' }),
      use('hand_off', { to: 'nobody', task: 'x', expected: 'y' }),
      say('handed over'),
    ];
    await tick();
    assert.match(calls[3]!.messages.at(-1)!.content, /to\\" must be one of/);
    const all = (await admin('GET', '/admin/tasks')).body;
    const next = all.find((t: { task: string; from: string; status: string }) => t.task === 'shortlist' && t.from === 'agent-1');
    assert.equal(next.to, 'agent-2');
    assert.equal(next.projectId, projectId);
    const signOff = all.find((t: { task: string; from: string }) => t.task === 'sign-off' && t.from === 'agent-1');
    assert.equal(signOff.to, 'you');
    assert.equal(signOff.expected, 'Approve the design package?');
  });
});

describe('your decisions', () => {
  test('approving closes a waiting task; a finished one can’t be decided again', async () => {
    const created = await newTask({ to: 'you', task: 'sign-off' });
    const approved = await admin('POST', `/admin/tasks/${created.id}/decision`, { decision: 'approve' });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, 'done');
    assert.equal((await admin('POST', `/admin/tasks/${created.id}/decision`, { decision: 'approve' })).status, 409);
  });

  test('the queue is yours alone', async () => {
    assert.equal((await api.call('GET', '/admin/tasks')).status, 401);
    assert.equal((await api.call('POST', '/admin/runner/tick', { admin: 'wrong' })).status, 401);
  });

  test('drafts never carry contact details', async () => {
    await newTask({ to: 'agent-2', task: 'thank-you', projectId });
    script = [use('draft_message', { audience: 'contractor', text: '请打电话 13800138000' }), say('ok')];
    await tick();
    assert.match(calls[1]!.messages.at(-1)!.content, /contacts are shared only once/);
  });
});
