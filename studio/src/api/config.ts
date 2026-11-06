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
  /** The database folder. Empty keeps the database in memory, as the tests do. */
  dbDir: string;
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
    dbDir: env.STUDIO_DB_DIR || path.join(studioDir, '..', 'runtime', 'studio-db'),
  };
}
