import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { buildHomeRecord, containsPoint, findRoom, polygonAreaMm2 } from '../src/home-record.ts';
import type { FloorplanInput, HomeRecord, PlanRoom, Point } from '../src/home-record.ts';

// Written by `npm run sample` from floorplan-3d's built-in sample apartment.
const sample = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '../samples/floorplan-3d-sample.json'), 'utf8'),
) as FloorplanInput;

// floorplan-3d's 过道 (hall): an L shape, a 1540 × 1050 top plus a 1263 × 3240 leg.
const hall: Point[] = [[4820, 2320], [6360, 2320], [6360, 3370], [6083, 3370], [6083, 6610], [4820, 6610]];

test('polygonAreaMm2 handles rectangles, L shapes and either winding', () => {
  assert.equal(polygonAreaMm2([[0, 0], [1000, 0], [1000, 1000], [0, 1000]]), 1_000_000);
  assert.equal(polygonAreaMm2(hall), 1540 * 1050 + 1263 * 3240);
  assert.equal(polygonAreaMm2([...hall].reverse()), polygonAreaMm2(hall));
});

test('containsPoint tells inside from outside, including the notch of an L shape', () => {
  assert.equal(containsPoint(hall, [5450, 4450]), true);
  assert.equal(containsPoint(hall, [6200, 5000]), false);
  assert.equal(containsPoint(hall, [4000, 4000]), false);
});

test('findRoom falls back to the nearest room and marks it as guessed', () => {
  const rooms: PlanRoom[] = [
    { id: 'a', name: 'A', poly: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] },
    { id: 'b', name: 'B', poly: [[2000, 0], [3000, 0], [3000, 1000], [2000, 1000]] },
  ];
  assert.deepEqual(findRoom(rooms, [500, 500]), { roomId: 'a', guessed: false });
  assert.deepEqual(findRoom(rooms, [1800, 500]), { roomId: 'b', guessed: true });
});

test('the floorplan-3d sample becomes 13 rooms, 43 pieces of furniture and 3 appliances', () => {
  const home = buildHomeRecord(sample, { id: 'sample', name: '样板间', now: new Date('2026-11-05T00:00:00Z') });
  assert.equal(home.schema, 'studio.home/1');
  assert.equal(home.stage, 'design');
  assert.equal(home.updatedAt, '2026-11-05T00:00:00.000Z');
  assert.equal(home.rooms.length, 13);
  assert.equal(home.furniture.length, 43);
  assert.deepEqual(home.appliances.map((a) => a.id).sort(), ['fridge-1', 'stove-1', 'washer-1']);

  const all = [...home.furniture, ...home.appliances];
  assert.deepEqual(all.filter((i) => i.roomGuessed).map((i) => i.id), []);
  const roomOf = (id: string) => all.find((i) => i.id === id)?.roomId;
  assert.equal(roomOf('bed-1'), 'master');
  assert.equal(roomOf('baycushion-1'), 'bay1');
  assert.equal(roomOf('fridge-1'), 'dining');
  assert.equal(roomOf('shoecab-1'), 'living');
  assert.equal(roomOf('plant-3'), 'balcony');

  const room = (id: string) => home.rooms.find((r) => r.id === id);
  assert.equal(room('master')?.areaM2, 12.37);
  assert.equal(room('hall')?.areaM2, 5.71);
  assert.equal(room('dining')?.areaM2, 7.03);
  assert.equal(room('bay1')?.counted, false);
  assert.equal(room('living')?.counted, true);
});

test('rebuilding keeps the previous links and stage, as a copy', () => {
  const first = buildHomeRecord(sample, { id: 'h1', name: 'Home', stage: 'construction' });
  const link = (entityId: string, name: string) => ({ entityId, sent: { name, description: '' } });
  const previous: HomeRecord = {
    ...first,
    links: {
      homebox: {
        baseUrl: 'http://127.0.0.1:7745',
        groupId: 'g1',
        locations: { master: link('l1', '主卧室') },
        items: { 'bed-1': link('e1', '双人床') },
      },
    },
  };
  const second = buildHomeRecord(sample, { id: 'h1', name: 'Home', previous });
  assert.equal(second.stage, 'construction');
  assert.deepEqual(second.links, previous.links);
  second.links.homebox!.items['sofa-1'] = link('e2', '三人沙发');
  assert.equal(previous.links.homebox!.items['sofa-1'], undefined);
  assert.equal(buildHomeRecord(sample, { id: 'h1', name: 'Home', previous, stage: 'move-in' }).stage, 'move-in');
});

test('prices from the budget are attached to the matching items', () => {
  const home = buildHomeRecord(sample, { id: 'h1', name: 'Home', prices: { 'sofa-1': 4999, 'fridge-1': 3299 } });
  assert.equal(home.furniture.find((i) => i.id === 'sofa-1')?.priceCny, 4999);
  assert.equal(home.appliances.find((i) => i.id === 'fridge-1')?.priceCny, 3299);
  assert.equal(home.furniture.find((i) => i.id === 'bed-1')?.priceCny, undefined);
});

test('bad input is rejected', () => {
  const room = sample.rooms[0]!;
  const opts = { id: 'h', name: 'h' };
  assert.throws(() => buildHomeRecord({ rooms: [room, room], furniture: [] }, opts), /duplicate id "master"/);
  assert.throws(() => buildHomeRecord({ rooms: [], furniture: [] }, opts), /no rooms/);
  assert.throws(
    () => buildHomeRecord({ rooms: [{ ...room, poly: [[0, 0], [1, 1]] }], furniture: [] }, opts),
    /at least 3 corners/,
  );
  const badChair = { id: 'chair-1', type: 'chair', name: '椅子', cx: Number.NaN, cy: 0, w: 450, d: 480 };
  assert.throws(() => buildHomeRecord({ rooms: [room], furniture: [badChair] }, opts), /numeric cx/);
  const previous = buildHomeRecord(sample, { id: 'other', name: 'Other' });
  assert.throws(() => buildHomeRecord(sample, { ...opts, previous }), /previous record is for home "other"/);
});
