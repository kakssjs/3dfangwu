// Real browser + real floor-plan reader; throwaway database, no customer data touched.
// Run after npm run build: node scripts/audit-floorplan-flow.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { startApi } from '../dist/test/api/helpers.js';
import { httpTransport } from '../dist/src/api/agents/mimo.js';
import { planOverlaySvg } from '../dist/src/api/homes/floor-plan.js';
process.loadEnvFile(new URL('../.env.local', import.meta.url));
const doubao = !!process.env.DOUBAO_API_KEY;
const apiKey = process.env.DOUBAO_API_KEY || process.env.MIMO_API_KEY;
assert.ok(apiKey, 'Configure a live floor-plan reader in .env.local');
const api = await startApi({ mimo: httpTransport({ apiKey,
  baseUrl: doubao ? (process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3') : process.env.MIMO_BASE_URL,
  model: doubao ? (process.env.DOUBAO_MODEL || 'doubao-seed-2-1-lite-260915') : process.env.MIMO_MODEL,
  timeoutMs: 240000 }) });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.STUDIO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1400, height: 1050 } });
  const drawing = await context.newPage();
  const plan = JSON.parse(readFileSync(new URL('../samples/plan-sample.json', import.meta.url)));
  await drawing.setContent('<style>html,body{margin:0;background:white}svg{width:1400px;height:1050px}</style>' + planOverlaySvg(plan));
  const image = await drawing.screenshot();
  await drawing.close();
  const page = await context.newPage();
  await page.goto(api.url + '/register');
  await page.locator('input[name=phone]').fill('13800138888');
  await page.locator('input[name=displayName]').fill('Live flow audit');
  await page.locator('input[name=password]').fill('test password abc');
  await page.locator('input[name=acceptTerms]').check();
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/projects');
  console.log('PASS browser registration');
  await page.goto(api.url + '/homes/new');
  await page.locator('input[name=name]').fill('Live audit apartment');
  await page.locator('input[type=file]').setInputFiles({ name: 'audit-floorplan.png', mimeType: 'image/png', buffer: image });
  const response = page.waitForResponse(r => r.url().endsWith('/api/homes/from-image') && r.request().method() === 'POST', { timeout: 300000 });
  await page.locator('button[type=submit]').click();
  const result = await response;
  const home = await result.json();
  assert.equal(result.status(), 201, JSON.stringify(home));
  assert.ok(home.plan.rooms.length >= 5);
  console.log('PASS real upload, live reader, stored home:', home.plan.rooms.length, 'rooms');
  await page.locator('.home-overlay[src]').waitFor({ timeout: 20000 });
  await page.locator('.home-overlay').evaluate(image => image.decode());
  const editor = await context.newPage();
  // startApi uses a fictional public origin; only replace that test origin, retain the private path.
  await editor.goto(api.url + new URL(home.link).pathname);
  await editor.waitForFunction(() => document.querySelector('#gWalls')?.children.length >= 4, null, { timeout: 20000 });
  await editor.click('details.menu > summary');
  const saved = editor.waitForResponse(r => r.url().includes('/designs') && r.request().method() === 'POST');
  await editor.click('#saveVersion');
  assert.equal((await saved).status(), 201);
  await editor.locator('#versionSel option[value="1"]').waitFor({ state: 'attached' });
  editor.on('dialog', dialog => dialog.accept());
  await editor.click('details.menu > summary');
  const confirmed = editor.waitForResponse(r => r.url().includes('/confirm') && r.request().method() === 'POST');
  await editor.click('#confirmVersion');
  assert.equal((await confirmed).status(), 200);
  console.log('PASS overlay, 3D editor, saved and confirmed version');
} finally {
  await browser?.close();
  await api.close();
}
