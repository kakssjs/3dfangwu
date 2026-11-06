// The agents' tools (WORKFLOW.md section 5): methods of the NestJS services, offered to MiMo
// through tool calling, one set per agent. No tool takes or sends money, signs anything, verifies
// a contractor or deletes data; everything marked ★ goes through your queue (`ask_boss`).
//
// The tools whose modules are still to come (check a plan, price it, compare quotes, make an
// image, Homebox, micasa, Twenty, fill a template) land with those modules.

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/database.ts';
import { invitations, projects, type Task } from '../db/schema.ts';
import { findContactDetails, TASK_OWNERS, type TaskOwner } from '../domain.ts';
import { shortlistFor } from '../matching/invitations.service.ts';
import { TasksService, entry } from '../tasks/tasks.service.ts';
import { DB } from '../tokens.ts';
import type { MimoToolSpec } from './mimo.ts';

export interface ToolDef {
  spec: MimoToolSpec;
  /** Runs the tool. Throwing a plain Error gives the agent a message it can correct itself with. */
  run(args: Record<string, unknown>, current: Task): Promise<unknown>;
}

@Injectable()
export class ToolsService {
  private readonly defs: Map<string, ToolDef>;

  constructor(@Inject(DB) db: Db, tasks: TasksService) {
    this.defs = new Map(allTools(db, tasks).map((def) => [def.spec.name, def]));
  }

  /** The specs for one agent's tool set. */
  specs(names: readonly string[]): MimoToolSpec[] {
    return names.map((name) => {
      const def = this.defs.get(name);
      if (!def) throw new Error(`no such tool: ${name}`);
      return def.spec;
    });
  }

  async run(name: string, args: Record<string, unknown>, current: Task): Promise<unknown> {
    const def = this.defs.get(name);
    if (!def) return { error: `no such tool: ${name}` };
    try {
      return await def.run(args, current);
    } catch (error) {
      // The agent sees the reason and can fix its call; one bad tool call does not fail the task.
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}

function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('expected a JSON object of arguments');
  return v as Record<string, unknown>;
}

function string(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`"${key}" must be a non-empty string`);
  return value.trim();
}

function allTools(db: Db, tasks: TasksService): ToolDef[] {
  return [
    {
      spec: {
        name: 'read_project',
        description: "Read one project of ours: its requirements, its invitations and quotes, and its status.",
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'string', description: 'The project id' } },
          required: ['projectId'],
        },
      },
      async run(raw, current) {
        const args = object(raw);
        const projectId = string(args, 'projectId');
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) throw new Error('no such project');
        // Agent 2 matches without looking at any quote (D23); only Agent 1 reads them for the homeowner.
        const seesQuotes = current.to === 'agent-1';
        const rows = await db.select().from(invitations).where(eq(invitations.projectId, projectId));
        return {
          project,
          invitations: rows.map((i) => ({
            contractorId: i.contractorId,
            status: i.status,
            ...(seesQuotes
              ? { priceCny: i.priceCny, durationDays: i.durationDays, earliestStart: i.earliestStart, quoteNote: i.quoteNote }
              : {}),
          })),
        };
      },
    },
    {
      spec: {
        name: 'save_result',
        description: "Save the deliverable or record this task was for. It becomes the task's result. One call per task.",
        parameters: {
          type: 'object',
          properties: { summary: { type: 'string', description: 'What it is, in one line' }, data: { type: 'object', description: 'The record itself' } },
          required: ['summary'],
        },
      },
      async run(raw, current) {
        const args = object(raw);
        const summary = string(args, 'summary');
        await tasks.patch(current.id, { result: { summary, data: args.data ?? null } }, entry(new Date(), current.to, 'saved a result'));
        return { ok: true, summary };
      },
    },
    {
      spec: {
        name: 'hand_off',
        description: 'Create the next task, for the other agent or for the boss. Use it when this task needs someone else to continue.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', enum: ['agent-1', 'agent-2', 'you'], description: 'Who should do it' },
            task: { type: 'string', description: 'One word for the task: layout, verification-sheet, follow-up...' },
            expected: { type: 'string', description: 'What a finished task should produce, in one line' },
            inputs: { type: 'array', items: { type: 'string' }, description: 'What it works from' },
            due: { type: 'string', description: 'When it should start, YYYY-MM-DD (China time). Empty: at once' },
            projectId: { type: 'string' },
          },
          required: ['to', 'task', 'expected'],
        },
      },
      async run(raw, current) {
        const args = object(raw);
        if (!TASK_OWNERS.includes(args.to as TaskOwner)) throw new Error(`"to" must be one of ${TASK_OWNERS.join(', ')}`);
        const created = await tasks.create(
          {
            from: current.to,
            to: args.to as TaskOwner,
            task: string(args, 'task'),
            expected: string(args, 'expected'),
            inputs: Array.isArray(args.inputs) ? (args.inputs as string[]).slice(0, 20) : [],
            due: typeof args.due === 'string' && args.due ? args.due : undefined,
            projectId: typeof args.projectId === 'string' && args.projectId ? args.projectId : (current.projectId ?? undefined),
            language: current.language,
            stage: current.stage ?? undefined,
          },
          current.to,
        );
        return { taskId: created.id };
      },
    },
    {
      spec: {
        name: 'ask_boss',
        description: "Put a sign-off (★), a payment check or an escalation in the boss's queue. Nothing marked ★ happens without them.",
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'What the boss must decide or approve' },
            task: { type: 'string', description: 'One word for it: sign-off, payment-check, escalation' },
            projectId: { type: 'string' },
          },
          required: ['question', 'task'],
        },
      },
      async run(raw, current) {
        const args = object(raw);
        const created = await tasks.create(
          {
            from: current.to,
            to: 'you',
            task: string(args, 'task'),
            expected: string(args, 'question'),
            projectId: typeof args.projectId === 'string' && args.projectId ? args.projectId : (current.projectId ?? undefined),
            language: current.language,
            stage: current.stage ?? undefined,
          },
          current.to,
        );
        return { taskId: created.id, waiting: 'the boss decides' };
      },
    },
    {
      spec: {
        name: 'match_teams',
        description:
          'The verified teams that suit a project, best fit first, each with a fit tier (strong, good, possible) and the reasons, by rules anyone can read. Never sorted by price; nothing here looks at a quote (D23).',
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'string' } },
          required: ['projectId'],
        },
      },
      async run(raw) {
        const args = object(raw);
        const projectId = string(args, 'projectId');
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) throw new Error('no such project');
        return shortlistFor(db, project, 5);
      },
    },
    {
      spec: {
        name: 'draft_message',
        description:
          "Draft a message for a homeowner or a contractor in their language. The boss sends it (D6, D12). Never put a phone number or email in it (D7): the platform exchanges contacts after the pick.",
        parameters: {
          type: 'object',
          properties: {
            audience: { type: 'string', enum: ['homeowner', 'contractor'] },
            text: { type: 'string', description: "The message, in the reader's language" },
          },
          required: ['audience', 'text'],
        },
      },
      async run(raw) {
        const args = object(raw);
        const text = string(args, 'text');
        const found = findContactDetails(text);
        if (found) throw new Error(`the message contains ${found}: contacts are shared only once the homeowner picks a quote (D7)`);
        return { draft: text, audience: args.audience, status: 'waiting for the boss to send' };
      },
    },
  ];
}
