// N11: the Homebox connector. Homebox (AGPL-3.0) runs unmodified as its own service; we only call its
// REST API (/api/v1). Each home gets its own Homebox group (household): rooms become locations and
// furniture becomes items inside them. Appliances are left for micasa (N12).

import type { HomeboxEntityLink, HomeboxLinks, HomeboxSent, HomeItem, HomeRecord, HomeRoom } from './home-record.ts';

export class HomeboxError extends Error {
  readonly status: number;
  constructor(method: string, path: string, status: number, detail: string) {
    super(`Homebox ${method} ${path} failed with ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'HomeboxError';
    this.status = status;
  }
}

export interface HomeboxStatus {
  health: boolean;
  allowRegistration: boolean;
  build?: { version?: string };
}

export interface Group {
  id: string;
  name: string;
  currency: string;
}

export interface EntityType {
  id: string;
  name: string;
  isLocation: boolean;
}

export interface EntityField {
  id?: string;
  type: string;
  name: string;
  textValue: string;
  numberValue: number;
  booleanValue: boolean;
}

/** The parts of Homebox's EntityOut that we read or must send back unchanged. */
export interface Entity {
  id: string;
  name: string;
  description: string;
  quantity: number;
  insured: boolean;
  archived: boolean;
  assetId: string;
  purchasePrice: number;
  parent?: { id: string } | null;
  entityType?: { id: string; isLocation: boolean } | null;
  locationId?: string | null;
  tags?: { id: string }[] | null;
  fields?: EntityField[] | null;
  syncChildEntityLocations: boolean;
  serialNumber: string;
  modelNumber: string;
  manufacturer: string;
  lifetimeWarranty: boolean;
  warrantyExpires: string;
  warrantyDetails: string;
  purchaseDate: string;
  purchaseFrom: string;
  soldDate: string;
  soldTo: string;
  soldPrice: number;
  soldNotes: string;
  notes: string;
}

export interface EntityCreate {
  name: string;
  description?: string;
  parentId?: string;
  entityTypeId?: string;
}

/** Homebox's EntityUpdate: a PUT replaces every field, so each one must be sent. */
export interface EntityUpdate {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  locationId?: string;
  entityTypeId?: string;
  quantity: number;
  insured: boolean;
  archived: boolean;
  assetId: string;
  purchasePrice: number;
  tagIds: string[];
  fields: EntityField[];
  syncChildEntityLocations: boolean;
  serialNumber: string;
  modelNumber: string;
  manufacturer: string;
  lifetimeWarranty: boolean;
  warrantyExpires: string;
  warrantyDetails: string;
  purchaseDate: string;
  purchaseFrom: string;
  soldDate: string;
  soldTo: string;
  soldPrice: number;
  soldNotes: string;
  notes: string;
}

export interface Invitation {
  id: string;
  token: string;
  uses: number;
  expiresAt: string;
}

interface RequestOptions {
  body?: unknown;
  /** Homebox group id, sent as X-Tenant */
  tenant?: string;
  /** false for the endpoints that work without signing in */
  auth?: boolean;
}

export class HomeboxClient {
  readonly baseUrl: string;
  readonly token: string | undefined;
  readonly timeoutMs: number;

  constructor(opts: { baseUrl: string; token?: string; timeoutMs?: number }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token?.replace(/^Bearer\s+/i, '');
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.auth !== false) {
      if (!this.token) throw new Error('No Homebox API key. Run `npm run homebox -- setup` first.');
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (opts.tenant) headers['X-Tenant'] = opts.tenant;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = (err as { cause?: { code?: string } }).cause?.code ?? (err as Error).message;
      throw new Error(
        `Cannot reach Homebox at ${this.baseUrl} (${reason}). Is it running? Start it with \`npm run homebox -- start\`.`,
        { cause: err },
      );
    }
    const text = await res.text();
    if (!res.ok) throw new HomeboxError(method, path, res.status, errorDetail(text));
    return (text ? JSON.parse(text) : undefined) as T;
  }

  status(): Promise<HomeboxStatus> {
    return this.request('GET', '/v1/status', { auth: false });
  }

  async register(user: { email: string; name: string; password: string }): Promise<void> {
    await this.request('POST', '/v1/users/register', { auth: false, body: user });
  }

  /** Signs in and returns a session token (without the "Bearer " prefix). */
  async login(email: string, password: string): Promise<string> {
    const res = await this.request<{ token: string }>('POST', '/v1/users/login', {
      auth: false,
      body: { username: email, password, stayLoggedIn: false },
    });
    return res.token.replace(/^Bearer\s+/i, '');
  }

  /** Creates an API key for the signed-in user and returns its token. Homebox shows it only once. */
  async createApiKey(name: string): Promise<string> {
    const res = await this.request<{ token: string }>('POST', '/v1/users/self/api-keys', { body: { name } });
    return res.token;
  }

  createGroup(name: string): Promise<Group> {
    return this.request('POST', '/v1/groups', { body: { name } });
  }

  getGroup(tenant: string): Promise<Group> {
    return this.request('GET', '/v1/groups', { tenant });
  }

  updateGroup(tenant: string, group: { name: string; currency: string }): Promise<Group> {
    return this.request('PUT', '/v1/groups', { tenant, body: group });
  }

  async deleteGroup(tenant: string): Promise<void> {
    await this.request('DELETE', '/v1/groups', { tenant });
  }

  entityTypes(tenant: string): Promise<EntityType[]> {
    return this.request('GET', '/v1/entity-types', { tenant });
  }

  createEntityType(tenant: string, type: { name: string; isLocation: boolean }): Promise<EntityType> {
    return this.request('POST', '/v1/entity-types', { tenant, body: type });
  }

  createEntity(tenant: string, entity: EntityCreate): Promise<Entity> {
    return this.request('POST', '/v1/entities', { tenant, body: entity });
  }

  /** The entity, or null if it no longer exists in this group. */
  async getEntity(tenant: string, id: string): Promise<Entity | null> {
    try {
      return await this.request<Entity>('GET', `/v1/entities/${encodeURIComponent(id)}`, { tenant });
    } catch (err) {
      if (err instanceof HomeboxError && err.status === 404) return null;
      throw err;
    }
  }

  updateEntity(tenant: string, update: EntityUpdate): Promise<Entity> {
    return this.request('PUT', `/v1/entities/${encodeURIComponent(update.id)}`, { tenant, body: update });
  }

  async deleteEntity(tenant: string, id: string): Promise<void> {
    await this.request('DELETE', `/v1/entities/${encodeURIComponent(id)}`, { tenant });
  }

  createInvitation(tenant: string, invitation: { uses: number; expiresAt: string }): Promise<Invitation> {
    return this.request('POST', '/v1/groups/invitations', { tenant, body: invitation });
  }
}

function errorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // not JSON: fall through to the raw text
  }
  return body.trim().slice(0, 300);
}

/**
 * The PUT body that brings an entity in line with the design, or null when nothing needs to change.
 * The design owns name, description, room (parent) and price. A field is changed only if the design's
 * value differs from what it sent last time (`lastSent`); otherwise the value in Homebox is kept, in
 * case the customer edited it. Pass no `lastSent` to apply every design value. All other fields
 * (notes, serial number, warranty, tags, photos and so on) always stay as they are in Homebox.
 */
export function entityUpdateFrom(existing: Entity, design: HomeboxSent, lastSent?: HomeboxSent): EntityUpdate | null {
  const designChanged = <K extends keyof HomeboxSent>(key: K) => !lastSent || lastSent[key] !== design[key];
  const existingParentId = existing.parent?.id ?? undefined;

  const name = designChanged('name') ? design.name : existing.name;
  const description = designChanged('description') ? design.description : existing.description;
  const parentId = design.parentId !== undefined && designChanged('parentId') ? design.parentId : existingParentId;
  const purchasePrice =
    design.purchasePrice !== undefined && designChanged('purchasePrice') ? design.purchasePrice : existing.purchasePrice;

  if (
    name === existing.name &&
    description === existing.description &&
    parentId === existingParentId &&
    purchasePrice === existing.purchasePrice
  ) {
    return null;
  }

  return {
    id: existing.id,
    name,
    description,
    parentId,
    locationId: existing.locationId ?? undefined,
    entityTypeId: existing.entityType?.id,
    quantity: existing.quantity,
    insured: existing.insured,
    archived: existing.archived,
    assetId: existing.assetId,
    purchasePrice,
    tagIds: (existing.tags ?? []).map((t) => t.id),
    fields: existing.fields ?? [],
    syncChildEntityLocations: existing.syncChildEntityLocations,
    serialNumber: existing.serialNumber,
    modelNumber: existing.modelNumber,
    manufacturer: existing.manufacturer,
    lifetimeWarranty: existing.lifetimeWarranty,
    warrantyExpires: existing.warrantyExpires,
    warrantyDetails: existing.warrantyDetails,
    purchaseDate: existing.purchaseDate,
    purchaseFrom: existing.purchaseFrom,
    soldDate: existing.soldDate,
    soldTo: existing.soldTo,
    soldPrice: existing.soldPrice,
    soldNotes: existing.soldNotes,
    notes: existing.notes,
  };
}

export function roomDescription(room: HomeRoom): string {
  return `来自装修设计 · 面积约 ${room.areaM2} m²${room.counted ? '' : '（不计入面积）'}`;
}

export function itemDescription(item: HomeItem): string {
  return `来自装修设计 · 尺寸 ${item.sizeMm.w}×${item.sizeMm.d} mm${item.roomGuessed ? ' · 房间为自动推测' : ''}`;
}

export interface SyncResult {
  groupId: string;
  created: number;
  updated: number;
  unchanged: number;
  /** linked entities that had been deleted in Homebox and were created again */
  recreated: number;
  /** rooms and furniture linked earlier but no longer in the design; left untouched in Homebox */
  notInDesign: string[];
  /** appliances are not sent to Homebox: micasa owns them (N12) */
  appliancesSkipped: number;
}

/**
 * Creates or updates the home's Homebox group, locations and items. Safe to run again: it only
 * creates what's missing and only changes what the design changed. `home.links.homebox` is updated
 * as it goes, so save the home record afterwards even if this throws.
 */
export async function syncHomeToHomebox(home: HomeRecord, client: HomeboxClient, now = new Date()): Promise<SyncResult> {
  let links: HomeboxLinks | undefined = home.links.homebox;
  if (links && links.baseUrl !== client.baseUrl) {
    throw new Error(`This home is linked to the Homebox at ${links.baseUrl}, not ${client.baseUrl}.`);
  }
  if (!links) {
    const group = await client.createGroup(home.name);
    links = { baseUrl: client.baseUrl, groupId: group.id, locations: {}, items: {} };
    home.links.homebox = links;
    await client.updateGroup(group.id, { name: home.name, currency: 'CNY' });
  }
  const tenant = links.groupId;

  try {
    await client.getGroup(tenant);
  } catch (err) {
    if (err instanceof HomeboxError && (err.status === 403 || err.status === 404)) {
      throw new Error(
        `Homebox group ${tenant} for this home is gone or not shared with the studio account. ` +
          'To start over, delete links.homebox from the home record and sync again.',
      );
    }
    throw err;
  }

  if (!links.locationTypeId) {
    const types = await client.entityTypes(tenant);
    links.locationTypeId =
      types.find((t) => t.isLocation)?.id ?? (await client.createEntityType(tenant, { name: '房间', isLocation: true })).id;
  }

  const result: SyncResult = {
    groupId: tenant,
    created: 0,
    updated: 0,
    unchanged: 0,
    recreated: 0,
    notInDesign: [],
    appliancesSkipped: home.appliances.length,
  };

  async function upsert(map: Record<string, HomeboxEntityLink>, key: string, design: HomeboxSent, entityTypeId?: string) {
    const old = map[key];
    if (old) {
      const existing = await client.getEntity(tenant, old.entityId);
      if (existing) {
        const update = entityUpdateFrom(existing, design, old.sent);
        if (update) {
          await client.updateEntity(tenant, update);
          result.updated++;
        } else {
          result.unchanged++;
        }
        old.sent = design;
        return;
      }
      result.recreated++;
    } else {
      result.created++;
    }
    const sentOnCreate: HomeboxSent = { name: design.name, description: design.description, parentId: design.parentId };
    const created = await client.createEntity(tenant, { ...sentOnCreate, entityTypeId });
    const link: HomeboxEntityLink = { entityId: created.id, sent: sentOnCreate };
    map[key] = link;
    // Homebox takes the price only on update, not on create. If this update fails, the next sync retries it.
    const update = entityUpdateFrom(created, design, sentOnCreate);
    if (update) await client.updateEntity(tenant, update);
    link.sent = design;
  }

  for (const room of home.rooms) {
    await upsert(links.locations, room.id, { name: room.name, description: roomDescription(room) }, links.locationTypeId);
  }
  for (const item of home.furniture) {
    const room = links.locations[item.roomId];
    if (!room) throw new Error(`furniture "${item.id}" is in room "${item.roomId}", which is not in the home record`);
    const design: HomeboxSent = { name: item.name, description: itemDescription(item), parentId: room.entityId };
    if (item.priceCny !== undefined) design.purchasePrice = item.priceCny;
    await upsert(links.items, item.id, design);
  }

  const roomIds = new Set(home.rooms.map((r) => r.id));
  const furnitureIds = new Set(home.furniture.map((f) => f.id));
  result.notInDesign = [
    ...Object.keys(links.locations).filter((id) => !roomIds.has(id)),
    ...Object.keys(links.items).filter((id) => !furnitureIds.has(id)),
  ];
  links.syncedAt = now.toISOString();
  return result;
}

/** Creates a one-time invitation to the home's Homebox group and returns the sign-up link. */
export async function inviteCustomer(
  home: HomeRecord,
  client: HomeboxClient,
  opts: { uses?: number; days?: number } = {},
): Promise<{ url: string; expiresAt: string }> {
  const links = home.links.homebox;
  if (!links) throw new Error('This home is not in Homebox yet. Run sync first.');
  const days = opts.days ?? 7;
  const invitation = await client.createInvitation(links.groupId, {
    uses: opts.uses ?? 1,
    expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  return { url: `${links.baseUrl}/?token=${encodeURIComponent(invitation.token)}`, expiresAt: invitation.expiresAt };
}
