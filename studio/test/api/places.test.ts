// End to end: real places only (the regions list), and finding a district from a position.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { GeoUnavailable, type GeoLookup } from '../../src/api/geo/geo.ts';
import { dateInChina, startApi, type Api } from './helpers.ts';

let api: Api;
let calls: [number, number][] = [];
let answer: string[] | Error = [];
const lookup: GeoLookup = async (lat, lng) => {
  calls.push([lat, lng]);
  if (answer instanceof Error) throw answer;
  return answer;
};

const PASSWORD = 'correct horse battery';
let phone = 13700000000;
async function register(role: 'homeowner' | 'contractor') {
  const { status, body } = await api.call('POST', '/auth/register', {
    body: { role, phone: String(++phone), password: PASSWORD, displayName: '测试', language: 'zh-CN', acceptTerms: true },
  });
  assert.equal(status, 201, JSON.stringify(body));
  return body.accessToken as string;
}

before(async () => {
  api = await startApi({ geo: lookup });
});
after(async () => {
  await api.close();
});

const project = (overrides: Record<string, unknown> = {}) => ({
  title: '三居室翻新',
  city: '上海',
  district: '浦东新区',
  floorAreaM2: 110,
  renovationType: 'old-home',
  budgetMinCny: 150_000,
  budgetMaxCny: 220_000,
  desiredStart: dateInChina(30),
  description: '厨房卫生间重做，墙面刷新。',
  ...overrides,
});

describe('real places', () => {
  test('the list is the real provinces, cities and districts, open to everyone', async () => {
    const { status, body } = await api.call('GET', '/regions');
    assert.equal(status, 200);
    assert.equal(body.provinces.length, 34);
    const all = body.provinces.flatMap((p: { cities: { name: string; districts: string[] }[] }) => p.cities);
    assert.ok(all.length > 380, `${all.length} cities`);
    const city = (name: string) => all.find((c: { name: string }) => c.name === name);
    assert.ok(city('上海').districts.includes('浦东新区'));
    assert.ok(city('苏州').districts.includes('姑苏区'));
    assert.ok(city('重庆').districts.includes('渝中区'));
    assert.ok(city('深圳').districts.includes('南山区'));
    assert.ok(!all.some((c: { districts: string[] }) => c.districts.includes('市辖区')), 'no placeholder districts');
    assert.ok(all.every((c: { districts: string[] }) => c.districts.length > 0), 'every city has somewhere to work');
  });

  test('a project must be in a real district, and the city is written the usual way', async () => {
    const token = await register('homeowner');
    for (const bad of [{ district: '中心区' }, { city: '不存在市' }, { city: '苏州', district: '浦东新区' }]) {
      const refused = await api.call('POST', '/projects', { token, body: project(bad) });
      assert.equal(refused.status, 400, JSON.stringify(bad));
      assert.match(refused.body.message, /GET \/api\/regions/);
    }
    const made = await api.call('POST', '/projects', { token, body: project({ city: '上海市' }) });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal(made.body.city, '上海');
  });

  test('a contractor can only say it works in real districts of its city', async () => {
    const token = await register('contractor');
    const application = (districts: string[], city = '苏州') => ({
      companyName: '真实装饰', kind: 'company', licenceNumber: '91320508MA1MABCD12', qualifications: [{ name: '装修装饰工程专业承包二级' }],
      city, districts, renovationTypes: ['old-home'], yearsInBusiness: 5, teamSize: 10, maxConcurrentProjects: 3,
      pastProjects: [{ title: '甲' }, { title: '乙' }, { title: '丙' }],
    });
    assert.equal((await api.call('PUT', '/contractors/me', { token, body: application(['姑苏区', '中心区']) })).status, 400);
    assert.equal((await api.call('PUT', '/contractors/me', { token, body: application(['浦东新区']) })).status, 400);
    const saved = await api.call('PUT', '/contractors/me', { token, body: application(['姑苏区', '吴中区'], '苏州市') });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.city, '苏州');
  });
});

describe('use my location', () => {
  test('turns a position into a real city and district, whichever way the map data names them', async () => {
    const token = await register('homeowner');
    answer = ['均乐社区', '南京东路街道', '上海市', '黄浦区', '上海市', '中国'];
    const shanghai = await api.call('POST', '/geo/locate', { token, body: { lat: 31.2304, lng: 121.4737 } });
    assert.equal(shanghai.status, 200, JSON.stringify(shanghai.body));
    assert.deepEqual(shanghai.body, { province: '上海市', city: '上海', district: '黄浦区', matched: true });

    // In Suzhou the map data puts the district where the city should be, and the city only in the long name.
    answer = ['沧浪亭社区', '双塔街道', '姑苏区', '苏州市', '江苏省', '中国', '姑苏区'];
    const suzhou = await api.call('POST', '/geo/locate', { token, body: { lat: 31.2989, lng: 120.6216 } });
    assert.deepEqual(suzhou.body, { province: '江苏省', city: '苏州', district: '姑苏区', matched: true });

    answer = ['Somewhere', '中国'];
    const unknown = await api.call('POST', '/geo/locate', { token, body: { lat: 35.1, lng: 105.1 } });
    assert.deepEqual(unknown.body, { province: null, city: null, district: null, matched: false });
  });

  test('the answer is kept for a minute’s walk, never echoes the position, and a fix can be used to save a project', async () => {
    const token = await register('homeowner');
    calls = [];
    answer = ['浦东新区', '上海市', '中国'];
    const first = await api.call('POST', '/geo/locate', { token, body: { lat: 31.20001, lng: 121.50001 } });
    const near = await api.call('POST', '/geo/locate', { token, body: { lat: 31.20002, lng: 121.50003 } });
    assert.equal(calls.length, 1, 'two fixes in the same 100 m square cost one lookup');
    assert.deepEqual(first.body, near.body);
    assert.doesNotMatch(JSON.stringify(first.body), /31\.2|121\.5/);
    const made = await api.call('POST', '/projects', { token, body: project({ city: first.body.city, district: first.body.district }) });
    assert.equal(made.status, 201);
  });

  test('refuses positions outside China, signed-out visitors and bad input; says so when the service is down', async () => {
    const token = await register('homeowner');
    assert.equal((await api.call('POST', '/geo/locate', { body: { lat: 31, lng: 121 } })).status, 401);
    assert.equal((await api.call('POST', '/geo/locate', { token, body: { lat: 48.85, lng: 2.35 } })).status, 400);
    assert.equal((await api.call('POST', '/geo/locate', { token, body: { lat: 'x', lng: 121 } })).status, 400);
    assert.equal((await api.call('GET', '/geo/locate?lat=31&lng=121', { token })).status, 404, 'coordinates are never read from an address');
    answer = new GeoUnavailable('down');
    const down = await api.call('POST', '/geo/locate', { token, body: { lat: 30.5, lng: 114.3 } });
    assert.equal(down.status, 503);
    assert.match(down.body.message, /by hand/);
  });
});
