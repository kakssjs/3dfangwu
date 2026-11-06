// N9: the home record. One record per customer home, shared by every stage of the platform
// (WORKFLOW.md section 7). The input uses floorplan-3d's own data shapes, in millimetres:
// rooms with polygons, and furniture placed by its centre point.

export type Point = [number, number];

export interface PlanRoom {
  id: string;
  name: string;
  poly: Point[];
  /** floorplan-3d sets `counted: false` on areas that don't count toward the floor area, such as bay windows. */
  counted?: boolean;
}

export interface PlacedFurniture {
  id: string;
  /** floorplan-3d furniture type, for example "bed" or "fridge" */
  type: string;
  /** name shown to the customer, for example "双人床" */
  name: string;
  cx: number;
  cy: number;
  w: number;
  d: number;
  rot?: number;
}

export interface FloorplanInput {
  rooms: PlanRoom[];
  furniture: PlacedFurniture[];
}

export const STAGES = ['requirements', 'design', 'bidding', 'contract', 'construction', 'acceptance', 'after-sales'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  requirements: '需求',
  design: '设计',
  bidding: '招标',
  contract: '签约',
  construction: '施工',
  acceptance: '验收',
  'after-sales': '售后',
};

export interface HomeRoom {
  id: string;
  name: string;
  areaM2: number;
  counted: boolean;
}

export interface HomeItem {
  id: string;
  type: string;
  name: string;
  roomId: string;
  /** true when the item's centre is outside every room, so the nearest room was used */
  roomGuessed: boolean;
  sizeMm: { w: number; d: number };
  priceCny?: number;
}

/**
 * The values our design last sent to one Homebox entity. A later sync changes a field in Homebox
 * only when the design's value has changed since then, so edits the customer makes in Homebox stay.
 */
export interface HomeboxSent {
  name: string;
  description: string;
  parentId?: string;
  purchasePrice?: number;
}

export interface HomeboxEntityLink {
  entityId: string;
  sent: HomeboxSent;
}

export interface HomeboxLinks {
  baseUrl: string;
  /** the Homebox group (household) for this home */
  groupId: string;
  locationTypeId?: string;
  /** our room id → Homebox location */
  locations: Record<string, HomeboxEntityLink>;
  /** our furniture id → Homebox item */
  items: Record<string, HomeboxEntityLink>;
  syncedAt?: string;
}

export interface HomeLinks {
  homebox?: HomeboxLinks;
}

export interface HomeRecord {
  schema: 'studio.home/1';
  id: string;
  name: string;
  stage: Stage;
  rooms: HomeRoom[];
  /** Furniture and belongings. Homebox owns these (N11). */
  furniture: HomeItem[];
  /** Appliances and anything that needs servicing. micasa will own these (N12). */
  appliances: HomeItem[];
  links: HomeLinks;
  updatedAt: string;
}

/** floorplan-3d types that count as appliances: the 家电 category, plus stove, washer and water heater. */
export const APPLIANCE_TYPES: ReadonlySet<string> = new Set([
  'tv', 'fridge', 'aircon', 'acwall', 'dishwasher', 'ovencol', 'dryer', 'purifier',
  'stove', 'washer', 'waterheater',
]);

/** Area of a simple polygon in mm² (shoelace formula). */
export function polygonAreaMm2(poly: Point[]): number {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

/** Even-odd ray casting. Points exactly on an edge may count as inside or outside. */
export function containsPoint(poly: Point[], [x, y]: Point): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToPolygon(poly: Point[], p: Point): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, distanceToSegment(p, poly[i]!, poly[(i + 1) % poly.length]!));
  }
  return best;
}

/** The room that contains the point, or else the nearest room (marked as guessed). */
export function findRoom(rooms: PlanRoom[], p: Point): { roomId: string; guessed: boolean } {
  const hit = rooms.find((r) => containsPoint(r.poly, p));
  if (hit) return { roomId: hit.id, guessed: false };
  let nearest = rooms[0]!;
  let nearestDistance = Infinity;
  for (const room of rooms) {
    const distance = distanceToPolygon(room.poly, p);
    if (distance < nearestDistance) {
      nearest = room;
      nearestDistance = distance;
    }
  }
  return { roomId: nearest.id, guessed: true };
}

export interface BuildOptions {
  id: string;
  name: string;
  stage?: Stage;
  /** furniture id → price in CNY, from the budget (N5) */
  prices?: Record<string, number>;
  /** an earlier record for the same home: its links and stage are kept */
  previous?: HomeRecord;
  now?: Date;
}

function assertUniqueIds(kind: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) throw new Error(`${kind}: every entry needs an id`);
    if (seen.has(id)) throw new Error(`${kind}: duplicate id "${id}"`);
    seen.add(id);
  }
}

export function buildHomeRecord(input: FloorplanInput, opts: BuildOptions): HomeRecord {
  if (!opts.id) throw new Error('home id is required');
  if (input.rooms.length === 0) throw new Error('the plan has no rooms');
  assertUniqueIds('rooms', input.rooms.map((r) => r.id));
  assertUniqueIds('furniture', input.furniture.map((f) => f.id));
  for (const room of input.rooms) {
    if (room.poly.length < 3) throw new Error(`room "${room.id}" needs at least 3 corners`);
  }
  for (const f of input.furniture) {
    if (![f.cx, f.cy, f.w, f.d].every(Number.isFinite)) {
      throw new Error(`furniture "${f.id}" needs numeric cx, cy, w and d`);
    }
  }
  if (opts.previous && opts.previous.id !== opts.id) {
    throw new Error(`previous record is for home "${opts.previous.id}", not "${opts.id}"`);
  }
  const stage = opts.stage ?? opts.previous?.stage ?? 'design';
  if (!STAGES.includes(stage)) throw new Error(`unknown stage "${stage}"`);

  const rooms: HomeRoom[] = input.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    areaM2: Math.round(polygonAreaMm2(r.poly) / 1e4) / 100,
    counted: r.counted !== false,
  }));

  const furniture: HomeItem[] = [];
  const appliances: HomeItem[] = [];
  for (const f of input.furniture) {
    const { roomId, guessed } = findRoom(input.rooms, [f.cx, f.cy]);
    const item: HomeItem = {
      id: f.id,
      type: f.type,
      name: f.name,
      roomId,
      roomGuessed: guessed,
      sizeMm: { w: f.w, d: f.d },
    };
    const price = opts.prices?.[f.id];
    if (price !== undefined) item.priceCny = price;
    (APPLIANCE_TYPES.has(f.type) ? appliances : furniture).push(item);
  }

  return {
    schema: 'studio.home/1',
    id: opts.id,
    name: opts.name,
    stage,
    rooms,
    furniture,
    appliances,
    links: structuredClone(opts.previous?.links ?? {}),
    updatedAt: (opts.now ?? new Date()).toISOString(),
  };
}
