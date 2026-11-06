// A real browser against the map wiring (D26): the page loads "Amap" (a stand-in script, so nothing
// leaves the machine), the person finds a community, and the pickers and the saved project follow.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright-core';
import { dateInChina, startApi, type Api } from './helpers.ts';

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

const KEY = 'test-js-key-0123456789abcdef0123';
const CODE = 'test-security-code-abcdef0123456789';

/** Just enough of Amap's JS API 2.0 for the page: a map, a marker, a place search and a geocoder. */
const FAKE_AMAP = `
window.AMap = {
  Map: class { constructor(el) { window.__map = el; } on(name, fn) { window.__click = fn; } setZoomAndCenter(z, c) { window.__center = c; } add() {} },
  Marker: class { setPosition() {} },
  PlaceSearch: class { search(q, cb) {
    window.__query = q;
    cb('complete', { poiList: { pois: [{ name: '联洋花园', pname: '上海市', cityname: '上海市', adname: '浦东新区', address: '黄杨路', location: { lng: 121.54, lat: 31.21 } }] } });
  } },
  Geocoder: class { getAddress(l, cb) {
    const lng = Array.isArray(l) ? l[0] : l.lng;
    const east = lng > 121.45;
    cb('complete', { regeocode: { addressComponent: { province: '上海市', city: [], district: east ? '浦东新区' : '闵行区', neighborhood: { name: east ? '' : '莘庄镇' } } } });
  } },
};`;

describe('the map in a real browser', { skip: browserPath ? false : 'no Edge or Chrome found (set STUDIO_BROWSER)' }, () => {
  let browser: Browser;
  before(async () => {
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
  });
  after(async () => {
    await browser?.close();
  });

  async function homeownerPage(api: Api, phone: string): Promise<{ page: Page; token: string; problems: string[] }> {
    const reg = await api.call('POST', '/auth/register', { body: { role: 'homeowner', phone, password: 'correct horse battery', displayName: 'Ms Wang', language: 'en', acceptTerms: true } });
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 900, height: 900 } });
    await context.addInitScript((t) => localStorage.setItem('ir.token', t), reg.body.accessToken);
    const page = await context.newPage();
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warning') && !m.text().startsWith('Failed to load resource')) problems.push(`console ${m.type()}: ${m.text()}`);
    });
    await page.route('https://webapi.amap.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: FAKE_AMAP }));
    return { page, token: reg.body.accessToken, problems };
  }

  test('a community found by name fills the city and district, and is saved with the project', async () => {
    const api = await startApi({ amap: { key: KEY, securityCode: CODE } });
    try {
      const { page, token, problems } = await homeownerPage(api, '13500000001');
      await page.goto(`${api.url}/projects/new`);
      const frame = page.frameLocator('iframe.map-frame');
      await frame.locator('input[type=search]').fill('联洋');
      const hit = frame.locator('button.result', { hasText: '联洋花园' });
      await hit.waitFor();
      // The page asks our server for Amap's services; the security code is nowhere in the page.
      const mapPage = page.frames().find((f) => f.url().endsWith('/map-frame.html'))!;
      assert.equal(await mapPage.evaluate('window._AMapSecurityConfig.serviceHost'), `${api.url}/_AMapService`);
      assert.doesNotMatch(await page.content(), new RegExp(CODE));
      assert.doesNotMatch(await mapPage.content(), new RegExp(CODE));
      await hit.click();
      await page.getByText('Chosen: 联洋花园').waitFor();
      assert.equal(await page.locator('select[name=city]').inputValue(), '上海');
      assert.equal(await page.locator('select[name=district]').inputValue(), '浦东新区');
      assert.deepEqual(await mapPage.evaluate('window.__center'), [121.54, 31.21]);

      // Clicking the map finds the community there instead.
      await mapPage.evaluate('window.__click({ lnglat: { lng: 121.38, lat: 31.11 } })');
      await page.getByText('Chosen: 莘庄镇').waitFor();
      assert.equal(await page.locator('select[name=district]').inputValue(), '闵行区');

      await page.locator('input[name=title]').fill('Old flat');
      await page.locator('input[name=floorAreaM2]').fill('80');
      await page.locator('input[name=budgetMinCny]').fill('100000');
      await page.locator('input[name=budgetMaxCny]').fill('150000');
      await page.locator('input[name=desiredStart]').fill(dateInChina(30));
      await page.locator('textarea[name=description]').fill('Redo the kitchen and the bathroom completely.');
      await page.locator('button[type=submit]').click();
      await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
      const id = page.url().split('/').pop();
      const saved = await api.call('GET', `/projects/${id}`, { token });
      assert.equal(saved.body.community, '莘庄镇');
      assert.equal(saved.body.district, '闵行区');
      assert.deepEqual(problems, []);
    } finally {
      await api.close();
    }
  });

  test('with a key but no security code the map shows, search says it is not set up, and the pickers still work', async () => {
    const api = await startApi({ amap: { key: KEY, securityCode: '' } });
    try {
      const { page, problems } = await homeownerPage(api, '13500000002');
      await page.goto(`${api.url}/projects/new`);
      const frame = page.frameLocator('iframe.map-frame');
      await frame.getByText(/security code is missing/).waitFor();
      assert.equal(await frame.locator('input[type=search]').isDisabled(), true);
      await page.getByLabel('Province').selectOption('江苏省');
      await page.locator('select[name=city]').selectOption('苏州');
      await page.locator('select[name=district]').selectOption('姑苏区');
      assert.deepEqual(problems, []);
    } finally {
      await api.close();
    }
  });

  test('with no key there is no map at all', async () => {
    const api = await startApi();
    try {
      const { page } = await homeownerPage(api, '13500000003');
      await page.goto(`${api.url}/projects/new`);
      await page.getByRole('heading', { name: 'Where is the home?' }).waitFor();
      assert.equal(await page.locator('iframe.map-frame').count(), 0);
    } finally {
      await api.close();
    }
  });
});
