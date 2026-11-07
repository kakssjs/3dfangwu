import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import XOAuth2 from 'nodemailer/lib/xoauth2';
import { loadConfig } from '../src/api/config.ts';
import { outlookTokenProvider, readOutlookToken, saveOutlookToken } from '../src/api/auth/outlook.ts';

test('Outlook tokens are private JSON files, atomically replaceable, and malformed files fail without exposing their contents', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studio-outlook-'));
  const file = path.join(dir, 'token.json');
  try {
    saveOutlookToken(file, 'first-private-token');
    assert.equal(readOutlookToken(file), 'first-private-token');
    saveOutlookToken(file, 'new-private-token');
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { refreshToken: 'new-private-token' });
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
    writeFileSync(file, 'secret malformed token');
    assert.throws(() => readOutlookToken(file), (error: Error) => !error.message.includes('secret malformed token'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Outlook enables only with a client ID and token file, fixes Microsoft SMTP settings, and needs no SMTP password', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studio-outlook-config-'));
  const file = path.join(dir, 'token.json');
  const env = {
    STUDIO_JWT_SECRET: 'x'.repeat(32), STUDIO_EMAIL_ENABLED: 'true', SMTP_AUTH_TYPE: 'outlook',
    SMTP_USER: 'sender@outlook.com', SMTP_FROM: 'sender@outlook.com',
    OUTLOOK_CLIENT_ID: '00000000-0000-4000-8000-000000000000', OUTLOOK_TOKEN_FILE: file,
  };
  try {
    assert.equal(loadConfig({ ...env, STUDIO_EMAIL_ENABLED: 'false' }).email.enabled, false);
    assert.throws(() => loadConfig(env), /Outlook/);
    saveOutlookToken(file, 'private-token');
    const config = loadConfig(env).email;
    assert.equal(config.host, 'smtp-mail.outlook.com');
    assert.equal(config.port, 587);
    assert.equal(config.secure, false);
    assert.equal(config.authType, 'outlook');
    assert.throws(() => loadConfig({ ...env, OUTLOOK_CLIENT_ID: '' }), /OUTLOOK_CLIENT_ID/);
    assert.throws(() => loadConfig({ ...env, SMTP_AUTH_TYPE: 'outllook' }), /SMTP_AUTH_TYPE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Outlook refresh uses only the Microsoft endpoint, rotates the file, and reuses Nodemailer caching and concurrency control', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studio-outlook-refresh-'));
  const file = path.join(dir, 'token.json');
  saveOutlookToken(file, 'old-token');
  let requests = 0;
  let oldToken = 'old-token';
  const request = mock.method(globalThis, 'fetch', (async (url: string | URL | Request, options?: RequestInit) => {
    requests++;
    assert.equal(String(url), 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token');
    const data = options!.body as URLSearchParams;
    assert.equal(data.get('refresh_token'), oldToken);
    assert.equal(data.get('grant_type'), 'refresh_token');
    assert.equal(data.get('scope'), 'https://outlook.office.com/SMTP.Send offline_access');
    assert.equal(data.has('client_secret'), false);
    assert.equal(options!.redirect, 'error');
    oldToken = `rotated-${requests}`;
    return new Response(JSON.stringify({ access_token: `access-${requests}`, refresh_token: oldToken, expires_in: 3600 }));
  }) as typeof fetch);
  try {
    const oauth = new XOAuth2({ user: 'sender@outlook.com', provisionCallback: outlookTokenProvider({ oauthClientId: 'client-id', oauthTokenFile: file }) });
    const token = (renew = false) => new Promise<string>((resolve, reject) => oauth.getToken(renew, (error, value) => error ? reject(error) : resolve(value)));
    assert.deepEqual(await Promise.all([token(), token()]), ['access-1', 'access-1']);
    assert.equal(requests, 1);
    assert.equal(await token(), 'access-1');
    assert.equal(requests, 1);
    assert.equal(readOutlookToken(file), 'rotated-1');
    assert.equal(await token(true), 'access-2');
    assert.equal(readOutlookToken(file), 'rotated-2');
  } finally { request.mock.restore(); rmSync(dir, { recursive: true, force: true }); }
});

test('Outlook refresh errors do not reveal provider messages, keep the old token, and do not cache an invalid response', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'studio-outlook-error-'));
  const file = path.join(dir, 'token.json');
  saveOutlookToken(file, 'old-private-token');
  let response = { status: 400, body: { error_description: 'private provider response' } };
  const request = mock.method(globalThis, 'fetch', (async () => new Response(JSON.stringify(response.body), { status: response.status })) as typeof fetch);
  try {
    const provide = outlookTokenProvider({ oauthClientId: 'client-id', oauthTokenFile: file });
    const token = () => new Promise<string>((resolve, reject) => provide('sender@outlook.com', false, (error, value) => error ? reject(error) : resolve(value!)));
    await assert.rejects(token(), (error: Error) => !/private|old-private-token/.test(error.message));
    assert.equal(readOutlookToken(file), 'old-private-token');
    response = { status: 200, body: {} } as typeof response;
    await assert.rejects(token(), /Outlook/);
    assert.equal(readOutlookToken(file), 'old-private-token');
  } finally { request.mock.restore(); rmSync(dir, { recursive: true, force: true }); }
});
