import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { authorizeOutlook } from '../scripts/outlook-authorize.ts';

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';
const device = { device_code: 'private-device-code', user_code: 'ABCD-EFGH', verification_uri: 'https://microsoft.com/devicelogin', expires_in: 900, interval: 1 };

test('Outlook device authorization polls at the required interval and saves only the refresh credential privately', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studio-outlook-'));
  const tokenFile = path.join(dir, 'token.json');
  const messages: string[] = [];
  const waits: number[] = [];
  const requests: { url: string; body: URLSearchParams }[] = [];
  const replies = [device, { error: 'authorization_pending' }, { error: 'slow_down' }, { access_token: 'private-access', refresh_token: 'private-refresh', scope: 'https://outlook.office.com/SMTP.Send' }];
  const request = (async (url: string, options: RequestInit) => {
    requests.push({ url, body: options.body as URLSearchParams });
    const reply = replies.shift()!;
    return new Response(JSON.stringify(reply), { status: 'error' in reply ? 400 : 200 });
  }) as typeof fetch;
  try {
    await authorizeOutlook(CLIENT_ID, tokenFile, { request, notify: (s) => messages.push(s), wait: async (ms) => { waits.push(ms); } });
    assert.deepEqual(JSON.parse(readFileSync(tokenFile, 'utf8')), { refreshToken: 'private-refresh' });
    assert.match(messages.join('\n'), /ABCD-EFGH/);
    assert.doesNotMatch(messages.join('\n'), /private-device-code|private-refresh|private-access/);
    assert.deepEqual(waits, [1000, 1000, 6000]);
    assert.equal(requests[0]!.body.get('scope'), 'https://outlook.office.com/SMTP.Send offline_access');
    assert.ok(requests.every((r) => r.url.startsWith('https://login.microsoftonline.com/consumers/oauth2/v2.0/')));
    assert.equal(requests[1]!.body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:device_code');
    assert.equal(requests[1]!.body.get('client_secret'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('declined or incomplete Outlook authorization never saves a credential or leaks provider details', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studio-outlook-'));
  const tokenFile = path.join(dir, 'token.json');
  try {
    for (const final of [{ error: 'authorization_declined', error_description: 'private-device-code' }, { access_token: 'private-access' }]) {
      let calls = 0;
      const request = (async () => new Response(JSON.stringify(calls++ === 0 ? device : final), { status: calls === 1 ? 200 : 400 })) as typeof fetch;
      await assert.rejects(authorizeOutlook(CLIENT_ID, tokenFile, { request, notify: () => {}, wait: async () => {} }), (e: Error) => {
        assert.doesNotMatch(e.message, /private-device-code|private-access/);
        return true;
      });
      assert.equal(existsSync(tokenFile), false);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
