// Starts the API on a free port with an in-memory database, for the end-to-end tests.

import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/api/app.ts';
import type { StudioConfig } from '../../src/api/config.ts';
import { openDatabase, type Db } from '../../src/api/db/database.ts';

export const SITE_URL = 'https://irenovation.test';

export interface CallOptions {
  token?: string;
  admin?: string;
  body?: unknown;
}

export interface Api {
  adminKey: string;
  /** For what no route can do, such as letting an invitation lapse. */
  db: Db;
  call(method: string, path: string, options?: CallOptions): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

export async function startApi({ rateLimits = false, adminKey = randomBytes(24).toString('base64url') } = {}): Promise<Api> {
  const database = await openDatabase();
  const config: StudioConfig = {
    host: '127.0.0.1',
    port: 0,
    siteUrl: SITE_URL,
    jwtSecret: randomBytes(32).toString('base64url'),
    adminKey,
    dbDir: '',
  };
  const app = await createApp({ config, database, logger: false, rateLimits });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api`;
  return {
    adminKey,
    db: database.db,
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
    },
  };
}

/** A date in China, `days` from today, as YYYY-MM-DD. */
export function dateInChina(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(Date.now() + days * 86_400_000));
}
