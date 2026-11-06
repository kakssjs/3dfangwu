// Runs the I Renovation API on this PC (N19).
//
//   npm run api -- setup    write the sign-in secret and your admin key to .env.local, once
//   npm run api             start the API at http://127.0.0.1:3100/api (Ctrl+C stops it)
//
// The database is PostgreSQL run inside this process by PGlite, in ../runtime/studio-db/ unless
// STUDIO_DB_DIR says otherwise.

import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeEnvFile } from '../env-file.ts';
import { RunnerService } from './agents/runner.ts';
import { createApp } from './app.ts';
import { envFile, loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';

if (existsSync(envFile)) process.loadEnvFile(envFile);

function setup(): void {
  const missing: Record<string, string> = {};
  if (!process.env.STUDIO_JWT_SECRET) missing.STUDIO_JWT_SECRET = randomBytes(32).toString('base64url');
  if (!process.env.STUDIO_ADMIN_KEY) missing.STUDIO_ADMIN_KEY = randomBytes(24).toString('base64url');
  const keys = Object.keys(missing);
  if (keys.length === 0) {
    console.log('Nothing to do: .env.local already has STUDIO_JWT_SECRET and STUDIO_ADMIN_KEY.');
    return;
  }
  writeEnvFile(envFile, missing, '# Holds real keys: keep it on this PC and never share it.');
  // The values themselves are never printed.
  console.log(`Wrote ${keys.join(' and ')} to ${envFile}. Keep that file on this PC and never share it.`);
}

async function serve(): Promise<void> {
  const config = loadConfig(process.env);
  const database = await openDatabase(config.dbDir);
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    app = await createApp({ config, database });
    await app.listen(config.port, config.host);
  } catch (error) {
    // For example the port is taken: close what was opened, so the process can end.
    await app?.close();
    await database.close();
    throw error;
  }
  const running = app;
  console.log(`I Renovation API: http://${config.host}:${config.port}/api (database in ${config.dbDir})`);
  // The runner (N3): due tasks once a minute, once MiMo is set. Without it the agents wait and the
  // rest of the API runs; you can still run tasks by hand (POST /api/admin/runner/tick).
  const timer =
    config.mimoApiKey && config.mimoBaseUrl
      ? setInterval(() => void running.get(RunnerService).tick().catch((e: unknown) => console.error('runner:', e)), 60_000)
      : undefined;
  if (!timer) console.log('MIMO_API_KEY or MIMO_BASE_URL is not set: the agents wait.');
  const stop = async () => {
    clearInterval(timer);
    await running.close();
    await database.close();
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

try {
  if (process.argv[2] === 'setup') setup();
  else if (process.argv[2] === undefined) await serve();
  else throw new Error(`Unknown command "${process.argv[2]}". Use \`npm run api\` or \`npm run api -- setup\`.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
