// The runner (N3, WORKFLOW.md section 5): our code, not an agent. It keeps the task queue, starts
// what is due, gives each agent only its own tools, stops a task that runs too long (8 steps),
// retries a broken answer once and then escalates it to you, and lets tasks wait politely when
// MiMo is down. Tasks to you (★ sign-offs) never run: they wait for your decision.

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/database.ts';
import { tasks, type Task, type TaskUsage } from '../db/schema.ts';
import { TasksService, entry } from '../tasks/tasks.service.ts';
import { DB } from '../tokens.ts';
import { DeepAgentService } from './deep.ts';
import { loadAgent, brief, usesDeepAgents, type AgentDef } from './definitions.ts';
import { BrokenOutput, MimoClient, MimoError, type MimoMessage, type MimoResponse } from './mimo.ts';
import { ToolsService } from './tools.ts';

const MAX_STEPS = 8;

@Injectable()
export class RunnerService {
  private readonly db: Db;
  private readonly tasks: TasksService;
  private readonly tools: ToolsService;
  private readonly mimo: MimoClient;
  private readonly deep: DeepAgentService;
  private running = false;

  constructor(@Inject(DB) db: Db, tasks: TasksService, tools: ToolsService, @Inject(MimoClient) mimo: MimoClient, deep: DeepAgentService) {
    this.db = db;
    this.tasks = tasks;
    this.tools = tools;
    this.mimo = mimo;
    this.deep = deep;
  }

  /** Runs every task that is due, one after the other. Called by the timer in main.ts and by you. */
  async tick(now = new Date()): Promise<{ started: number; done: number; escalated: number; waiting: number }> {
    const summary = { started: 0, done: 0, escalated: 0, waiting: 0 };
    // The timer and you may both ask: one pass at a time, so no task runs twice at once.
    if (this.running) return summary;
    this.running = true;
    try {
      for (const task of await this.tasks.due(now)) {
        summary.started += 1;
        const finished = await this.runTask(task);
        if (finished.status === 'done') summary.done += 1;
        else if (finished.status === 'escalated') summary.escalated += 1;
        else summary.waiting += 1;
      }
    } finally {
      this.running = false;
    }
    return summary;
  }

  /** Runs one task: up to two attempts, and at most `MAX_STEPS` model turns in each. */
  async runTask(task: Task): Promise<Task> {
    if (task.to === 'you') throw new Error('a task for you waits for your decision, and never runs');
    const agent = loadAgent(task.to as 'agent-1' | 'agent-2');
    const usage: TaskUsage = { ...task.usage };
    let current = task;
    let note = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      current = await this.tasks.patch(current.id, { status: 'doing', attempts: task.attempts + attempt }, entry(new Date(), 'runner', `started (attempt ${task.attempts + attempt})`));
      try {
        const content = await this.attempt(current, agent, usage, note);
        return this.finish(current, content, usage);
      } catch (error) {
        if (error instanceof MimoError) {
          // MiMo is down or out of credits: the task waits where it is, and the queue pauses (8).
          return this.tasks.patch(
            current.id,
            { status: 'todo', usage },
            entry(new Date(), 'runner', `MiMo is unavailable: ${error.message}. The task waits; people waiting get a prepared message`),
          );
        }
        const why = error instanceof Error ? error.message : String(error);
        note = why;
        if (attempt === 2) {
          return this.tasks.patch(
            current.id,
            { status: 'escalated', usage },
            entry(new Date(), 'runner', `broken output twice (${why}): escalated to you`),
          );
        }
        await this.tasks.patch(current.id, { usage }, entry(new Date(), 'runner', `broken output (${why}): retrying once`));
      }
    }
    return current;
  }

  /** One attempt: the agent's turns until it answers in words, with its tool calls in between. */
  private async attempt(task: Task, agent: AgentDef, usage: TaskUsage, note: string): Promise<string> {
    if (usesDeepAgents(agent, task)) return this.deep.run(task, agent, usage, note);
    const messages: MimoMessage[] = [
      { role: 'system', content: agent.instructions },
      { role: 'user', content: brief(task, note) },
    ];
    const specs = this.tools.specs(agent.tools);
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const reply = await this.chat(messages, specs, usage);
      if (reply.toolCalls.length === 0) {
        const content = reply.content.trim();
        if (!content) throw new BrokenOutput('the answer was empty');
        return content;
      }
      messages.push({ role: 'assistant', content: reply.content, toolCalls: reply.toolCalls });
      for (const call of reply.toolCalls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }
        // An agent gets only its own tools (section 5), whatever name the model sends.
        const result = agent.tools.includes(call.name)
          ? await this.tools.run(call.name, args, task)
          : { error: `${call.name} is not one of your tools` };
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
      }
    }
    throw new BrokenOutput(`no answer within ${MAX_STEPS} steps`);
  }

  private async chat(messages: MimoMessage[], specs: ReturnType<ToolsService['specs']>, usage: TaskUsage): Promise<MimoResponse> {
    const reply = await this.mimo.chat(messages, specs);
    usage.inputTokens += reply.usage.inputTokens;
    usage.outputTokens += reply.usage.outputTokens;
    usage.images += reply.usage.images;
    return reply;
  }

  /** Marks the task done: what `save_result` stored, or the answer in words. */
  private async finish(task: Task, content: string, usage: TaskUsage): Promise<Task> {
    const fresh = await this.db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
    const result = fresh[0]?.result ?? { content };
    return this.tasks.patch(task.id, { status: 'done', result, usage }, entry(new Date(), task.to, 'finished'));
  }
}
