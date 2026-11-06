// The MiMo API client (N3): one chat turn with tool calling, through a transport that can be
// swapped for a stub in the tests. The wire format is the OpenAI-style one most Chinese model
// APIs use — confirm it against the model access docs given at the event when the key arrives
// (the brief promises 模型接入文档).
//
// Settings (`.env.local`): `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL` (default MiMo-V2.6-Pro).

import type { TaskUsage } from '../db/schema.ts';

export interface MimoToolSpec {
  name: string;
  description: string;
  /** A JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface MimoMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** On an assistant message: the tool calls it made, echoed back on the next turn. */
  toolCalls?: MimoToolCall[];
  /** On a tool result: which call it answers, and the tool's name. */
  toolCallId?: string;
  name?: string;
}

export interface MimoToolCall {
  id: string;
  name: string;
  /** The arguments as JSON text, as the model sent them. */
  arguments: string;
}

export interface MimoResponse {
  content: string;
  toolCalls: MimoToolCall[];
  usage: TaskUsage;
}

export type MimoTransport = (messages: MimoMessage[], tools: MimoToolSpec[]) => Promise<MimoResponse>;

/** MiMo is down, slow, out of credits, or answered something we can't read. The task waits. */
export class MimoError extends Error {}

/** The answer held no content, or none in time. The agent gets one more try with the reason attached. */
export class BrokenOutput extends Error {}

export class MimoClient {
  private readonly transport: MimoTransport;

  constructor(transport: MimoTransport) {
    this.transport = transport;
  }

  async chat(messages: MimoMessage[], tools: MimoToolSpec[]): Promise<MimoResponse> {
    try {
      return await this.transport(messages, tools);
    } catch (error) {
      if (error instanceof MimoError) throw error;
      throw new MimoError(error instanceof Error ? error.message : String(error));
    }
  }
}

export interface MimoSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** The real transport: `POST {baseUrl}/chat/completions` with the OpenAI-style shape. */
export function httpTransport(settings: MimoSettings): MimoTransport {
  return async (messages, tools) => {
    if (!settings.apiKey || !settings.baseUrl) {
      throw new MimoError('MIMO_API_KEY or MIMO_BASE_URL is not set: the agents wait until both are');
    }
    const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.toolCalls ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) } : {}),
          ...(m.toolCallId ? { tool_call_id: m.toolCallId, name: m.name } : {}),
        })),
        tools: tools.map((t) => ({ type: 'function', function: t })),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new MimoError(`MiMo answered ${response.status}`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = body.choices?.[0]?.message;
    if (!message) throw new MimoError('MiMo answered without a message');
    return {
      content: message.content ?? '',
      toolCalls: (message.tool_calls ?? []).map((call) => ({ id: call.id, name: call.function.name, arguments: call.function.arguments })),
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
        images: 0,
      },
    };
  };
}
