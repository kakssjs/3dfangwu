// The two agents (D22): who they are, what is in their heads (`studio/agents/`), and which tools
// each one gets (WORKFLOW.md section 5). The runner gives an agent only its own tools.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { studioDir } from '../config.ts';
import type { Task } from '../db/schema.ts';
import type { TaskOwner } from '../domain.ts';

export interface AgentDef {
  id: TaskOwner;
  name: string;
  /** Their instructions, from `studio/agents/`. */
  instructions: string;
  /** The tool names this agent may call (tools.ts). */
  tools: readonly string[];
}

/**
 * Each agent's tool set. The tools whose modules are still to come (check a plan, price it,
 * compare quotes, make an image, Homebox, micasa, Twenty, fill a template) join these as their
 * modules land (WORKFLOW.md section 5's tool table is the full list).
 */
export const AGENT_TOOLS: Record<'agent-1' | 'agent-2', readonly string[]> = {
  'agent-1': ['read_project', 'save_result', 'hand_off', 'ask_boss', 'draft_message'],
  'agent-2': ['read_project', 'save_result', 'hand_off', 'ask_boss', 'match_teams', 'draft_message'],
};

const FILES: Record<'agent-1' | 'agent-2', string> = {
  'agent-1': 'agent-1-homeowner.md',
  'agent-2': 'agent-2-matching.md',
};

const NAMES: Record<'agent-1' | 'agent-2', string> = {
  'agent-1': "Agent 1, the homeowner's agent (业主代理)",
  'agent-2': 'Agent 2, the matching agent (匹配代理)',
};

export function loadAgent(id: TaskOwner): AgentDef {
  if (id === 'you') throw new Error('you are not an agent');
  return {
    id,
    name: NAMES[id],
    instructions: readFileSync(path.join(studioDir, 'agents', FILES[id]), 'utf8'),
    tools: AGENT_TOOLS[id],
  };
}

/** Agent 1's design work runs on Deep Agents JS (D24); everything else on the runner's own loop. */
export function usesDeepAgents(agent: AgentDef, task: Pick<Task, 'stage'>): boolean {
  return agent.id === 'agent-1' && task.stage === 'design';
}

/** What the agent is told about its task. */
export function brief(task: Task, note: string): string {
  const lines = [
    `Task: ${task.task}`,
    `Expected: ${task.expected}`,
    task.stage ? `Stage: ${task.stage}` : '',
    task.projectId ? `Project id: ${task.projectId}` : '',
    task.inputs.length ? `Inputs: ${task.inputs.join(', ')}` : '',
    `Write in ${task.language === 'zh-CN' ? 'Chinese (简体中文)' : 'English'}.`,
    note ? `Your previous answer was broken (${note}). Answer again, and use the tools to check what you need.` : '',
  ];
  return lines.filter(Boolean).join('\n');
}
