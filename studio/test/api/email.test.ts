import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eq, like } from 'drizzle-orm';
import { emailChallenges, emailQuotas, users } from '../../src/api/db/schema.ts';
import type { EmailPurpose, EmailSender } from '../../src/api/auth/email.ts';
import { loadConfig } from '../../src/api/config.ts';
import { startApi } from './helpers.ts';

const account = (phone = '13800138000', email = 'person@example.com', emailCode?: string) => ({
  role: 'homeowner', phone, email, emailCode, password: 'correct horse battery', displayName: '邮箱用户', language: 'zh-CN', acceptTerms: true,
});
const codeRequest = (email = 'person@example.com', purpose: EmailPurpose = 'register') => ({ email, purpose, ...(purpose === 'register' ? { acceptTerms: true } : {}) });

function outbox() {
  const sent: { email: string; code: string; purpose: EmailPurpose }[] = [];
  const send: EmailSender = async (email, code, purpose) => { sent.push({ email, code, purpose }); };
  return { sent, send };
}

test('email verification is explicitly disabled until a sender is configured', async () => {
  const api = await startApi();
  try {
    const settings = await api.call('GET', '/auth/email');
    assert.equal(settings.status, 200);
    assert.deepEqual(settings.body, { enabled: false });
    const sent = await api.call('POST', '/auth/email/code', { body: { email: 'person@example.com', purpose: 'register', acceptTerms: true } });
    assert.equal(sent.status, 503);
    const login = await api.call('POST', '/auth/email/login', { body: { email: 'person@example.com', code: '123456' } });
    assert.equal(login.status, 503);
    const registered = await api.call('POST', '/auth/register', { body: account(undefined, 'unverified@example.com', '123456') });
    assert.equal(registered.status, 201);
    assert.equal((await api.db.select().from(users))[0]!.email, null);
  } finally {
    await api.close();
  }
});

test('mailbox daily and site-wide budgets survive cooldown expiration; no unverified email can sign in', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    for (let n = 0; n < 5; n++) {
      assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest() })).status, 201);
      await api.db.update(emailQuotas).set({ expiresAt: new Date(0) }).where(like(emailQuotas.key, '%:minute'));
    }
    await api.db.delete(emailQuotas).where(like(emailQuotas.key, 'ip:%'));
    assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest('PERSON@example.com', 'login') })).status, 429);
    assert.equal(box.sent.length, 5);
    await api.db.update(emailQuotas).set({ count: 100 }).where(eq(emailQuotas.key, 'site:day'));
    assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest('another@example.com') })).status, 429);
    assert.equal(box.sent.length, 5);
    await api.db.delete(emailQuotas);
    await api.call('POST', '/auth/email/code', { body: codeRequest('unknown@example.com', 'login') });
    assert.equal((await api.call('POST', '/auth/email/login', { body: { email: 'unknown@example.com', code: box.sent.at(-1)!.code } })).status, 401);
    assert.equal((await api.db.select().from(users)).length, 0);
  } finally { await api.close(); }
});

test('email registration cannot overwrite an existing phone account, and a rejected creation does not consume its code', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    await api.call('POST', '/auth/email/code', { body: codeRequest() });
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, box.sent[0]!.code) })).status, 201);
    await api.call('POST', '/auth/email/code', { body: codeRequest('another@example.com') });
    const anotherCode = box.sent.at(-1)!.code;
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, 'another@example.com', anotherCode) })).status, 409);
    assert.equal((await api.call('POST', '/auth/register', { body: account('13800138001', 'another@example.com', anotherCode) })).status, 201);
    const stored = await api.db.select().from(users);
    assert.equal(stored.length, 2);
    assert.equal(stored.find((u) => u.phone === '13800138000')!.email, 'person@example.com');
  } finally { await api.close(); }
});

test('explicitly enabling email without valid SMTP settings fails instead of silently bypassing verification', () => {
  const env = { STUDIO_JWT_SECRET: 'a'.repeat(32), STUDIO_EMAIL_ENABLED: 'true' };
  assert.throws(() => loadConfig(env), /SMTP/);
  assert.equal(loadConfig({ STUDIO_JWT_SECRET: 'a'.repeat(32) }).email.enabled, false);
});

test('sending validates inputs and consent, normalizes email, and never returns or stores the plaintext code', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    assert.deepEqual((await api.call('GET', '/auth/email')).body, { enabled: true });
    for (const body of [codeRequest('bad email'), { email: 'person@example.com', purpose: 'register' }, { ...codeRequest(), extra: true }, codeRequest('person@example.com', 'reset' as EmailPurpose)]) {
      assert.equal((await api.call('POST', '/auth/email/code', { body })).status, 400);
    }
    assert.equal(box.sent.length, 0);
    const response = await api.call('POST', '/auth/email/code', { body: codeRequest('  PERSON@example.com  ') });
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { resendAfterSeconds: 60 });
    assert.equal(box.sent[0]!.email, 'person@example.com');
    assert.match(box.sent[0]!.code, /^\d{6}$/);
    const [stored] = await api.db.select().from(emailChallenges);
    assert.ok(stored);
    assert.notEqual(stored.codeHash, box.sent[0]!.code);
    assert.ok(!JSON.stringify(response.body).includes(box.sent[0]!.code));
    assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest('person@example.com', 'login') })).status, 429);
  } finally { await api.close(); }
});

test('verified registration creates the existing account, and email codes can then sign it in once', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    assert.equal((await api.call('POST', '/auth/register', { body: account() })).status, 400);
    await api.call('POST', '/auth/email/code', { body: codeRequest() });
    const code = box.sent[0]!.code;
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, 'wrong!') })).status, 400);
    const registered = await api.call('POST', '/auth/register', { body: account(undefined, undefined, code) });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    const [stored] = await api.db.select().from(users);
    assert.equal(stored!.email, 'person@example.com');
    assert.ok(stored!.emailVerifiedAt);
    assert.equal((await api.call('POST', '/auth/login', { body: { phone: '13800138000', password: 'correct horse battery' } })).status, 200);
    await api.db.delete(emailQuotas);
    const requested = await api.call('POST', '/auth/email/code', { body: codeRequest('PERSON@example.com', 'login') });
    assert.equal(requested.status, 201);
    const loginCode = box.sent.at(-1)!.code;
    const attempts = await Promise.all([1, 2].map(() => api.call('POST', '/auth/email/login', { body: { email: 'person@example.com', code: loginCode } })));
    assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 401]);
    assert.equal(attempts.find((r) => r.status === 200)!.body.user.id, registered.body.user.id);
  } finally { await api.close(); }
});

test('codes are bound to an email and purpose; failed attempts persist and lock out after five', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    await api.call('POST', '/auth/email/code', { body: codeRequest() });
    const code = box.sent[0]!.code;
    assert.equal((await api.call('POST', '/auth/email/login', { body: { email: 'person@example.com', code } })).status, 401);
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, 'other@example.com', code) })).status, 400);
    const wrong = code === '000000' ? '111111' : '000000';
    const rejected = await Promise.all(Array.from({ length: 7 }, () => api.call('POST', '/auth/register', { body: account(undefined, undefined, wrong) })));
    assert.ok(rejected.every((r) => r.status === 400));
    assert.equal((await api.db.select().from(emailChallenges))[0]!.attempts, 5);
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, code) })).status, 400);
    assert.equal((await api.db.select().from(users)).length, 0);
  } finally { await api.close(); }
});

test('expired and superseded codes cannot register; concurrent sends and registrations do not duplicate', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    const results = await Promise.all([1, 2].map(() => api.call('POST', '/auth/email/code', { body: codeRequest() })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 429]);
    assert.equal(box.sent.length, 1);
    const old = box.sent[0]!.code;
    await api.db.update(emailChallenges).set({ expiresAt: new Date(0) });
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, old) })).status, 400);
    await api.db.delete(emailQuotas);
    await api.call('POST', '/auth/email/code', { body: codeRequest() });
    const current = box.sent.at(-1)!.code;
    // A random collision is valid for the new challenge, so only check supersession when distinct.
    if (old !== current) assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, old) })).status, 400);
    const registered = await Promise.all([1, 2].map((n) => api.call('POST', '/auth/register', { body: account(`1380013800${n}`, undefined, current) })));
    assert.deepEqual(registered.map((r) => r.status).sort(), [201, 400]);
    assert.equal((await api.db.select().from(users)).length, 1);
  } finally { await api.close(); }
});

test('provider failure is sanitized, consumes send quota, and cannot create a usable challenge', async () => {
  let captured = '';
  const api = await startApi({ email: true, emailSend: async (_email, code) => { captured = code; throw new Error('smtp secret password'); } });
  try {
    const sent = await api.call('POST', '/auth/email/code', { body: codeRequest() });
    assert.equal(sent.status, 503);
    assert.doesNotMatch(JSON.stringify(sent.body), /secret password/);
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, captured) })).status, 400);
    assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest() })).status, 429);
  } finally { await api.close(); }
});

test('a code cannot be consumed until the sender has accepted the email', async () => {
  let accepted!: () => void;
  let started!: (code: string) => void;
  const ready = new Promise<string>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { accepted = resolve; });
  const api = await startApi({ email: true, emailSend: async (_email, code) => { started(code); await gate; } });
  const sending = api.call('POST', '/auth/email/code', { body: codeRequest() });
  try {
    const code = await ready;
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, code) })).status, 400);
    accepted();
    assert.equal((await sending).status, 201);
    assert.equal((await api.call('POST', '/auth/register', { body: account(undefined, undefined, code) })).status, 201);
  } finally { accepted(); await sending; await api.close(); }
});

test('the same IP cannot trigger more than five emails per hour even for different recipients', async () => {
  const box = outbox();
  const api = await startApi({ email: true, emailSend: box.send });
  try {
    for (let n = 0; n < 5; n++) assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest(`person${n}@example.com`) })).status, 201);
    assert.equal((await api.call('POST', '/auth/email/code', { body: codeRequest('person6@example.com') })).status, 429);
    assert.equal(box.sent.length, 5);
    assert.ok((await api.db.select().from(emailQuotas)).every((q) => !q.key.includes('127.0.0.1')));
    assert.equal((await api.call('POST', '/auth/email/login', { body: { email: 'unknown@example.com', code: box.sent[0]!.code } })).status, 401);
    assert.equal((await api.db.select().from(users).where(eq(users.email, 'unknown@example.com'))).length, 0);
  } finally { await api.close(); }
});
