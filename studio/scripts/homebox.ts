// Runs Homebox on this PC and connects homes to it (N11).
//
//   npm run homebox -- start                      start Homebox at http://127.0.0.1:7745 (Ctrl+C stops it)
//   npm run homebox -- status                     check that Homebox is up
//   npm run homebox -- setup                      create the studio account and API key, saved in .env.local
//   npm run homebox -- sync <home.json>           copy a home's rooms and furniture into its own Homebox household
//   npm run homebox -- invite <home.json> [--days 7]   print a one-time sign-up link for the customer
//
// Homebox itself lives in ../runtime/homebox/<version>/ and keeps its data in ../runtime/homebox/.data/.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { HomeRecord } from '../src/home-record.ts';
import { HomeboxClient, HomeboxError, inviteCustomer, syncHomeToHomebox } from '../src/homebox.ts';

const HOMEBOX_VERSION = 'v0.27.1';
const studioDir = path.resolve(import.meta.dirname, '..');
const runtimeDir = path.resolve(studioDir, '../runtime/homebox');
const envFile = path.join(studioDir, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const baseUrl = (process.env.HOMEBOX_URL || 'http://127.0.0.1:7745').replace(/\/+$/, '');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function apiClient(): HomeboxClient {
  if (!process.env.HOMEBOX_API_KEY) fail('No Homebox API key in .env.local. Run `npm run homebox -- setup` first.');
  return new HomeboxClient({ baseUrl, token: process.env.HOMEBOX_API_KEY });
}

async function isUp(): Promise<boolean> {
  try {
    return (await new HomeboxClient({ baseUrl, timeoutMs: 3_000 }).status()).health === true;
  } catch {
    return false;
  }
}

/** Sets KEY=value lines in .env.local, keeping every other line as it was. */
function writeEnv(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Za-z0-9_\-.:/@+=~]*$/.test(value)) throw new Error(`unexpected characters in the value for ${key}`);
  }
  const lines = existsSync(envFile)
    ? readFileSync(envFile, 'utf8').split(/\r?\n/)
    : ['# Written by `npm run homebox -- setup`. Holds real keys: keep it on this PC and never share it.'];
  const pending = new Map(Object.entries(values));
  const out = lines.map((line) => {
    const key = /^\s*([A-Za-z0-9_]+)\s*=/.exec(line)?.[1];
    if (key === undefined || !pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${value}`;
  });
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  for (const [key, value] of pending) out.push(`${key}=${value}`);
  writeFileSync(envFile, out.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  Object.assign(process.env, values);
}

function readHome(file: string): HomeRecord {
  const home = JSON.parse(readFileSync(file, 'utf8')) as HomeRecord;
  if (home.schema !== 'studio.home/1') fail(`${file} is not a home record (expected schema "studio.home/1").`);
  return home;
}

async function start(): Promise<void> {
  const exe = path.join(runtimeDir, HOMEBOX_VERSION, 'homebox.exe');
  if (!existsSync(exe)) {
    fail(`Homebox ${HOMEBOX_VERSION} is not downloaded: ${exe} is missing. studio/README.md says how to get it.`);
  }
  if (await isUp()) {
    console.log(`Homebox is already running at ${baseUrl}.`);
    return;
  }
  const pepperFile = path.join(runtimeDir, 'api-key-pepper.txt');
  if (!existsSync(pepperFile)) {
    // Homebox mixes this secret into its stored API key hashes. Changing it cancels every API key.
    writeFileSync(pepperFile, randomBytes(48).toString('base64') + '\n', { encoding: 'utf8', mode: 0o600 });
  }
  // v0.27.1 reads the pepper only from HBOX_AUTH_API_KEY_PEPPER. Reading it from a file
  // (HBOX_AUTH_API_KEY_PEPPER_FILE) arrived after that release.
  const pepper = readFileSync(pepperFile, 'utf8').trim();
  const allowRegistration = !process.env.HOMEBOX_SERVICE_EMAIL;
  // Our own settings (keys included) stay out of Homebox's environment.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('HOMEBOX_')));
  const child = spawn(exe, [], {
    cwd: runtimeDir,
    stdio: 'inherit',
    env: {
      ...inherited,
      HBOX_WEB_HOST: '127.0.0.1',
      HBOX_WEB_PORT: new URL(baseUrl).port || '7745',
      HBOX_OPTIONS_ALLOW_REGISTRATION: String(allowRegistration),
      HBOX_OPTIONS_GITHUB_RELEASE_CHECK: 'false',
      HBOX_OPTIONS_ALLOW_ANALYTICS: 'false',
      HBOX_AUTH_API_KEY_PEPPER: pepper,
    },
  });
  console.log(`Starting Homebox ${HOMEBOX_VERSION} at ${baseUrl}, data in ${path.join(runtimeDir, '.data')}. Ctrl+C stops it.`);
  console.log(
    allowRegistration
      ? 'Open sign-up is on until `npm run homebox -- setup` has created the studio account.'
      : 'Open sign-up is off: customers join with an invitation link.',
  );
  child.on('error', (err) => fail(`Could not start Homebox: ${err.message}`));
  child.on('exit', (code) => process.exit(code ?? 0));
}

async function status(): Promise<void> {
  const s = await new HomeboxClient({ baseUrl }).status();
  console.log(`Homebox ${s.build?.version ?? ''} at ${baseUrl}: ${s.health ? 'healthy' : 'NOT healthy'}`);
  console.log(`Open sign-up: ${s.allowRegistration ? 'on' : 'off'}`);
  console.log(`Studio API key: ${process.env.HOMEBOX_API_KEY ? 'set in .env.local' : 'not set (run setup)'}`);
}

async function setup(): Promise<void> {
  const anonymous = new HomeboxClient({ baseUrl });
  if (process.env.HOMEBOX_API_KEY) {
    try {
      await apiClient().request('GET', '/v1/users/self');
      console.log('Already set up: the API key in .env.local works.');
      return;
    } catch (err) {
      if (!(err instanceof HomeboxError && err.status === 401)) throw err;
      console.log('The API key in .env.local no longer works. Making a new one.');
    }
  }
  const email = process.env.HOMEBOX_SERVICE_EMAIL || 'studio@example.com';
  let password = process.env.HOMEBOX_SERVICE_PASSWORD;
  if (!password) {
    if (!(await anonymous.status()).allowRegistration) {
      fail('Homebox has open sign-up turned off, so the studio account cannot be created.');
    }
    password = randomBytes(24).toString('base64url');
    await anonymous.register({ email, name: 'Studio', password });
    // Save the account straight away so it is never lost, even if the next step fails.
    writeEnv({ HOMEBOX_URL: baseUrl, HOMEBOX_SERVICE_EMAIL: email, HOMEBOX_SERVICE_PASSWORD: password });
    console.log(`Created the studio account ${email}.`);
  }
  const session = await anonymous.login(email, password);
  const apiKey = await new HomeboxClient({ baseUrl, token: session }).createApiKey(
    `studio connector ${new Date().toISOString().slice(0, 10)}`,
  );
  writeEnv({ HOMEBOX_URL: baseUrl, HOMEBOX_API_KEY: apiKey });
  console.log(`Saved the account and a new API key in ${envFile}. Keep that file private.`);
  console.log('Restart Homebox (Ctrl+C, then `npm run homebox -- start`) to turn open sign-up off.');
}

async function sync(file: string): Promise<void> {
  const home = readHome(file);
  const client = apiClient();
  try {
    const r = await syncHomeToHomebox(home, client);
    console.log(`Synced "${home.name}" to Homebox household ${r.groupId}:`);
    console.log(`  ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged, ${r.recreated} re-created`);
    console.log(`  ${r.appliancesSkipped} appliances left for micasa (N12)`);
    if (r.notInDesign.length > 0) {
      console.log(`  No longer in the design, left as they are in Homebox: ${r.notInDesign.join(', ')}`);
    }
    console.log(`  See it at ${baseUrl} (sign in with the studio account in .env.local).`);
  } finally {
    // The links record what exists in Homebox, so save them even when the sync stopped partway.
    if (home.links.homebox) writeFileSync(file, JSON.stringify(home, null, 2) + '\n', 'utf8');
  }
}

async function invite(file: string, days: number): Promise<void> {
  const { url, expiresAt } = await inviteCustomer(readHome(file), apiClient(), { days });
  console.log(`One-time sign-up link for the customer, valid until ${expiresAt}:`);
  console.log(url);
  console.log('Anyone with this link can join this household once. Send it only to the customer.');
  const host = new URL(url).hostname;
  if (host === '127.0.0.1' || host === 'localhost') {
    console.log('This link only works on this PC until Homebox runs on a server (WORKFLOW.md D8).');
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { days: { type: 'string', default: '7' } },
});
const [command, file] = positionals;
const usage = 'Usage: npm run homebox -- start | status | setup | sync <home.json> | invite <home.json> [--days 7]';

switch (command) {
  case 'start':
    await start();
    break;
  case 'status':
    await status();
    break;
  case 'setup':
    await setup();
    break;
  case 'sync':
    if (!file) fail(usage);
    await sync(file);
    break;
  case 'invite': {
    if (!file) fail(usage);
    const days = Number(values.days);
    if (!Number.isInteger(days) || days < 1 || days > 90) fail('--days must be a whole number from 1 to 90.');
    await invite(file, days);
    break;
  }
  default:
    fail(usage);
}
