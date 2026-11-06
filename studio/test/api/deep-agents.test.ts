// End to end: Agent 1's design work on Deep Agents JS, with a scripted chat model (D24, N3).

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { dateInChina, startApi, type Api } from './helpers.ts';

/** A chat model that plays a script: each model call takes the next message. */
class Scripted extends BaseChatModel {
  queue: AIMessage[] = [];
  calls = 0;
  _llmType(): string {
    return 'scripted';
  }
  bindTools(): this {
    return this;
  }
  async _generate(): Promise<ChatResult> {
    this.calls += 1;
    const message = this.queue.shift();
    if (!message) throw new Error('the script ran out');
    return { generations: [{ text: typeof message.content === 'string' ? message.content : '', message }] };
  }
}

const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };
const say = (content: string) => new AIMessage({ content, usage_metadata: usage });
const call = (name: string, args: Record<string, unknown>) =>
  new AIMessage({ content: '', tool_calls: [{ name, args, id: `call-${name}`, type: 'tool_call' }], usage_metadata: usage });

const model = new Scripted({});
let api: Api;
let withoutModel: Api;
let projectId: string;

before(async () => {
  api = await startApi({ deepModel: model });
  withoutModel = await startApi();
  const owner = await api.call('POST', '/auth/register', {
    body: { role: 'homeowner', phone: '13800139002', password: 'correct horse battery', displayName: '李先生', language: 'zh-CN', acceptTerms: true },
  });
  assert.equal(owner.status, 201, JSON.stringify(owner.body));
  const project = await api.call('POST', '/projects', {
    token: owner.body.accessToken,
    body: {
      title: '三居室全屋设计',
      city: '上海',
      district: '浦东新区',
      floorAreaM2: 120,
      renovationType: 'new-home',
      budgetMinCny: 250000,
      budgetMaxCny: 320000,
      desiredStart: dateInChina(30),
      description: '毛坯房，想要奶油风，三室两厅。',
    },
  });
  assert.equal(project.status, 201, JSON.stringify(project.body));
  projectId = project.body.id;
});

after(async () => {
  await api.close();
  await withoutModel.close();
});

beforeEach(() => {
  model.queue = [];
  model.calls = 0;
});

const designTask = async (server: Api, fields: Record<string, unknown> = {}) => {
  const created = await server.call('POST', '/admin/tasks', {
    admin: server.adminKey,
    body: { from: 'you', to: 'agent-1', task: 'layout', stage: 'design', expected: 'one layout', projectId, ...fields },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return created.body.id as string;
};
const tick = async (server: Api) => (await server.call('POST', '/admin/runner/tick', { admin: server.adminKey })).body;
const get = async (server: Api, id: string) => (await server.call('GET', `/admin/tasks/${id}`, { admin: server.adminKey })).body;

describe('design tasks on Deep Agents', () => {
  test('the deep agent uses its own tools, and the task keeps the result and the cost', async () => {
    const id = await designTask(api);
    model.queue = [call('save_result', { summary: 'layout A', data: { rooms: 3 } }), say('Option A is ready.')];
    assert.deepEqual(await tick(api), { started: 1, done: 1, escalated: 0, waiting: 0 });
    const done = await get(api, id);
    assert.equal(done.status, 'done');
    assert.deepEqual(done.result, { summary: 'layout A', data: { rooms: 3 } });
    assert.deepEqual(done.usage, { inputTokens: 20, outputTokens: 10, images: 0 });
  });

  test('a room sub-agent’s model calls are counted in the task’s cost', async () => {
    const id = await designTask(api);
    model.queue = [
      call('task', { description: 'Design the living room in cream style', subagent_type: 'room-designer' }),
      say('Sofa on the long wall, warm oak floor.'),
      say('Living room done.'),
    ];
    assert.equal((await tick(api)).done, 1);
    const done = await get(api, id);
    assert.equal(done.status, 'done');
    assert.equal(model.calls, 3);
    assert.equal(done.usage.inputTokens, 30);
  });

  test('a design task waits while MiMo isn’t set up', async () => {
    const id = await designTask(withoutModel, { projectId: undefined });
    assert.deepEqual(await tick(withoutModel), { started: 1, done: 0, escalated: 0, waiting: 1 });
    const waiting = await get(withoutModel, id);
    assert.equal(waiting.status, 'todo');
    assert.match(waiting.log.at(-1).event, /MiMo is unavailable/);
  });

  test('a task for a project that doesn’t exist is refused', async () => {
    const refused = await api.call('POST', '/admin/tasks', {
      admin: api.adminKey,
      body: { from: 'you', to: 'agent-1', task: 'layout', expected: 'x', projectId: '00000000-0000-4000-8000-000000000000' },
    });
    assert.equal(refused.status, 404);
  });

  test('an empty answer is retried once, then escalated to you', async () => {
    const id = await designTask(api);
    model.queue = [say(' '), say('')];
    assert.deepEqual(await tick(api), { started: 1, done: 0, escalated: 1, waiting: 0 });
    assert.equal((await get(api, id)).status, 'escalated');
  });

  test('tasks of other stages still run on the runner’s own loop, not on the deep agent', async () => {
    const id = await designTask(api, { task: 'reading', stage: 'requirements' });
    // The runner's own loop uses the MiMo transport, which the tests leave "down".
    assert.deepEqual(await tick(api), { started: 1, done: 0, escalated: 0, waiting: 1 });
    assert.equal(model.calls, 0);
    await api.call('POST', `/admin/tasks/${id}/decision`, { admin: api.adminKey, body: { decision: 'send-back', note: 'test over' } });
  });
});
