// Runs the Homebox connector against a real Homebox: `npm run homebox -- start`, then `npm run test:live`.
// It creates its own test household and deletes it at the end. Skipped when Homebox isn't set up or running.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { buildHomeRecord } from '../../src/home-record.ts';
import type { FloorplanInput, HomeRecord } from '../../src/home-record.ts';
import { entityUpdateFrom, HomeboxClient, inviteCustomer, syncHomeToHomebox } from '../../src/homebox.ts';

const studioDir = path.resolve(import.meta.dirname, '../..');
const envFile = path.join(studioDir, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const baseUrl = (process.env.HOMEBOX_URL || 'http://127.0.0.1:7745').replace(/\/+$/, '');
const apiKey = process.env.HOMEBOX_API_KEY;

async function reachable(): Promise<boolean> {
  try {
    return (await new HomeboxClient({ baseUrl, timeoutMs: 3_000 }).status()).health === true;
  } catch {
    return false;
  }
}

const skip = !apiKey
  ? 'no HOMEBOX_API_KEY in .env.local: run `npm run homebox -- setup`'
  : !(await reachable())
    ? `Homebox is not running at ${baseUrl}: run \`npm run homebox -- start\``
    : false;

describe('Homebox connector against a running Homebox', { skip }, () => {
  const client = new HomeboxClient({ baseUrl, token: apiKey });
  const sample = JSON.parse(
    readFileSync(path.join(studioDir, 'samples/floorplan-3d-sample.json'), 'utf8'),
  ) as FloorplanInput;
  const prices = { 'sofa-1': 4999, 'bed-1': 3999 };
  let home: HomeRecord = buildHomeRecord(sample, { id: `live-test-${Date.now()}`, name: '联调测试（可删除）', prices });

  after(async () => {
    const groupId = home.links.homebox?.groupId;
    if (groupId) await client.deleteGroup(groupId);
  });

  test('the first sync creates a household with 13 rooms and 43 pieces of furniture', async () => {
    const r = await syncHomeToHomebox(home, client);
    assert.equal(r.created, 13 + 43);
    assert.deepEqual([r.updated, r.unchanged, r.recreated], [0, 0, 0]);
    assert.equal(r.appliancesSkipped, 3);
    assert.equal((await client.getGroup(r.groupId)).currency, 'CNY');

    const links = home.links.homebox!;
    const sofa = await client.getEntity(r.groupId, links.items['sofa-1']!.entityId);
    assert.equal(sofa?.name, '三人沙发');
    assert.equal(sofa?.parent?.id, links.locations['living']!.entityId);
    assert.equal(sofa?.purchasePrice, 4999);
    const bayWindow = await client.getEntity(r.groupId, links.locations['bay1']!.entityId);
    assert.equal(bayWindow?.entityType?.isLocation, true);
    assert.match(bayWindow?.description ?? '', /不计入面积/);
  });

  test('a second sync changes nothing', async () => {
    const r = await syncHomeToHomebox(home, client);
    assert.deepEqual([r.created, r.updated, r.recreated, r.unchanged], [0, 0, 0, 13 + 43]);
  });

  test("the customer's rename and notes survive a design change", async () => {
    const links = home.links.homebox!;
    const sofaId = links.items['sofa-1']!.entityId;
    const sofa = (await client.getEntity(links.groupId, sofaId))!;
    const rename = entityUpdateFrom(sofa, { name: '客厅大沙发', description: sofa.description, parentId: sofa.parent?.id })!;
    await client.updateEntity(links.groupId, { ...rename, notes: '客户备注：靠窗' });

    home = buildHomeRecord(sample, { id: home.id, name: home.name, prices: { ...prices, 'sofa-1': 5999 }, previous: home });
    const r = await syncHomeToHomebox(home, client);
    assert.deepEqual([r.created, r.updated, r.recreated], [0, 1, 0]);

    const now = (await client.getEntity(links.groupId, sofaId))!;
    assert.equal(now.purchasePrice, 5999);
    assert.equal(now.name, '客厅大沙发');
    assert.equal(now.notes, '客户备注：靠窗');
  });

  test('furniture deleted in Homebox is created again', async () => {
    const links = home.links.homebox!;
    const oldId = links.items['plant-1']!.entityId;
    await client.deleteEntity(links.groupId, oldId);
    const r = await syncHomeToHomebox(home, client);
    assert.deepEqual([r.created, r.recreated], [0, 1]);
    assert.notEqual(home.links.homebox!.items['plant-1']!.entityId, oldId);
  });

  test('the customer invitation is a sign-up link to this Homebox', async () => {
    const { url, expiresAt } = await inviteCustomer(home, client, { days: 1 });
    const prefix = `${baseUrl}/?token=`;
    assert.ok(url.startsWith(prefix), 'link points at this Homebox');
    assert.ok(url.length > prefix.length + 10, 'link carries a token');
    assert.ok(Date.parse(expiresAt) > Date.now(), 'link has not expired');
  });
});
