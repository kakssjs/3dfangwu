// The Deep Agents engine (D24, N3): Agent 1's design work runs on Deep Agents JS (MIT) — a planning
// list, an in-memory scratch file system and a sub-agent per room, on LangGraph — inside the
// runner's task. The runner stays the orchestrator: it owns the queue, the retries, the sign-offs
// and the run records. This engine only replaces the model loop for the tasks that need planning.
//
// The model is any LangChain chat model. The app builds a ChatOpenAI against the MiMo endpoint (the
// OpenAI-style wire format, to confirm against the event's model access docs); the tests hand in
// a scripted one. The agent gets only the tools its definition lists, and the default in-memory
// backend, so it never touches this PC's disk or runs a command.

import { Inject, Injectable } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { createDeepAgent } from 'deepagents';
import type { StudioConfig } from '../config.ts';
import type { Task, TaskUsage } from '../db/schema.ts';
import { DEEP_MODEL } from '../tokens.ts';
import { brief, type AgentDef } from './definitions.ts';
import { BrokenOutput, MimoError } from './mimo.ts';
import { ToolsService } from './tools.ts';

// Telemetry stays off (D7): LangSmith only traces when someone turns it on on purpose.
process.env.LANGSMITH_TRACING ??= 'false';
process.env.LANGCHAIN_TRACING_V2 ??= 'false';

/** Model turns allowed in one attempt, sub-agents included. */
const RECURSION_LIMIT = 60;

/** The MiMo model for the deep agents, or null while the key or endpoint isn't set (the agents wait). */
export function buildDeepModel(config: Pick<StudioConfig, 'mimoApiKey' | 'mimoBaseUrl' | 'mimoModel'>): BaseChatModel | null {
  if (!config.mimoApiKey || !config.mimoBaseUrl) return null;
  return new ChatOpenAI({
    model: config.mimoModel,
    apiKey: config.mimoApiKey,
    configuration: { baseURL: config.mimoBaseUrl },
    timeout: 120_000,
    maxRetries: 1,
  });
}

const ROOM_DESIGNER_PROMPT = [
  'You design one room of a home, in the style and budget you are given.',
  'Work only from the facts you are handed (the room, its size, its doors and windows, the style).',
  'Reply with the room\'s furniture and finishes and the reason for each choice, in the reader\'s language.',
  'Never state an area, quantity or price as a fact: the platform computes those in code.',
].join('\n');

@Injectable()
export class DeepAgentService {
  private readonly model: BaseChatModel | null;
  private readonly tools: ToolsService;

  constructor(@Inject(DEEP_MODEL) model: BaseChatModel | null, tools: ToolsService) {
    this.model = model;
    this.tools = tools;
  }

  /** One attempt at a task: the deep agent's turns until it answers in words. Returns that answer. */
  async run(task: Task, agent: AgentDef, usage: TaskUsage, note: string): Promise<string> {
    if (!this.model) throw new MimoError('MIMO_API_KEY or MIMO_BASE_URL is not set: the agents wait until both are');
    const tools = this.tools.specs(agent.tools).map((spec) =>
      tool(async (args: unknown) => JSON.stringify(await this.tools.run(spec.name, (args ?? {}) as Record<string, unknown>, task)), {
        name: spec.name,
        description: spec.description,
        schema: spec.parameters,
      }),
    );
    const graph = createDeepAgent({
      model: this.model,
      tools,
      systemPrompt: agent.instructions,
      subagents: [
        {
          name: 'room-designer',
          description: 'Designs one room in the chosen style. Give it the room, its size and openings, the style and the budget.',
          systemPrompt: ROOM_DESIGNER_PROMPT,
        },
      ],
    });
    let messages: unknown[];
    try {
      const result = await graph.invoke(
        { messages: [{ role: 'user', content: brief(task, note) }] },
        {
          recursionLimit: RECURSION_LIMIT,
          // Every model call, the sub-agents' too, adds to the task's cost.
          callbacks: [{ handleLLMEnd: (output: unknown) => addUsage(usage, output) }],
        },
      );
      messages = (result as { messages: unknown[] }).messages;
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.name === 'GraphRecursionError') throw new BrokenOutput(`no answer within ${RECURSION_LIMIT} steps`);
      throw new MimoError(why);
    }
    const last = [...messages].reverse().find((m) => AIMessage.isInstance(m));
    const text = last ? textOf((last as AIMessage).content) : '';
    if (!text) throw new BrokenOutput('the answer was empty');
    return text;
  }
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => (typeof block === 'string' ? block : (block as { type?: string; text?: string }).type === 'text' ? ((block as { text?: string }).text ?? '') : ''))
    .join('')
    .trim();
}

/** Adds what one model call reported to the task's usage. */
function addUsage(usage: TaskUsage, output: unknown): void {
  const generations = ((output as { generations?: { message?: { usage_metadata?: { input_tokens?: number; output_tokens?: number } } }[][] }).generations ?? []).flat();
  for (const generation of generations) {
    usage.inputTokens += generation.message?.usage_metadata?.input_tokens ?? 0;
    usage.outputTokens += generation.message?.usage_metadata?.output_tokens ?? 0;
  }
}
