// End to end: the Amap map settings, the proxy that keeps the security code on the server, and the
// community a project can carry (D26). Amap itself is a stub: no request leaves the machine.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dateInChina, startApi } from './helpers.ts';

const KEY = 'test-js-key-0123456789abcdef0123';
const CODE = 'test-security-code-abcdef0123456789';

describe('the map settings and page', () => {
  test('with no key there is no map, and the page keeps its strictest policy', async () => {
    const api = await startApi();
    try {
      assert.deepEqual((await api.call('GET', '/config')).body, { amap: null });
      const policy = (await fetch(`${api.url}/`)).headers.get('content-security-policy') ?? '';
      assert.doesNotMatch(policy, /amap|autonavi|unsafe/);
      assert.equal((await fetch(`${api.url}/_AMapService/v3/place/text?key=x`)).status, 503);
    } finally {
      await api.close();
    }
  });

  test('with a key the page may load the map, but the security code is never shown to the page', async () => {
    const api = await startApi({ amap: { key: KEY, securityCode: CODE } });
    try {
      const config = await api.call('GET', '/config');
      assert.deepEqual(config.body, { amap: { key: KEY, searchReady: true, serviceHost: '/_AMapService' } });
      assert.doesNotMatch(JSON.stringify(config.body), new RegExp(CODE));
      // The app's own pages keep the strict policy even with a map: nothing of Amap's is allowed there.
      const page = await fetch(`${api.url}/`);
      const policy = page.headers.get('content-security-policy') ?? '';
      assert.doesNotMatch(policy, /amap|autonavi|unsafe/);
      assert.match(policy, /frame-src 'self'/);
      assert.match(policy, /frame-ancestors 'none'/);
      assert.doesNotMatch(await page.text(), new RegExp(CODE));
      // The map page is the one place Amap's script runs: its own looser policy, and only our own pages may frame it.
      const frame = await fetch(`${api.url}/map-frame.html`);
      const mapPolicy = frame.headers.get('content-security-policy') ?? '';
      assert.match(mapPolicy, /script-src 'self' 'unsafe-eval' https:\/\/webapi\.amap\.com/);
      assert.match(mapPolicy, /connect-src 'self' https:\/\/\*\.amap\.com/);
      assert.match(mapPolicy, /frame-ancestors 'self'/);
      assert.doesNotMatch(await frame.text(), new RegExp(CODE));
    } finally {
      await api.close();
    }
  });

  test('without the security code the map has a key but search is off', async () => {
    const api = await startApi({ amap: { key: KEY, securityCode: '' } });
    try {
      assert.equal((await api.call('GET', '/config')).body.amap.searchReady, false);
      const refused = await fetch(`${api.url}/_AMapService/v3/place/text?key=${KEY}&keywords=x`);
      assert.equal(refused.status, 503);
      assert.match(((await refused.json()) as { message: string }).message, /security code/);
    } finally {
      await api.close();
    }
  });
});

describe('the map proxy', () => {
  test('adds the security code on the server, forwards the answer, and is not an open proxy', async () => {
    const seen: URL[] = [];
    const amapFetch = (async (input: URL | string) => {
      seen.push(new URL(String(input)));
      return new Response(JSON.stringify({ status: '1', pois: [{ name: '联洋花园' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const api = await startApi({ amap: { key: KEY, securityCode: CODE }, amapFetch });
    try {
      const ok = await fetch(`${api.url}/_AMapService/v3/place/text?key=${KEY}&keywords=${encodeURIComponent('联洋')}`);
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { status: '1', pois: [{ name: '联洋花园' }] });
      assert.equal(seen.length, 1);
      assert.equal(seen[0]!.origin, 'https://restapi.amap.com');
      assert.equal(seen[0]!.pathname, '/v3/place/text');
      assert.equal(seen[0]!.searchParams.get('jscode'), CODE);
      assert.equal(seen[0]!.searchParams.get('keywords'), '联洋');

      // The page can't choose another key, another host or another kind of path, and can't write.
      assert.equal((await fetch(`${api.url}/_AMapService/v3/place/text?key=someone-elses`)).status, 403);
      assert.equal((await fetch(`${api.url}/_AMapService/admin/anything?key=${KEY}`)).status, 403);
      assert.equal((await fetch(`${api.url}/_AMapService//evil.example/v3/x?key=${KEY}`)).status, 403);
      assert.equal((await fetch(`${api.url}/_AMapService/v3/place/text?key=${KEY}`, { method: 'POST' })).status, 405);
      assert.equal(seen.length, 1, 'refused calls never reach Amap');
    } finally {
      await api.close();
    }
  });

  test('says so when Amap does not answer, and slows down a flood', async () => {
    let fail = true;
    const amapFetch = (async () => {
      if (fail) throw new Error('down');
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const api = await startApi({ amap: { key: KEY, securityCode: CODE }, amapFetch });
    try {
      const url = `${api.url}/_AMapService/v3/place/text?key=${KEY}`;
      assert.equal((await fetch(url)).status, 502);
      fail = false;
      let limited = 0;
      for (let i = 0; i < 260; i += 1) if ((await fetch(url)).status === 429) limited += 1;
      assert.ok(limited > 0, 'more than 240 calls a minute are refused');
    } finally {
      await api.close();
    }
  });
});

describe('the community a project carries', () => {
  test('is saved with the project, shown to its owner only, and checked for contact details', async () => {
    const api = await startApi();
    try {
      const reg = async (role: string, phone: string) =>
        (await api.call('POST', '/auth/register', { body: { role, phone, password: 'correct horse battery', displayName: '测试', language: 'zh-CN', acceptTerms: true } })).body;
      const owner = await reg('homeowner', '13600000001');
      const team = await reg('contractor', '13600000002');
      const base = { title: '两居室翻新', city: '上海', district: '浦东新区', floorAreaM2: 89, renovationType: 'old-home', budgetMinCny: 100_000, budgetMaxCny: 150_000, desiredStart: dateInChina(30), description: '厨房和卫生间全部重做，客厅改成开放式。' };
      const made = await api.call('POST', '/projects', { token: owner.accessToken, body: { ...base, community: '联洋花园' } });
      assert.equal(made.status, 201, JSON.stringify(made.body));
      assert.equal(made.body.community, '联洋花园');
      assert.equal((await api.call('GET', `/projects/${made.body.id}`, { token: owner.accessToken })).body.community, '联洋花园');
      assert.equal((await api.call('POST', '/projects', { token: owner.accessToken, body: { ...base, community: '联洋花园 电话13800138000' } })).status, 400);
      // A team never gets the community in the brief it is invited with (D7): only the owner's own view has it.
      assert.equal((await api.call('GET', `/projects/${made.body.id}`, { token: team.accessToken })).status, 403);
    } finally {
      await api.close();
    }
  });
});
