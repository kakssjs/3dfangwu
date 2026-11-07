import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import { emailQuotas } from '../../src/api/db/schema.ts';
import { startApi } from './helpers.ts';

const browserPath = process.env.STUDIO_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);

test('a mobile visitor verifies an email at registration and later logs in with an email code', { skip: !browserPath }, async () => {
  const sent: string[] = [];
  const api = await startApi({ email: true, emailSend: async (_email, code) => { sent.push(code); } });
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${api.url}/register`);
    await page.locator('input[name=phone]').fill('13800138000');
    await page.locator('input[name=displayName]').fill('邮箱用户');
    await page.locator('input[name=password]').fill('correct horse battery');
    await page.locator('input[name=email]').fill('person@example.com');
    await page.locator('button[data-purpose=register]').click();
    assert.equal(sent.length, 0, 'consent is required before sending');
    await page.locator('input[name=acceptTerms]').check();
    const sendRequest = page.waitForResponse((r) => r.url().endsWith('/auth/email/code') && r.status() === 201);
    await page.locator('button[data-purpose=register]').click();
    await sendRequest;
    assert.equal(sent.length, 1);
    assert.equal(await page.locator('button[data-purpose=register]').isDisabled(), true);
    await page.locator('input[name=emailCode]').fill(sent[0]!);
    await page.locator('input[name=email]').fill('other@example.com');
    assert.equal(await page.locator('input[name=emailCode]').inputValue(), '');
    await page.locator('input[name=email]').fill('person@example.com');
    await page.locator('input[name=emailCode]').fill(sent[0]!);
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/projects');
    await context.close();

    await api.db.delete(emailQuotas);
    const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const login = await loginContext.newPage();
    login.on('pageerror', (e) => errors.push(e.message));
    await login.goto(`${api.url}/login`);
    assert.equal(await login.locator('input[name=phone]').count(), 1);
    await login.locator('input[name=email]').fill('person@example.com');
    const loginRequest = login.waitForResponse((r) => r.url().endsWith('/auth/email/code') && r.status() === 201);
    await login.locator('button[data-purpose=login]').click();
    await loginRequest;
    await login.locator('input[name=code]').fill(sent.at(-1)!);
    await login.locator('form').filter({ has: login.locator('input[name=email]') }).locator('button[type=submit]').click();
    await login.waitForURL('**/projects');
    assert.deepEqual(errors, []);
    await loginContext.close();
  } finally {
    await browser.close();
    await api.close();
  }
});
