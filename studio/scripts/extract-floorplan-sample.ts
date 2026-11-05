// Writes samples/floorplan-3d-sample.json from floorplan-3d's built-in sample apartment (三室两厅两卫).
// It reads floorplan-3d/index.html as plain text and parses the ROOMS list and the defaultFurniture()
// calls with regular expressions. Nothing from that file is executed.
//
// Usage: npm run sample -- [path/to/floorplan-3d/index.html] [output.json]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FloorplanInput, PlacedFurniture, PlanRoom, Point } from '../src/home-record.ts';

const studioDir = path.resolve(import.meta.dirname, '..');
const source = path.resolve(process.argv[2] ?? path.join(studioDir, '../floorplan-3d/index.html'));
const output = path.resolve(process.argv[3] ?? path.join(studioDir, 'samples/floorplan-3d-sample.json'));

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
for (const line of block('const ROOMS = [', '\n];').split('\n')) {
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
}

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

const sample: FloorplanInput & { source: string; units: string } = {
  source: 'floorplan-3d/index.html: built-in sample apartment (ROOMS and defaultFurniture)',
  units: 'mm',
  rooms,
  furniture,
};
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(sample, null, 2) + '\n', 'utf8');
console.log(`Wrote ${path.relative(process.cwd(), output)}: ${rooms.length} rooms, ${furniture.length} pieces of furniture`);
