// Starts the API on a free port with an in-memory database, for the end-to-end tests.

import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MimoClient, type MimoTransport } from '../../src/api/agents/mimo.ts';
import pg from 'pg';
import { GeoUnavailable, type GeoLookup } from '../../src/api/geo/geo.ts';
import { createApp } from '../../src/api/app.ts';
import type { StudioConfig } from '../../src/api/config.ts';
import { openDatabase, type Db } from '../../src/api/db/database.ts';

/**
 * With `STUDIO_TEST_DATABASE_URL` the tests run on that real PostgreSQL server instead of the one
 * inside the app (`npm run test:postgres`). The database is wiped for each app the tests start, so
 * its name must say it is for tests.
 */
const TEST_URL = process.env.STUDIO_TEST_DATABASE_URL ?? '';
const TEST_POOL = Number(process.env.STUDIO_TEST_DATABASE_POOL) || 4;

async function freshDatabase() {
  if (!TEST_URL) return openDatabase();
  const name = decodeURIComponent(new URL(TEST_URL).pathname.slice(1));
  if (!/test/i.test(name)) throw new Error(`STUDIO_TEST_DATABASE_URL must name a test database (its name must contain "test"), not "${name}": it is wiped`);
  const pool = new pg.Pool({ connectionString: TEST_URL, max: 1 });
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.end();
  return openDatabase({ url: TEST_URL, poolMax: TEST_POOL });
}

export const SITE_URL = 'https://irenovation.test';

export interface CallOptions {
  token?: string;
  admin?: string;
  body?: unknown;
}

export interface Api {
  adminKey: string;
  /** The address the app listens on, for tests that open the site in a browser. */
  url: string;
  /** For what no route can do, such as letting an invitation lapse. */
  db: Db;
  /** Where this app's uploads are stored; the folder goes when the app closes. */
  filesDir: string;
  call(method: string, path: string, options?: CallOptions): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

/** Without a transport MiMo is "down": agent tasks wait, as they do on a PC without a key. */
const noMimo: MimoTransport = async () => {
  throw new Error('no MiMo in the tests');
};

/** Without a stub the tests never reach the real location service. */
const noPlaces: GeoLookup = async () => {
  throw new GeoUnavailable('no location service in the tests');
};

export async function startApi({
  rateLimits = false,
  adminKey = randomBytes(24).toString('base64url'),
  mimo = noMimo,
  deepModel = null,
  geo = noPlaces,
  amap = { key: '', securityCode: '' },
  amapFetch,
  backups,
}: {
  rateLimits?: boolean;
  adminKey?: string;
  mimo?: MimoTransport;
  deepModel?: BaseChatModel | null;
  geo?: GeoLookup;
  amap?: { key: string; securityCode: string };
  amapFetch?: typeof fetch;
  /** Backup floor-plan readers (N4), as stubs. Default: none, like a PC without the keys. */
  backups?: MimoClient[];
} = {}): Promise<Api> {
  const database = await freshDatabase();
  const filesDir = mkdtempSync(path.join(tmpdir(), 'studio-files-'));
  const config: StudioConfig = {
    host: '127.0.0.1',
    port: 0,
    siteUrl: SITE_URL,
    jwtSecret: randomBytes(32).toString('base64url'),
    adminKey,
    amapKey: amap.key,
    amapSecurityCode: amap.securityCode,
    databaseUrl: '',
    databasePoolMax: 10,
    dbDir: '',
    filesDir,
    mimoApiKey: '',
    mimoBaseUrl: '',
    mimoModel: 'MiMo-V2.6-Pro',
    doubaoApiKey: '',
    doubaoBaseUrl: '',
    doubaoModel: '',
    agnesApiKey: '',
    agnesBaseUrl: '',
    agnesModel: '',
  };
  const app = await createApp({ config, database, logger: false, rateLimits, mimo: new MimoClient(mimo), deepModel, geo, amapFetch, backups });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api`;
  return {
    adminKey,
    url: `http://127.0.0.1:${port}`,
    db: database.db,
    filesDir,
    async call(method, path, { token, admin, body } = {}) {
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      if (admin !== undefined) headers['x-admin-key'] = admin;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : undefined };
    },
    async close() {
      await app.close();
      await database.close();
      rmSync(filesDir, { recursive: true, force: true });
    },
  };
}

/** A date in China, `days` from today, as YYYY-MM-DD. */
export function dateInChina(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(Date.now() + days * 86_400_000));
}
