// Runs the end-to-end tests on a PostgreSQL SERVER (the `pg` driver, over a real connection), not on
// the PostgreSQL inside the app:
//
//   npm run test:postgres                      starts a throwaway PostgreSQL-protocol server (PGlite) for the run
//   STUDIO_TEST_DATABASE_URL=postgres://... npm run test:postgres     uses your own PostgreSQL; the database
//                                              is wiped for each app, so its name must contain "test"
//
// The throwaway server runs every connection through one session, so use a real PostgreSQL to check
// concurrency itself.

import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const FILES = ['dist/test/api/marketplace.test.js', 'dist/test/api/consent.test.js', 'dist/test/api/uploads.test.js', 'dist/test/api/site.test.js', 'dist/test/api/places.test.js', 'dist/test/api/maps.test.js'];

let url = process.env.STUDIO_TEST_DATABASE_URL ?? '';
let stop = async () => {};
const env: NodeJS.ProcessEnv = { ...process.env };
if (!url) {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  const conn = server.getServerConn();
  const port = conn.split(':').at(-1);
  url = `postgres://postgres:postgres@127.0.0.1:${port}/test`;
  env.STUDIO_TEST_DATABASE_POOL = '1';
  stop = async () => {
    await server.stop();
    await db.close();
  };
  console.log(`Throwaway PostgreSQL server on 127.0.0.1:${port}`);
} else {
  console.log('Using the PostgreSQL server from STUDIO_TEST_DATABASE_URL');
}
env.STUDIO_TEST_DATABASE_URL = url;

const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--test', '--test-concurrency=1', ...FILES], { stdio: 'inherit', env });
const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));
await stop();
process.exit(code);
