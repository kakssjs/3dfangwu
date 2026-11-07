// F2: the plan JSON format (schema `studio.plan/1`) that the Floor-plan agent must produce and
// floorplan-3d loads (WORKFLOW.md build order 9). The shapes are floorplan-3d's own data shapes in
// millimetres (home-record.ts uses the same ones), so the loader in `floorplan-3d/index.html` can
// assign them straight to its `WALLS`, `WINS`, `DOORS`, `SLIDES` and `ROOMS`. The format is written
// down in `studio/docs/plan-format.md`; this file checks it, in the API and on load. No database,
// clock or randomness: anyone can read and test it on its own (like `matching/fit.ts`).

export const PLAN_SCHEMA = 'studio.plan/1';

/** b = bearing (承重), e = exterior (外墙), n = removable non-bearing (可拆非承重), low = low wall (矮墙). */
export const WALL_TYPES = ['b', 'e', 'n', 'low'] as const;
export type WallType = (typeof WALL_TYPES)[number];

export type Pt = [number, number];

/** [x0, y0, x1, y1, type]: a wall segment in mm, with its type (F2). */
export type PlanWall = [number, number, number, number, string];

/** [x0, y0, x1, y1]: a window's opening in mm. */
export type PlanWindow = [number, number, number, number];

/** A hinged door: opening, hinge point, closed direction, open direction, leaf width (floorplan-3d's DOORS). */
export interface PlanDoor {
  name: string;
  rect: [number, number, number, number];
  h: Pt;
  /** Closed direction: one of [-1,0], [1,0], [0,-1], [0,1]. */
  c: Pt;
  /** Open direction: one of [-1,0], [1,0], [0,-1], [0,1]. */
  o: Pt;
  len: number;
  /** The entrance door (入户门). */
  entry?: boolean;
}

/** A sliding door (推拉门): opening, and whether it slides vertically. */
export interface PlanSlidingDoor {
  rect: [number, number, number, number];
  v: boolean;
}

/** A room: a Chinese name and its optional English form (F2, D10), with its polygon in mm. */
export interface PlanRoomDoc {
  id: string;
  name: string;
  nameEn?: string;
  poly: Pt[];
  /** The default flooring material key (floorplan-3d's `MATS`); the design version may change it. */
  mat?: string;
  /** Where the room's label goes. Defaults to the polygon's centre. */
  at?: Pt;
  /** floorplan-3d sets `counted: false` on areas that don't count toward the floor area (bay windows). */
  counted?: boolean;
}

/** Optional furniture (F2), placed by its centre point, as floorplan-3d's `F()` builds it. */
export interface PlanFurnitureDoc {
  id?: string;
  type: string;
  name: string;
  cx: number;
  cy: number;
  w: number;
  d: number;
  rot?: number;
  color?: string;
}

export interface PlanBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanDocument {
  schema: typeof PLAN_SCHEMA;
  units: 'mm';
  /** The home's title in Chinese, for example 三室两厅两卫. */
  name?: string;
  nameEn?: string;
  /** The drawing's extent. Computed from the walls and rooms when left out. */
  bounds?: PlanBounds;
  walls: PlanWall[];
  windows: PlanWindow[];
  doors: PlanDoor[];
  slidingDoors: PlanSlidingDoor[];
  rooms: PlanRoomDoc[];
  furniture?: PlanFurnitureDoc[];
}

export const PLAN_FIELDS = [
  'schema', 'units', 'name', 'nameEn', 'bounds', 'walls', 'windows', 'doors', 'slidingDoors', 'rooms', 'furniture',
] as const;

/** What one saved design version holds (F6): the same state floorplan-3d's "Export plan JSON" writes. */
export interface DesignState {
  furniture: PlanFurnitureDoc[];
  /** room id → the names and flooring the homeowner chose. */
  rooms: Record<string, { name: string; nameEn?: string; mat: string }>;
  /** The ids of the walls the homeowner demolished (`w0`, `w1`, ... by their index in `plan.walls`). */
  demolished: string[];
  /** The measurements the homeowner drew: two points in mm. */
  measures: { a: Pt; b: Pt }[];
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPt(value: unknown): value is Pt {
  return Array.isArray(value) && value.length === 2 && value.every(isNum);
}

function unknownFields(value: Record<string, unknown>, known: readonly string[], where: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!known.includes(key)) errors.push(`${where}: unknown field "${key}"`);
  }
}

function checkRect(value: unknown, where: string, errors: string[]): boolean {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isNum)) {
    errors.push(`${where}: needs [x0, y0, x1, y1] with 4 numbers`);
    return false;
  }
  return true;
}

function checkFurniture(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: needs to be an object`);
    return;
  }
  unknownFields(value, ['id', 'type', 'name', 'cx', 'cy', 'w', 'd', 'rot', 'color'], where, errors);
  for (const key of ['type', 'name'] as const) {
    if (typeof value[key] !== 'string' || value[key] === '') errors.push(`${where}.${key}: needs a non-empty string`);
  }
  for (const key of ['cx', 'cy', 'w', 'd'] as const) {
    if (!isNum(value[key])) errors.push(`${where}.${key}: needs a number`);
  }
  if (isNum(value.w) && value.w <= 0) errors.push(`${where}.w: needs to be above 0`);
  if (isNum(value.d) && value.d <= 0) errors.push(`${where}.d: needs to be above 0`);
  if (value.id !== undefined && (typeof value.id !== 'string' || value.id === '')) errors.push(`${where}.id: needs a non-empty string`);
  if (value.rot !== undefined && !isNum(value.rot)) errors.push(`${where}.rot: needs a number`);
  if (value.color !== undefined && typeof value.color !== 'string') errors.push(`${where}.color: needs a string`);
}

/**
 * Checks a plan document against the F2 format. Returns one line per problem, in English like the
 * API's other error messages; an empty list means the document is valid. Unknown fields are
 * refused, so a typo never loads as silence (N19's rule for every request).
 */
export function validatePlan(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['plan: needs to be an object'];
  unknownFields(value, PLAN_FIELDS, 'plan', errors);
  if (value.schema !== PLAN_SCHEMA) errors.push(`plan.schema: needs to be "${PLAN_SCHEMA}"`);
  if (value.units !== 'mm') errors.push('plan.units: needs to be "mm" (every number is in millimetres)');
  for (const key of ['name', 'nameEn'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key] === '')) errors.push(`plan.${key}: needs a non-empty string`);
  }
  if (value.bounds !== undefined) {
    if (!isRecord(value.bounds)) {
      errors.push('plan.bounds: needs to be an object');
    } else {
      unknownFields(value.bounds, ['x', 'y', 'w', 'h'], 'plan.bounds', errors);
      for (const key of ['x', 'y', 'w', 'h'] as const) {
        if (!isNum(value.bounds[key])) errors.push(`plan.bounds.${key}: needs a number`);
      }
    }
  }

  if (!Array.isArray(value.walls)) {
    errors.push('plan.walls: needs to be an array of [x0, y0, x1, y1, type]');
  } else {
    value.walls.forEach((wall, i) => {
      const where = `plan.walls[${i}]`;
      if (!Array.isArray(wall) || wall.length !== 5 || !wall.slice(0, 4).every(isNum) || typeof wall[4] !== 'string' || wall[4] === '') {
        errors.push(`${where}: needs [x0, y0, x1, y1, type] with 4 numbers and a type`);
      } else if (!(WALL_TYPES as readonly string[]).includes(wall[4])) {
        // Refused here so the Floor-plan agent fixes its output; `isBearingWall` below still treats
        // a wall of unknown type as load-bearing (N6) for anything built past this check.
        errors.push(`${where}: unknown type "${wall[4]}" (known: ${WALL_TYPES.join(', ')})`);
      }
    });
  }

  if (!Array.isArray(value.windows)) {
    errors.push('plan.windows: needs to be an array of [x0, y0, x1, y1]');
  } else {
    value.windows.forEach((window_, i) => {
      if (!checkRect(window_, `plan.windows[${i}]`, errors)) return;
    });
  }

  if (!Array.isArray(value.doors)) {
    errors.push('plan.doors: needs to be an array of door objects');
  } else {
    value.doors.forEach((door, i) => {
      const where = `plan.doors[${i}]`;
      if (!isRecord(door)) {
        errors.push(`${where}: needs to be an object`);
        return;
      }
      unknownFields(door, ['name', 'rect', 'h', 'c', 'o', 'len', 'entry'], where, errors);
      if (typeof door.name !== 'string' || door.name === '') errors.push(`${where}.name: needs a non-empty string`);
      checkRect(door.rect, `${where}.rect`, errors);
      for (const key of ['h', 'c', 'o'] as const) {
        if (!isPt(door[key])) errors.push(`${where}.${key}: needs [x, y] with 2 numbers`);
      }
      if (!isNum(door.len) || door.len <= 0) errors.push(`${where}.len: needs a number above 0`);
      if (door.entry !== undefined && typeof door.entry !== 'boolean') errors.push(`${where}.entry: needs to be true or false`);
    });
  }

  if (!Array.isArray(value.slidingDoors)) {
    errors.push('plan.slidingDoors: needs to be an array of sliding-door objects');
  } else {
    value.slidingDoors.forEach((slide, i) => {
      const where = `plan.slidingDoors[${i}]`;
      if (!isRecord(slide)) {
        errors.push(`${where}: needs to be an object`);
        return;
      }
      unknownFields(slide, ['rect', 'v'], where, errors);
      checkRect(slide.rect, `${where}.rect`, errors);
      if (typeof slide.v !== 'boolean') errors.push(`${where}.v: needs to be true or false`);
    });
  }

  if (!Array.isArray(value.rooms) || value.rooms.length === 0) {
    errors.push('plan.rooms: needs at least one room');
  } else {
    const seen = new Set<string>();
    value.rooms.forEach((room, i) => {
      const where = `plan.rooms[${i}]`;
      if (!isRecord(room)) {
        errors.push(`${where}: needs to be an object`);
        return;
      }
      unknownFields(room, ['id', 'name', 'nameEn', 'poly', 'mat', 'at', 'counted'], where, errors);
      if (typeof room.id !== 'string' || room.id === '') errors.push(`${where}.id: needs a non-empty string`);
      else if (seen.has(room.id)) errors.push(`${where}.id: "${room.id}" is used by two rooms`);
      else seen.add(room.id);
      if (typeof room.name !== 'string' || room.name === '') errors.push(`${where}.name: needs a non-empty string (Chinese)`);
      if (room.nameEn !== undefined && (typeof room.nameEn !== 'string' || room.nameEn === '')) errors.push(`${where}.nameEn: needs a non-empty string`);
      if (!Array.isArray(room.poly) || room.poly.length < 3 || !room.poly.every(isPt)) {
        errors.push(`${where}.poly: needs at least 3 points of [x, y]`);
      }
      if (room.mat !== undefined && (typeof room.mat !== 'string' || room.mat === '')) errors.push(`${where}.mat: needs a non-empty string`);
      if (room.at !== undefined && !isPt(room.at)) errors.push(`${where}.at: needs [x, y] with 2 numbers`);
      if (room.counted !== undefined && typeof room.counted !== 'boolean') errors.push(`${where}.counted: needs to be true or false`);
    });
  }

  if (value.furniture !== undefined) {
    if (!Array.isArray(value.furniture)) {
      errors.push('plan.furniture: needs to be an array');
    } else {
      const seen = new Set<string>();
      value.furniture.forEach((item, i) => {
        const where = `plan.furniture[${i}]`;
        checkFurniture(item, where, errors);
        const id = isRecord(item) ? item.id : undefined;
        if (typeof id === 'string') {
          if (seen.has(id)) errors.push(`${where}.id: "${id}" is used by two pieces of furniture`);
          seen.add(id);
        }
      });
    }
  }

  return errors;
}

/** Checks one saved design version (F6): the same shape floorplan-3d's "Export plan JSON" writes. */
export function validateDesignState(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['design: needs to be an object'];
  unknownFields(value, ['furniture', 'rooms', 'demolished', 'measures'], 'design', errors);

  if (!Array.isArray(value.furniture)) {
    errors.push('design.furniture: needs to be an array');
  } else {
    value.furniture.forEach((item, i) => checkFurniture(item, `design.furniture[${i}]`, errors));
  }

  if (!isRecord(value.rooms)) {
    errors.push('design.rooms: needs to be an object of room id → { name, mat }');
  } else {
    for (const [id, room] of Object.entries(value.rooms)) {
      const where = `design.rooms["${id}"]`;
      if (!isRecord(room)) {
        errors.push(`${where}: needs to be an object`);
        continue;
      }
      unknownFields(room, ['name', 'nameEn', 'mat'], where, errors);
      if (typeof room.name !== 'string' || room.name === '') errors.push(`${where}.name: needs a non-empty string`);
      if (room.nameEn !== undefined && (typeof room.nameEn !== 'string' || room.nameEn === '')) errors.push(`${where}.nameEn: needs a non-empty string`);
      if (typeof room.mat !== 'string' || room.mat === '') errors.push(`${where}.mat: needs a non-empty string`);
    }
  }

  if (!Array.isArray(value.demolished)) {
    errors.push('design.demolished: needs to be an array of wall ids');
  } else {
    for (const id of value.demolished) {
      if (typeof id !== 'string' || id === '') errors.push('design.demolished: every entry needs a wall id string');
    }
  }

  if (!Array.isArray(value.measures)) {
    errors.push('design.measures: needs to be an array of { a, b } points');
  } else {
    const isPointObj = (v: unknown) => isRecord(v) && isNum(v.x) && isNum(v.y);
    value.measures.forEach((m, i) => {
      const where = `design.measures[${i}]`;
      if (!isRecord(m) || !isPointObj(m.a) || !isPointObj(m.b)) {
        errors.push(`${where}: needs a and b, each a point with x and y`);
        return;
      }
      unknownFields(m, ['a', 'b'], where, errors);
    });
  }

  return errors;
}

/**
 * Only removable non-bearing walls (`n`) and low walls (`low`) may be demolished — floorplan-3d's
 * own rule (`toggleWall`, "承重墙不可拆除 / 外墙不建议拆除"). A wall of unknown type counts as
 * load-bearing (N6), so it is not removable either.
 */
export function isRemovableWall(wall: PlanWall): boolean {
  return wall[4] === 'n' || wall[4] === 'low';
}

/** The plan's extent, for floorplan-3d's view when the document leaves `bounds` out. */
export function planBounds(plan: Pick<PlanDocument, 'bounds' | 'walls' | 'windows' | 'rooms'>): PlanBounds {
  if (plan.bounds) return plan.bounds;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  for (const [ax, ay, bx, by] of plan.walls) { take(ax, ay); take(bx, by); }
  for (const [ax, ay, bx, by] of plan.windows) { take(ax, ay); take(bx, by); }
  for (const room of plan.rooms) for (const [x, y] of room.poly) take(x, y);
  if (!Number.isFinite(x0)) return { x: -1000, y: -1000, w: 2000, h: 2000 };
  // Same padding floorplan-3d's sample uses around the drawing.
  return { x: x0 - 400, y: y0 - 400, w: x1 - x0 + 800, h: y1 - y0 + 800 };
}
