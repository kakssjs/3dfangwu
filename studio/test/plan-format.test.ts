// The plan JSON format on its own, with no database and no server (F2:
// src/api/homes/plan-format.ts; studio/docs/plan-format.md). The real sample apartment
// (samples/plan-sample.json, extracted from floorplan-3d) must pass every check.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  isRemovableWall,
  planBounds,
  validateDesignState,
  validatePlan,
  type PlanDocument,
} from '../src/api/homes/plan-format.ts';

const sample: PlanDocument = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'samples/plan-sample.json'), 'utf8'),
);

/** A small valid plan, one room in a 4m × 3m box, to break in one field at a time. */
function plan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'studio.plan/1',
    units: 'mm',
    name: '测试户型',
    walls: [[0, 0, 4000, 0, 'e'], [4000, 0, 4000, 3000, 'n']],
    windows: [[1000, 0, 2000, 0]],
    doors: [{ name: '入户门', rect: [0, 1000, 0, 2000], h: [0, 2000], c: [1, 0], o: [0, 1], len: 900, entry: true }],
    slidingDoors: [{ rect: [4000, 1000, 4000, 2000], v: false }],
    rooms: [{ id: 'living', name: '客厅', nameEn: 'Living Room', poly: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], mat: 'tile800' }],
    ...overrides,
  };
}

describe('validatePlan', () => {
  test('the real sample apartment passes every check', () => {
    assert.deepEqual(validatePlan(sample), []);
  });

  test('a minimal plan passes', () => {
    assert.deepEqual(validatePlan(plan()), []);
    assert.deepEqual(validatePlan(plan({ furniture: [] })), []);
  });

  test('a document that is not an object is refused', () => {
    assert.deepEqual(validatePlan('nope'), ['plan: needs to be an object']);
    assert.deepEqual(validatePlan(null), ['plan: needs to be an object']);
    assert.deepEqual(validatePlan([]), ['plan: needs to be an object']);
  });

  test('the schema and the units are named', () => {
    const errors = validatePlan(plan({ schema: 'other/1', units: 'cm' }));
    assert.equal(errors.length, 2);
    assert.match(errors[0]!, /studio\.plan\/1/);
    assert.match(errors[1]!, /millimetres/);
  });

  test('unknown fields are refused, so a typo is never silent', () => {
    const errors = validatePlan(plan({ colour: 'red' }));
    assert.deepEqual(errors, ['plan: unknown field "colour"']);
    const nested = validatePlan({ ...plan(), rooms: [{ id: 'a', name: '客厅', poly: [[0, 0], [1, 0], [0, 1]], typo: 1 }] });
    assert.deepEqual(nested, ['plan.rooms[0]: unknown field "typo"']);
  });

  test('walls need 4 numbers and a known type', () => {
    assert.match(validatePlan(plan({ walls: [[0, 0, 4000, 0]] }))[0]!, /plan\.walls\[0\]/);
    const typed = validatePlan(plan({ walls: [[0, 0, 4000, 0, 'x']] }));
    assert.equal(typed.length, 1);
    assert.match(typed[0]!, /unknown type "x".*b, e, n, low/);
  });

  test('a plan needs at least one room, each with a unique id and a polygon', () => {
    assert.match(validatePlan(plan({ rooms: [] }))[0]!, /at least one room/);
    const twice = validatePlan(plan({
      rooms: [
        { id: 'a', name: '客厅', poly: [[0, 0], [1, 0], [0, 1]] },
        { id: 'a', name: '卧室', poly: [[0, 0], [1, 0], [0, 1]] },
      ],
    }));
    assert.equal(twice.length, 1);
    assert.match(twice[0]!, /used by two rooms/);
    assert.match(validatePlan(plan({ rooms: [{ id: 'a', name: '客厅', poly: [[0, 0], [1, 0]] }] }))[0]!, /at least 3 points/);
    assert.match(validatePlan(plan({ rooms: [{ id: 'a', name: '', poly: [[0, 0], [1, 0], [0, 1]] }] }))[0]!, /name/);
  });

  test('a room carries its English name for the English reader (D10)', () => {
    assert.deepEqual(validatePlan(plan({ rooms: [{ id: 'a', name: '客厅', nameEn: 'Living Room', poly: [[0, 0], [1, 0], [0, 1]] }] })), []);
    assert.match(validatePlan(plan({ rooms: [{ id: 'a', name: '客厅', nameEn: '', poly: [[0, 0], [1, 0], [0, 1]] }] }))[0]!, /nameEn/);
  });

  test('doors need their opening, hinge, directions and leaf width', () => {
    const errors = validatePlan(plan({ doors: [{ name: '门', rect: [0, 0, 1, 1], h: [0, 0], c: [1, 0], o: [0, 1] }] }));
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /plan\.doors\[0\]\.len/);
    assert.match(validatePlan(plan({ doors: [{ name: '门', rect: [0, 0, 1], h: [0, 0], c: [1, 0], o: [0, 1], len: 900 }] }))[0]!, /rect/);
  });

  test('furniture is optional; what there is needs sizes above 0 and unique ids', () => {
    assert.deepEqual(validatePlan(plan({ furniture: undefined })), []);
    const bad = validatePlan(plan({ furniture: [{ id: 'f1', type: 'bed', name: '双人床', cx: 0, cy: 0, w: 0, d: 2000 }] }));
    assert.equal(bad.length, 1);
    assert.match(bad[0]!, /furniture\[0\]\.w/);
    const twice = validatePlan(plan({ furniture: [
      { id: 'f1', type: 'bed', name: '双人床', cx: 0, cy: 0, w: 100, d: 200 },
      { id: 'f1', type: 'sofa', name: '沙发', cx: 0, cy: 0, w: 100, d: 200 },
    ] }));
    assert.match(twice[0]!, /used by two pieces/);
  });
});

describe('validateDesignState', () => {
  const state = {
    furniture: [{ id: 'f1', type: 'bed', name: '双人床', cx: 8300, cy: 1000, w: 1800, d: 2000, rot: 0 }],
    rooms: { master: { name: '主卧室', nameEn: 'Master Bedroom', mat: 'wood' } },
    demolished: ['w42'],
    measures: [{ a: { x: 0, y: 0 }, b: { x: 3370, y: 0 } }],
  };

  test('what floorplan-3d exports passes', () => {
    assert.deepEqual(validateDesignState(state), []);
    assert.deepEqual(validateDesignState({ furniture: [], rooms: {}, demolished: [], measures: [] }), []);
  });

  test('each part is checked', () => {
    assert.match(validateDesignState({ ...state, rooms: { master: { name: '主卧室' } } })[0]!, /\.mat/);
    assert.match(validateDesignState({ ...state, measures: [{ a: { x: 0 }, b: { x: 1, y: 2 } }] })[0]!, /measures\[0\]/);
    assert.match(validateDesignState({ ...state, demolished: [42] })[0]!, /wall id/);
    assert.match(validateDesignState({ furniture: [] })[0]!, /design\.rooms/);
    assert.deepEqual(validateDesignState('nope'), ['design: needs to be an object']);
  });
});

describe('planBounds and isRemovableWall', () => {
  test('the sample keeps its own bounds; a plan without bounds gets one from its walls and rooms', () => {
    assert.deepEqual(planBounds(sample), sample.bounds);
    const bounds = planBounds({ walls: [[0, 0, 4000, 0, 'e']], windows: [[0, 0, 1000, 0]], rooms: [{ id: 'a', name: '客厅', poly: [[0, 0], [4000, 0], [4000, 3000]] }] });
    assert.deepEqual(bounds, { x: -400, y: -400, w: 4800, h: 3800 });
  });

  test('only removable non-bearing and low walls may be demolished; bearing, exterior and unknown ones never', () => {
    assert.equal(isRemovableWall([0, 0, 1, 1, 'b']), false);
    assert.equal(isRemovableWall([0, 0, 1, 1, 'e']), false);
    assert.equal(isRemovableWall([0, 0, 1, 1, 'n']), true);
    assert.equal(isRemovableWall([0, 0, 1, 1, 'low']), true);
    assert.equal(isRemovableWall([0, 0, 1, 1, 'what']), false);
  });
});
