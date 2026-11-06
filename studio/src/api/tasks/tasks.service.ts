// The task queue and its run records (WORKFLOW.md section 6.5): every handoff between the two
// agents, you and the code is a row here. The runner (agents/runner.ts) runs what is due; tasks
// to you are sign-offs (★) and wait until you decide.

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lte, or, type SQL } from 'drizzle-orm';
import type { Db } from '../db/database.ts';
import { tasks, type Task, type TaskLogEntry } from '../db/schema.ts';
import type { Language, TaskOwner, TaskStatus } from '../domain.ts';
import { DB } from '../tokens.ts';
import type { CreateTaskDto, DecisionDto, TaskQueryDto } from './tasks.dto.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TasksService {
  private readonly db: Db;

  constructor(@Inject(DB) db: Db) {
    this.db = db;
  }

  /** Creates a task and logs who asked for it. */
  async create(dto: CreateTaskDto, by: string): Promise<Task> {
    const now = new Date();
    const [task] = await this.db
      .insert(tasks)
      .values({
        task: dto.task,
        stage: dto.stage ?? null,
        language: dto.language ?? 'zh-CN',
        from: dto.from,
        to: dto.to,
        inputs: dto.inputs ?? [],
        expected: dto.expected,
        due: dto.due ? new Date(`${dto.due}T00:00:00+08:00`) : null,
        projectId: dto.projectId ?? null,
        contractorId: dto.contractorId ?? null,
        log: [entry(now, by, 'created')],
      })
      .returning();
    return task!;
  }

  async adminList(query: TaskQueryDto): Promise<Task[]> {
    const where: SQL[] = [];
    if (query.to) where.push(eq(tasks.to, query.to));
    if (query.status) where.push(eq(tasks.status, query.status));
    return this.db
      .select()
      .from(tasks)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(tasks.createdAt), asc(tasks.id));
  }

  async get(id: string): Promise<Task> {
    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!task) throw new NotFoundException('No such task');
    return task;
  }

  /**
   * Your decision on a task waiting for you (to `you`, or escalated after two failed runs):
   * approving marks it done, sending it back marks it failed with your note in the log (6.5).
   */
  async decide(id: string, dto: DecisionDto, by = 'you'): Promise<Task> {
    const now = new Date();
    const task = await this.get(id);
    if (task.status !== 'todo' && task.status !== 'escalated') {
      throw new ConflictException(`This task is ${task.status} and no longer waits for a decision`);
    }
    const [updated] = await this.db
      .update(tasks)
      .set({
        status: dto.decision === 'approve' ? 'done' : 'failed',
        updatedAt: now,
        log: [...task.log, entry(now, by, dto.decision === 'approve' ? 'approved' : `sent back${dto.note ? `: ${dto.note}` : ''}`)],
      })
      .where(eq(tasks.id, id))
      .returning();
    return updated!;
  }

  // What the runner needs, on top of the routes:

  /** The tasks that are due and waiting to run: never tasks to you (they wait for a decision). */
  async due(now: Date): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, 'todo'), inArray(tasks.to, ['agent-1', 'agent-2']), or(isNull(tasks.due), lte(tasks.due, now))))
      .orderBy(asc(tasks.due), asc(tasks.createdAt))
      .limit(20);
  }

  async patch(id: string, changes: Partial<Task>, log: TaskLogEntry): Promise<Task> {
    const task = await this.get(id);
    const [updated] = await this.db
      .update(tasks)
      .set({ ...changes, updatedAt: new Date(), log: [...task.log, log] })
      .where(eq(tasks.id, id))
      .returning();
    return updated!;
  }
}

export function entry(at: Date, by: string, event: string): TaskLogEntry {
  return { at: at.toISOString(), by, event };
}

/** A due date `days` from now, as YYYY-MM-DD in China time. */
export function dayInChina(days: number, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(now.getTime() + days * DAY_MS));
}

export type { Language };
