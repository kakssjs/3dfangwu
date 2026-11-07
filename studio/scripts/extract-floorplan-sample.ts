// Writes samples/floorplan-3d-sample.json from floorplan-3d's built-in sample apartment (三室两厅两卫),
// and samples/plan-sample.json — the same apartment as a full plan document in the F2 format
// (studio/docs/plan-format.md). It reads floorplan-3d/index.html as plain text and parses the ROOMS
// list, the defaultFurniture() calls and the walls, openings and bounds with regular expressions.
// Nothing from that file is executed.
//
// Usage: npm run sample -- [path/to/floorplan-3d/index.html] [output.json] [plan-output.json]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FloorplanInput, PlacedFurniture, PlanRoom, Point } from '../src/home-record.ts';
import type {
  PlanDocument,
  PlanDoor,
  PlanFurnitureDoc,
  PlanRoomDoc,
  PlanSlidingDoor,
  PlanWall,
  PlanWindow,
} from '../src/api/homes/plan-format.ts';

const studioDir = path.resolve(import.meta.dirname, '..');
const source = path.resolve(process.argv[2] ?? path.join(studioDir, '../floorplan-3d/index.html'));
const output = path.resolve(process.argv[3] ?? path.join(studioDir, 'samples/floorplan-3d-sample.json'));
const planOutput = path.resolve(process.argv[4] ?? path.join(studioDir, 'samples/plan-sample.json'));

const html = readFileSync(source, 'utf8');

function block(start: string, end: string): string {
  const from = html.indexOf(start);
  if (from < 0) throw new Error(`"${start}" not found in ${source}`);
  const to = html.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`end of "${start}" not found in ${source}`);
  return html.slice(from + start.length, to);
}

function numbers(text: string): number[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

// R(x0,y0,x1,y1) is floorplan-3d's rectangle helper (index.html: const R = ...).
function rect([x0, y0, x1, y1]: number[]): Point[] {
  if ([x0, y0, x1, y1].some((n) => n === undefined)) throw new Error('R() needs 4 numbers');
  return [[x0!, y0!], [x1!, y0!], [x1!, y1!], [x0!, y1!]];
}

const rooms: PlanRoom[] = [];
const planRooms: PlanRoomDoc[] = [];
for (const line of block('ROOMS = [', '\n];').split('\n')) {
  const head = line.match(/\{id:'([^']+)',\s*name:'([^']+)',\s*poly:/);
  if (!head) continue;
  const rectMatch = line.match(/poly:R\(([^)]*)\)/);
  const listMatch = line.match(/poly:(\[\[.*?\]\])/);
  let poly: Point[];
  if (rectMatch) {
    poly = rect(numbers(rectMatch[1]!));
  } else if (listMatch) {
    const n = numbers(listMatch[1]!);
    poly = [];
    for (let i = 0; i + 1 < n.length; i += 2) poly.push([n[i]!, n[i + 1]!]);
  } else {
    throw new Error(`cannot read the polygon of room "${head[1]}"`);
  }
  const room: PlanRoom = { id: head[1]!, name: head[2]!, poly };
  if (/counted:false/.test(line)) room.counted = false;
  rooms.push(room);
  const planRoom: PlanRoomDoc = { id: room.id, name: room.name, poly };
  if (room.counted === false) planRoom.counted = false;
  const mat = line.match(/mat:'([^']+)'/);
  if (mat) planRoom.mat = mat[1]!;
  const at = line.match(/at:\[(-?\d+),(-?\d+)\]/);
  if (at) planRoom.at = [Number(at[1]), Number(at[2])];
  planRooms.push(planRoom);
}

// The English names floorplan-3d keeps for its built-in names (NAMES_EN), so the plan carries each
// room's English form (F2, D10). Names the homeowner changes get `nameEn` from the plan instead.
const namesEn = new Map<string, string>();
for (const m of block('NAMES_EN = {', '\n};').matchAll(/'([^']+)'\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
  namesEn.set(m[1]!, m[2] ?? m[3] ?? '');
}
for (const room of planRooms) {
  const en = namesEn.get(room.name);
  if (en) room.nameEn = en;
}

// 墙体 [x0,y0,x1,y1,'type'], 窗 [x0,y0,x1,y1], 平开门 {name,rect,h,c,o,len,entry?}, 推拉门 {rect,v}.
const walls: PlanWall[] = [];
for (const m of block('WALLS = [', '\n];').matchAll(/\[(-?\d+),(-?\d+),(-?\d+),(-?\d+),'([a-z]+)'\]/g)) {
  walls.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), m[5]!]);
}
const windows: PlanWindow[] = [];
for (const m of block('WINS = [', '\n];').matchAll(/\[(-?\d+),(-?\d+),(-?\d+),(-?\d+)\]/g)) {
  windows.push([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
}
const doors: PlanDoor[] = [];
for (const line of block('DOORS = [', '\n];').split('\n')) {
  const name = line.match(/name:'([^']+)'/);
  const rect = line.match(/rect:\[(-?\d+),(-?\d+),(-?\d+),(-?\d+)\]/);
  const pair = (key: string) => {
    const m = line.match(new RegExp(`${key}:\\[(-?\\d+),(-?\\d+)\\]`));
    return m ? ([Number(m[1]), Number(m[2])] as Point) : undefined;
  };
  const h = pair('h');
  const c = pair('c');
  const o = pair('o');
  const len = line.match(/len:(\d+)/);
  if (!name || !rect || !h || !c || !o || !len) {
    if (/name:/.test(line)) throw new Error(`cannot read door line: ${line.trim()}`);
    continue;
  }
  const door: PlanDoor = {
    name: name[1]!,
    rect: [Number(rect[1]), Number(rect[2]), Number(rect[3]), Number(rect[4])],
    h,
    c,
    o,
    len: Number(len[1]),
  };
  if (/entry:true/.test(line)) door.entry = true;
  doors.push(door);
}
const slidingDoors: PlanSlidingDoor[] = [];
for (const line of block('SLIDES = [', '\n];').split('\n')) {
  const rect = line.match(/rect:\[(-?\d+),(-?\d+),(-?\d+),(-?\d+)\]/);
  const v = line.match(/v:(true|false)/);
  if (!rect || !v) {
    if (/rect:/.test(line)) throw new Error(`cannot read sliding door line: ${line.trim()}`);
    continue;
  }
  slidingDoors.push({ rect: [Number(rect[1]), Number(rect[2]), Number(rect[3]), Number(rect[4])], v: v[1] === 'true' });
}

// BOUNDS: the editor's view of the drawing (index.html).
const boundsMatch = block('BOUNDS = {', '};').match(/x:(-?\d+),\s*y:(-?\d+),\s*w:(\d+),\s*h:(\d+)/);
if (!boundsMatch) throw new Error('cannot read BOUNDS');
const bounds = { x: Number(boundsMatch[1]), y: Number(boundsMatch[2]), w: Number(boundsMatch[3]), h: Number(boundsMatch[4]) };

// The title above the drawing (index.html's brand line): 三室两厅两卫 · 3BR 2LR 2BA.
const brand = html.match(/<b data-en="([^"·]+?)\s*·[^"]*">\s*([^ ·<]+)/);
const name = brand?.[2] ?? '三室两厅两卫';
const nameEn = brand?.[1] ?? '3BR 2LR 2BA';

const furniture: PlacedFurniture[] = [];
const perType = new Map<string, number>();
for (const call of block('function defaultFurniture(){ return [', '];}').matchAll(/F\(([^)]*)\)/g)) {
  const args = call[1]!.split(',').map((a) => a.trim().replace(/^'(.*)'$/, '$1'));
  const [type, name, cx, cy, w, d, rot] = args;
  if (!type || !name || [cx, cy, w, d].some((v) => v === undefined || Number.isNaN(Number(v)))) {
    throw new Error(`cannot read furniture call F(${call[1]})`);
  }
  const n = (perType.get(type) ?? 0) + 1;
  perType.set(type, n);
  furniture.push({
    id: `${type}-${n}`,
    type,
    name,
    cx: Number(cx),
    cy: Number(cy),
    w: Number(w),
    d: Number(d),
    rot: rot === undefined ? 0 : Number(rot),
  });
}

if (rooms.length === 0 || furniture.length === 0) throw new Error('no rooms or furniture found');
if (walls.length === 0 || planRooms.length !== rooms.length) throw new Error('no walls found, or the plan rooms and the sample rooms differ');

const sample: FloorplanInput & { source: string; units: string } = {
  source: 'floorplan-3d/index.html: built-in sample apartment (ROOMS and defaultFurniture)',
  units: 'mm',
  rooms,
  furniture,
};
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(sample, null, 2) + '\n', 'utf8');
console.log(`Wrote ${path.relative(process.cwd(), output)}: ${rooms.length} rooms, ${furniture.length} pieces of furniture`);

// The same apartment as a plan document in the F2 format (studio/docs/plan-format.md).
const planFurniture: PlanFurnitureDoc[] = furniture.map(({ id, type, name: item, cx, cy, w, d, rot }) => ({
  id, type, name: item, cx, cy, w, d, rot: rot ?? 0,
}));
const plan: PlanDocument = {
  schema: 'studio.plan/1',
  units: 'mm',
  name,
  nameEn,
  bounds,
  walls,
  windows,
  doors,
  slidingDoors,
  rooms: planRooms,
  furniture: planFurniture,
};
writeFileSync(planOutput, JSON.stringify(plan, null, 2) + '\n', 'utf8');
console.log(`Wrote ${path.relative(process.cwd(), planOutput)}: ${walls.length} walls, ${windows.length} windows, ${doors.length} doors, ${slidingDoors.length} sliding doors`);
