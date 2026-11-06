// Starts the API on a free port with an in-memory database, for the end-to-end tests.

import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MimoClient, type MimoTransport } from '../../src/api/agents/mimo.ts';
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
  /** Where this app's uploads are stored; the folder goes when the app closes. */
  filesDir: string;
  call(method: string, path: string, options?: CallOptions): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

/** Without a transport MiMo is "down": agent tasks wait, as they do on a PC without a key. */
const noMimo: MimoTransport = async () => {
  throw new Error('no MiMo in the tests');
};

export async function startApi({
  rateLimits = false,
  adminKey = randomBytes(24).toString('base64url'),
  mimo = noMimo,
  deepModel = null,
}: { rateLimits?: boolean; adminKey?: string; mimo?: MimoTransport; deepModel?: BaseChatModel | null } = {}): Promise<Api> {
  const database = await openDatabase();
  const filesDir = mkdtempSync(path.join(tmpdir(), 'studio-files-'));
  const config: StudioConfig = {
    host: '127.0.0.1',
    port: 0,
    siteUrl: SITE_URL,
    jwtSecret: randomBytes(32).toString('base64url'),
    adminKey,
    dbDir: '',
    filesDir,
    mimoApiKey: '',
    mimoBaseUrl: '',
    mimoModel: 'MiMo-V2.6-Pro',
  };
  const app = await createApp({ config, database, logger: false, rateLimits, mimo: new MimoClient(mimo), deepModel });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api`;
  return {
    adminKey,
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
