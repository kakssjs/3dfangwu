import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The `studio/` folder: the nearest folder above this file whose package.json is named "studio". */
export const studioDir = findStudioDir(import.meta.dirname);
export const envFile = path.join(studioDir, '.env.local');

function findStudioDir(start: string): string {
  for (let dir = start; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'package.json');
    if (existsSync(file) && (JSON.parse(readFileSync(file, 'utf8')) as { name?: string }).name === 'studio') return dir;
    if (path.dirname(dir) === dir) throw new Error(`no studio/package.json above ${start}`);
  }
}

export interface StudioConfig {
  host: string;
  port: number;
  /** Our site's address. Project and invitation links point there (the interface, D15). */
  siteUrl: string;
  /** Signs sign-in tokens. Changing it signs everyone out. */
  jwtSecret: string;
  /** Your key for `/api/admin`. Empty turns those routes off. */
  adminKey: string;
  /** Amap Web (JS API) key for the map (D26). Public by design: the page loads the map with it. Empty: no map. */
  amapKey: string;
  /** Its security code. Server-only: the map proxy adds it. Empty: the map shows, search is off. */
  amapSecurityCode: string;
  /** A PostgreSQL server to use instead of the one inside the app (D20): `postgres://user:password@host:5432/name`. */
  databaseUrl: string;
  /** Connections to that server at most. */
  databasePoolMax: number;
  /** The database folder. Empty keeps the database in memory, as the tests do. */
  dbDir: string;
  /** Where uploads are kept (N19). The tests point it at a folder of their own. */
  filesDir: string;
  /** The MiMo API for the agents (N3). Empty: the agents wait, and everything else runs. */
  mimoApiKey: string;
  /** The MiMo endpoint, from the model access docs (模型接入文档). */
  mimoBaseUrl: string;
  mimoModel: string;
  /** The Doubao (豆包, 火山方舟) vision API: your approved backup reader for floor plans (N4, D9). */
  doubaoApiKey: string;
  /** The Ark endpoint, OpenAI-style like MiMo's. */
  doubaoBaseUrl: string;
  doubaoModel: string;
  /** Agnes AI, the second backup reader you named (N4). OpenAI-style; it works once its base URL is set. */
  agnesApiKey: string;
  agnesBaseUrl: string;
  agnesModel: string;
}

/** Reads the settings from the environment (`.env.local` is loaded first by `main.ts`). */
export function loadConfig(env: NodeJS.ProcessEnv): StudioConfig {
  const jwtSecret = env.STUDIO_JWT_SECRET ?? '';
  if (jwtSecret.length < 32) throw new Error('STUDIO_JWT_SECRET is missing or too short. Run `npm run api -- setup` first.');
  const adminKey = env.STUDIO_ADMIN_KEY ?? '';
  if (adminKey !== '' && adminKey.length < 24) throw new Error('STUDIO_ADMIN_KEY must be at least 24 characters.');
  const port = Number(env.STUDIO_API_PORT || 3100);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('STUDIO_API_PORT must be a port number.');
  return {
    host: env.STUDIO_API_HOST || '127.0.0.1',
    port,
    siteUrl: (env.STUDIO_SITE_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, ''),
    jwtSecret,
    adminKey,
    amapKey: env.AMAP_KEY ?? '',
    amapSecurityCode: env.AMAP_SECURITY_CODE ?? '',
    databaseUrl: env.DATABASE_URL ?? '',
    databasePoolMax: Number(env.STUDIO_DB_POOL_MAX) || 10,
    dbDir: env.STUDIO_DB_DIR || path.join(studioDir, '..', 'runtime', 'studio-db'),
    filesDir: env.STUDIO_FILES_DIR || path.join(studioDir, '..', 'runtime', 'studio-files'),
    mimoApiKey: env.MIMO_API_KEY ?? '',
    mimoBaseUrl: env.MIMO_BASE_URL ?? '',
    mimoModel: env.MIMO_MODEL || 'MiMo-V2.6-Pro',
    doubaoApiKey: env.DOUBAO_API_KEY ?? '',
    doubaoBaseUrl: env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    doubaoModel: env.DOUBAO_MODEL || 'doubao-seed-2-1-lite-260915',
    agnesApiKey: env.AGNES_API_KEY ?? '',
    agnesBaseUrl: env.AGNES_BASE_URL ?? '',
    agnesModel: env.AGNES_MODEL ?? '',
  };
}
