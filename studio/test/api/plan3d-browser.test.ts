// A real browser against the 3D link (F1, F6): a home's own plan document loads into floorplan-3d
// through our API — its walls drawn, its title shown, a version saved through the link — instead of
// the built-in sample apartment. The model never speaks here; the reading is stubbed elsewhere.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser } from 'playwright-core';
import { startApi } from './helpers.ts';

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browserPath = process.env.STUDIO_BROWSER ?? BROWSERS.find((p) => existsSync(p));

/** A small plan in the F2 format: two rooms in a 4m × 3m box. */
const PLAN = {
  schema: 'studio.plan/1',
  units: 'mm',
  name: '测试户型',
  nameEn: 'Test Flat',
  walls: [[0, 0, 4000, 0, 'e'], [4000, 0, 4000, 3000, 'e'], [0, 3000, 4000, 3000, 'e'], [0, 0, 0, 3000, 'e'], [2000, 0, 2000, 3000, 'n']],
  windows: [[500, 0, 1500, 0]],
  doors: [{ name: '入户门', rect: [0, 1000, 0, 2000], h: [0, 2000], c: [1, 0], o: [0, 1], len: 900, entry: true }],
  slidingDoors: [],
  rooms: [
    { id: 'living', name: '客厅', nameEn: 'Living Room', poly: [[0, 0], [2000, 0], [2000, 3000], [0, 3000]], mat: 'tile800' },
    { id: 'bed', name: '卧室', nameEn: 'Bedroom', poly: [[2000, 0], [4000, 0], [4000, 3000], [2000, 3000]], mat: 'wood' },
  ],
};

describe('the 3D editor behind a home\'s link, in a real browser', { skip: browserPath ? false : 'no Edge or Chrome found (set STUDIO_BROWSER)' }, () => {
  let browser: Browser;
  before(async () => {
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
  });
  after(async () => {
    await browser?.close();
  });

  test('the home\'s own plan loads, draws and saves a version through the link', async () => {
    const api = await startApi();
    try {
      const reg = await api.call('POST', '/auth/register', {
        body: { role: 'homeowner', phone: '13800139991', password: 'correct horse battery', displayName: '钱先生', language: 'zh-CN', acceptTerms: true },
      });
      assert.equal(reg.status, 201, JSON.stringify(reg.body));
      const home = await api.call('POST', '/homes', { token: reg.body.accessToken, body: { name: '测试家', plan: PLAN } });
      assert.equal(home.status, 201, JSON.stringify(home.body));
      const token = home.body.link.split('/plan3d/')[1] as string;

      const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
      const page = await context.newPage();
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      await page.goto(`${api.url}/plan3d/${token}`);
      // The plan's own walls draw, and the title is this home's, not the sample's.
      await page.waitForFunction("(document.querySelector('#gWalls')?.children.length ?? 0) >= 4", undefined, { timeout: 15_000 });
      const brand = await page.textContent('.brand b');
      assert.match(brand ?? '', /测试户型/, 'the title is the home\'s own');
      const rooms = await page.textContent('#panel');
      assert.match(rooms ?? '', /客厅/, 'its rooms are listed');
      assert.deepEqual(problems, []);

      // F6: the File menu saves a numbered version through the link.
      await page.click('details.menu > summary');
      const answered = page.waitForResponse((r) => r.url().includes(`/api/plan-links/${token}/designs`) && r.request().method() === 'POST', { timeout: 15_000 });
      await page.click('#saveVersion');
      await answered;
      const saved = await api.call('GET', `/plan-links/${token}`);
      assert.equal(saved.body.designs.length, 1, 'version 1 is on the server');
      assert.equal(saved.body.designs[0].number, 1);
      await page.locator('#versionSel option[value="1"]').waitFor({ state: 'attached' });
      await page.click('details.menu > summary');
      const confirmed = page.waitForResponse((r) => r.url().endsWith('/designs/1/confirm') && r.request().method() === 'POST');
      await page.click('#confirmVersion');
      assert.equal((await confirmed).status(), 200);
      const afterConfirm = await api.call('GET', `/plan-links/${token}`);
      assert.equal(afterConfirm.body.confirmedDesign, 1);

      await context.close();
    } finally {
      await api.close();
    }
  });
});
