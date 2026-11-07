// N4: a floor-plan photo becomes plan JSON through MiMo vision (WORKFLOW.md build order 9), checked
// against the F2 format (plan-format.ts), with an overlay image so a person can check the reading by
// eye (WORKFLOW.md section 8). The model is the one configured for the agents (`.env.local`): MiMo
// for the event (D9), or another OpenAI-style vision endpoint the boss approves. The prompt and the
// checks are ours; only the reading is the model's.

import type { MimoClient, MimoMessage } from '../agents/mimo.ts';
import type { TaskUsage } from '../db/schema.ts';
import { validatePlan, type PlanDocument, type PlanWall } from './plan-format.ts';

const SYSTEM_PROMPT = `You read Chinese apartment floor-plan drawings (户型图) into one plan document.
Answer with ONLY one JSON object, no markdown, no commentary, in exactly this shape (all numbers in
millimetres, schema "studio.plan/1"):

{
  "schema": "studio.plan/1",
  "units": "mm",
  "name": "户型的中文名，例如 三室两厅两卫",
  "nameEn": "its English form",
  "bounds": {"x": 0, "y": 0, "w": 10000, "h": 8000},
  "walls": [[x0, y0, x1, y1, "b|e|n|low"], ...],
  "windows": [[x0, y0, x1, y1], ...],
  "doors": [{"name": "门的中文名", "rect": [x0, y0, x1, y1], "h": [x, y], "c": [dx, dy], "o": [dx, dy], "len": 900, "entry": true}],
  "slidingDoors": [{"rect": [x0, y0, x1, y1], "v": false}],
  "rooms": [{"id": "english-slug", "name": "房间中文名", "nameEn": "English name", "poly": [[x, y], ...], "at": [x, y]}],
  "furniture": [{"id": "f1", "type": "bed", "name": "家具中文名", "cx": 0, "cy": 0, "w": 1800, "d": 2000, "rot": 0}]
}

How to read the drawing:
- Find the dimensions (尺寸标注) first and set the scale: every number you output is in mm. The
  origin is the inside face of the outer wall at the top left; x grows right, y grows down.
- Walls are segments with a type: "e" exterior (外墙, the outside ring), "b" bearing (承重, thicker
  or blackened; may not be removed), "n" removable non-bearing (可拆非承重, thinner interior walls),
  "low" a low wall (矮墙). Use only these four types.
- Windows and doors sit in wall openings. A door needs the opening rect, its hinge point "h", the
  closed direction "c" and the open direction "o" (each one of [1,0] [-1,0] [0,1] [0,-1]), and the
  leaf width "len". Mark the entrance door with "entry": true.
- Rooms: every room a person names on the drawing (客厅, 卧室, 厨房, 卫生间, 阳台, 飘窗...), its
  polygon from wall to wall (inner faces), a short English id, the Chinese name, its English name,
  and "at" where the label sits. Bay windows (飘窗) get "counted": false.
- Furniture only when the drawing shows it; otherwise leave "furniture" out.
- If the image is not a floor-plan drawing, or the drawing is too unclear to read, answer with ONLY
  {"error": "one line saying why"}.`;

export interface FloorPlanReading {
  plan: PlanDocument;
  /** What the model answered, for the task record. */
  raw: string;
  usage: TaskUsage;
}

export class UnreadablePlan extends Error {}

/** One floor-plan photo → plan JSON, checked against F2. One retry with the check failures attached. */
export async function readFloorPlan(mimo: MimoClient, imageDataUrl: string): Promise<FloorPlanReading> {
  const messages: MimoMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: 'Read this floor plan into the plan document.', images: [imageDataUrl] },
  ];
  let usage: TaskUsage = { inputTokens: 0, outputTokens: 0, images: 0 };
  let lastErrors: string[] = ['the model answered nothing readable'];
  for (let attempt = 0; attempt < 2; attempt++) {
    // Reading a drawing and writing its plan document can take minutes on a thinking model.
    const reply = await mimo.chat(messages, [], { timeoutMs: 300_000 });
    usage = {
      inputTokens: usage.inputTokens + reply.usage.inputTokens,
      outputTokens: usage.outputTokens + reply.usage.outputTokens,
      images: usage.images + reply.usage.images,
    };
    const raw = extractJson(reply.content);
    const parsed = parseAnswer(raw);
    // {"error": "..."} is the model's definitive answer (the image is not a floor plan): no retry.
    if (parsed.error !== undefined) throw new UnreadablePlan(parsed.error);
    const errors = typeof parsed.parseFailure === 'string' ? [parsed.parseFailure] : validatePlan(parsed);
    if (errors.length === 0) return { plan: parsed as unknown as PlanDocument, raw, usage };
    lastErrors = errors;
    // One more turn, with the check failures attached, like the runner's retry on broken output.
    messages.push({ role: 'assistant', content: reply.content });
    messages.push({ role: 'user', content: `These checks failed:\n${lastErrors.join('\n')}\nFix them and answer again with ONLY the corrected JSON.` });
  }
  // Both readings failed the checks: the failures are what the person needs to see.
  throw new UnreadablePlan(lastErrors.join('; '));
}

/** The model's answer as an object: the first {...} block, tolerating ```json fences around it. */
export function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced?.[1] ?? content;
  const from = text.indexOf('{');
  const to = text.lastIndexOf('}');
  return from >= 0 && to > from ? text.slice(from, to + 1) : text.trim();
}

function parseAnswer(raw: string): { error?: string } & Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
    return { parseFailure: 'the answer was not a JSON object' };
  } catch {
    return { parseFailure: 'the answer was not readable JSON' };
  }
}

/**
 * The overlay (N4, WORKFLOW.md section 8): the source photo with the reading drawn over it, as one
 * SVG. Both are fitted to the plan's bounds and centred, so a person can eye-check the shapes,
 * the wall types and the room names against the drawing. What they fix, they fix in the editor (F1).
 */
export function planOverlaySvg(plan: PlanDocument, photoDataUrl?: string): string {
  const b = plan.bounds ?? planBoundsOf(plan);
  const scale = (v: number) => Math.round(v * 10) / 10;
  const photo = photoDataUrl
    ? `<image href="${photoDataUrl}" x="${scale(b.x)}" y="${scale(b.y)}" width="${scale(b.w)}" height="${scale(b.h)}" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  const walls = plan.walls.map((wall) => wallLine(wall)).join('');
  const windows = plan.windows
    .map(([x0, y0, x1, y1]) => `<line x1="${scale(x0)}" y1="${scale(y0)}" x2="${scale(x1)}" y2="${scale(y1)}" stroke="#2b7fd4" stroke-width="120" stroke-linecap="square"/>`)
    .join('');
  const openings = [...plan.doors.map((d) => d.rect), ...plan.slidingDoors.map((d) => d.rect)]
    .map(([x0, y0, x1, y1]) => `<rect x="${scale(Math.min(x0, x1))}" y="${scale(Math.min(y0, y1))}" width="${scale(Math.abs(x1 - x0))}" height="${scale(Math.abs(y1 - y0))}" fill="none" stroke="#c98a2b" stroke-width="80"/>`)
    .join('');
  const rooms = plan.rooms
    .map((room) => {
      const points = room.poly.map(([x, y]) => `${scale(x)},${scale(y)}`).join(' ');
      const [ax, ay] = room.at ?? centre(room.poly);
      return `<polygon points="${points}" fill="#16a34a" fill-opacity="0.18" stroke="#16a34a" stroke-width="40"/><text x="${scale(ax)}" y="${scale(ay)}" font-size="380" text-anchor="middle" fill="#0f5c2e">${escapeXml(room.name)}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${scale(b.x)} ${scale(b.y)} ${scale(b.w)} ${scale(b.h)}">
${photo}
<g opacity="0.85">${rooms}${walls}${windows}${openings}</g>
</svg>
`;
}

function wallLine([x0, y0, x1, y1, type]: PlanWall): string {
  const scale = (v: number) => Math.round(v * 10) / 10;
  // Bearing and exterior walls are drawn heavy, removable ones lighter: what may be demolished (N6).
  const width = type === 'e' ? 220 : type === 'b' ? 180 : type === 'low' ? 60 : 100;
  const colour = type === 'n' ? '#6b7280' : '#1f2937';
  return `<line x1="${scale(x0)}" y1="${scale(y0)}" x2="${scale(x1)}" y2="${scale(y1)}" stroke="${colour}" stroke-width="${width}" stroke-linecap="square"/>`;
}

function centre(poly: [number, number][]): [number, number] {
  const n = poly.length;
  return [poly.reduce((s, [x]) => s + x, 0) / n, poly.reduce((s, [, y]) => s + y, 0) / n];
}

function planBoundsOf(plan: Pick<PlanDocument, 'walls' | 'windows' | 'rooms'>): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  for (const [ax, ay, bx, by] of plan.walls) { take(ax, ay); take(bx, by); }
  for (const room of plan.rooms) for (const [x, y] of room.poly) take(x, y);
  return { x: x0 - 400, y: y0 - 400, w: x1 - x0 + 800, h: y1 - y0 + 800 };
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
