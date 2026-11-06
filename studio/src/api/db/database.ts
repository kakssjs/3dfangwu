import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { studioDir } from '../config.ts';
import * as schema from './schema.ts';

export type Db = PgliteDatabase<typeof schema>;

export interface Database {
  db: Db;
  close(): Promise<void>;
}

/**
 * Opens the database and applies any migrations it hasn't had yet (`studio/drizzle/`). It is
 * PostgreSQL run inside this process by PGlite, so this PC needs no database server. Without a
 * folder it lives in memory, as in the tests.
 */
export async function openDatabase(dataDir = ''): Promise<Database> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(studioDir, 'drizzle') });
  return { db, close: () => client.close() };
}
