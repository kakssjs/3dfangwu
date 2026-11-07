// One-time, user-approved Outlook SMTP authorization; credentials never appear in terminal output.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { envFile, studioDir } from '../src/api/config.ts';
import { OUTLOOK_AUTHORITY, OUTLOOK_SCOPE, saveOutlookToken } from '../src/api/auth/outlook.ts';

export async function authorizeOutlook(clientId: string, tokenFile: string, {
  request = fetch, notify = console.log, wait = (ms: number) => setTimeout(ms),
}: { request?: typeof fetch; notify?: (message: string) => void; wait?: (ms: number) => Promise<unknown> } = {}): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    throw new Error('Set OUTLOOK_CLIENT_ID to your registered Microsoft application ID first.');
  }
  async function post(endpoint: string, body: Record<string, string>) {
    const response = await request(`${OUTLOOK_AUTHORITY}/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body), redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    return { ok: response.ok, data: await response.json() as Record<string, unknown> };
  }
  const { ok, data: device } = await post('devicecode', { client_id: clientId, scope: OUTLOOK_SCOPE });
  if (!ok || typeof device.device_code !== 'string' || !device.device_code
    || typeof device.user_code !== 'string' || !/^[A-Z0-9-]{4,30}$/i.test(device.user_code)
    || typeof device.expires_in !== 'number' || device.expires_in <= 0) {
    throw new Error('Cannot start Outlook authorization. Check the application supports personal accounts and public client flows.');
  }
  notify(`Open https://microsoft.com/devicelogin and enter ${device.user_code}. Authorize SMTP sending only for your configured sender account.`);
  let interval = Math.min(60, Math.max(1, Number(device.interval) || 5)) * 1000;
  const deadline = Date.now() + Math.min(900, device.expires_in) * 1000;
  while (Date.now() < deadline) {
    await wait(interval);
    if (Date.now() >= deadline) break;
    const result = await post('token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: clientId, device_code: device.device_code });
    if (result.data.error === 'authorization_pending') continue;
    if (result.data.error === 'slow_down') { interval = Math.min(60_000, interval + 5000); continue; }
    if (!result.ok || typeof result.data.refresh_token !== 'string' || !result.data.refresh_token
      || typeof result.data.scope !== 'string' || !result.data.scope.split(' ').includes('https://outlook.office.com/SMTP.Send')) {
      throw new Error('Outlook authorization was declined, incomplete, or expired. No credential was saved.');
    }
    saveOutlookToken(tokenFile, result.data.refresh_token);
    notify('Outlook authorization saved privately. Verify SMTP before enabling email verification.');
    return;
  }
  throw new Error('Outlook authorization expired. Run the authorization command again when ready.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
    await authorizeOutlook(process.env.OUTLOOK_CLIENT_ID ?? '', process.env.OUTLOOK_TOKEN_FILE || path.join(studioDir, '..', 'runtime', 'outlook-smtp.json'));
  } catch {
    console.error('Outlook authorization could not complete. Check the application ID and public client settings, then retry; no credentials are printed.');
    process.exitCode = 1;
  }
}
