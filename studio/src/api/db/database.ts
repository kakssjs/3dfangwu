import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import { studioDir } from '../config.ts';
import * as schema from './schema.ts';

/** The database, whichever PostgreSQL it is: a server (`DATABASE_URL`) or the one inside this process. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  /** Which one it is, without any password: shown when the app starts. */
  describe: string;
  close(): Promise<void>;
}

export interface DatabaseTarget {
  /** A PostgreSQL server: `postgres://user:password@host:5432/name`. Wins over `dataDir`. */
  url?: string;
  /** A folder for the PostgreSQL that runs inside this process (PGlite). Empty: in memory, as in the tests. */
  dataDir?: string;
  /** Connections to a server at most (default 10). */
  poolMax?: number;
}

const migrationsFolder = () => path.join(studioDir, 'drizzle');

/** The address with the password hidden. */
export function hideSecret(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return 'a PostgreSQL server';
  }
}

/**
 * Opens the database and applies any migrations it hasn't had yet (`studio/drizzle/`).
 *
 * - With `url` it is a real PostgreSQL server, which is what the server in the cloud uses (D8, D20).
 * - Otherwise it is PostgreSQL run inside this process by PGlite, so a PC needs no database server.
 *   Without a folder it lives in memory, as in the tests.
 *
 * The same migrations and the same queries run on both.
 */
export async function openDatabase(target: string | DatabaseTarget = ''): Promise<Database> {
  const { url = '', dataDir = '', poolMax = 10 } = typeof target === 'string' ? { dataDir: target } : target;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: poolMax, connectionTimeoutMillis: 10_000 });
    // An idle connection the server drops must not crash the app: the pool replaces it.
    pool.on('error', (error) => console.error('database:', error.message));
    const db = drizzlePg(pool, { schema });
    try {
      await migratePg(db, { migrationsFolder: migrationsFolder() });
    } catch (error) {
      await pool.end();
      throw new Error(`Cannot use the PostgreSQL server at ${hideSecret(url)}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { db: db as unknown as Db, describe: `PostgreSQL server ${hideSecret(url)}`, close: () => pool.end() };
  }
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: migrationsFolder() });
  return { db: db as unknown as Db, describe: dataDir ? `PostgreSQL inside the app, in ${dataDir}` : 'PostgreSQL inside the app, in memory', close: () => client.close() };
}
