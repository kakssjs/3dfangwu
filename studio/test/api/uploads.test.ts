// End to end: uploads checked by content and size, photo metadata removed (N18, N19).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { uploads } from '../../src/api/db/schema.ts';
import { jpegWithGps, pngWithSecretText } from './fixtures.ts';
import { startApi, type Api } from './helpers.ts';

let api: Api;
let nextPhone = 1;
const PASSWORD = 'correct horse battery';

before(async () => {
  api = await startApi();
});

after(async () => {
  await api.close();
});

async function register(role: 'homeowner' | 'contractor', displayName: string) {
  const phone = `1380013${String(nextPhone++).padStart(4, '0')}`;
  const { status, body } = await api.call('POST', '/auth/register', {
    body: { role, phone, password: PASSWORD, displayName, language: 'zh-CN', acceptTerms: true },
  });
  assert.equal(status, 201, JSON.stringify(body));
  return { token: body.accessToken as string, id: body.user.id as string };
}

function send(bytes: Buffer, contentType: string, filename = 'photo.jpg', extra: Record<string, unknown> = {}) {
  const { token, ...fields } = extra;
  return api.call('POST', '/uploads', {
    token: token as string | undefined,
    body: { filename, contentType, dataBase64: bytes.toString('base64'), ...fields },
  });
}

describe('storing a file', () => {
  test('a photo with location data comes back without it', async () => {
    const owner = await register('homeowner', 'Li');
    const photo = jpegWithGps(6);
    assert.ok(photo.includes(Buffer.from('FAKEGPS!')), 'the fixture really carries GPS data');
    const { status, body } = await send(photo, 'image/jpeg', 'floor plan.jpg', { token: owner.token });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.contentType, 'image/jpeg');
    assert.equal(body.filename, 'floor plan.jpg');
    assert.ok(body.sizeBytes < photo.length, 'the stored copy is smaller');

    const got = await api.call('GET', `/uploads/${body.id}`, { token: owner.token });
    assert.equal(got.status, 200);
    const returned = Buffer.from(got.body.dataBase64, 'base64');
    assert.ok(!returned.includes(Buffer.from('FAKEGPS!')), 'the GPS marker is gone');
    assert.equal(returned[0], 0xff);
    assert.equal(returned[1], 0xd8, 'still a JPEG');
    assert.equal(got.body.sizeBytes, returned.length);

    // what is on disk is what the owner gets back
    const [row] = await api.db.select().from(uploads).where(eq(uploads.id, body.id));
    const onDisk = await readFile(path.join(api.filesDir, row!.storagePath));
    assert.deepEqual(onDisk, returned);
  });

  test('a PNG keeps its picture and loses its text', async () => {
    const owner = await register('homeowner', 'Wang');
    const { status, body } = await send(pngWithSecretText(), 'image/png', 'plan.png', { token: owner.token });
    assert.equal(status, 201, JSON.stringify(body));
    const got = await api.call('GET', `/uploads/${body.id}`, { token: owner.token });
    const returned = Buffer.from(got.body.dataBase64, 'base64');
    assert.ok(!returned.includes(Buffer.from('FAKEGPS!')));
    assert.equal(returned.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'still a PNG');
  });

  test('a PDF is stored as it is, and comes back whole', async () => {
    const owner = await register('homeowner', 'Zhao');
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'latin1');
    const { status, body } = await send(pdf, 'application/pdf', 'quote.pdf', { token: owner.token });
    assert.equal(status, 201, JSON.stringify(body));
    const got = await api.call('GET', `/uploads/${body.id}`, { token: owner.token });
    assert.deepEqual(Buffer.from(got.body.dataBase64, 'base64'), pdf);
    assert.equal(got.body.contentType, 'application/pdf');
  });

  test('it can be sent for one of your projects', async () => {
    const owner = await register('homeowner', 'Sun');
    const created = await api.call('POST', '/projects', {
      token: owner.token,
      body: {
        title: '三室翻新',
        city: '上海',
        district: '浦东新区',
        floorAreaM2: 98,
        renovationType: 'old-home',
        budgetMinCny: 150_000,
        budgetMaxCny: 300_000,
        desiredStart: '2027-01-05',
        description: '全屋翻新，重点是水电和防水，客厅想做收纳。',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const { body } = await send(jpegWithGps(), 'image/jpeg', 'plan.jpg', { token: owner.token, projectId: created.body.id });
    assert.equal(body.projectId, created.body.id);

    const other = await register('homeowner', 'Liu');
    const refused = await send(jpegWithGps(), 'image/jpeg', 'plan.jpg', { token: other.token, projectId: created.body.id });
    assert.equal(refused.status, 404);
  });
});

describe('refusing what is wrong', () => {
  test('a file that is not what it claims is refused', async () => {
    const owner = await register('homeowner', 'Chen');
    assert.equal((await send(Buffer.from('hello, plain text'), 'image/jpeg', 'a.jpg', { token: owner.token })).status, 400);
    assert.equal((await send(jpegWithGps(), 'image/png', 'a.png', { token: owner.token })).status, 400);
    assert.equal((await send(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'application/pdf', 'a.pdf', { token: owner.token })).status, 400);
  });

  test('a file over 8 MB, or base64 that is not base64, is refused', async () => {
    const owner = await register('homeowner', 'Yang');
    const huge = 'A'.repeat(11_200_000); // decodes to ~8.4 MB
    assert.equal((await api.call('POST', '/uploads', { token: owner.token, body: { filename: 'big.jpg', contentType: 'image/jpeg', dataBase64: huge } })).status, 400);
    assert.equal((await api.call('POST', '/uploads', { token: owner.token, body: { filename: 'a.jpg', contentType: 'image/jpeg', dataBase64: 'not base64!!' } })).status, 400);
    assert.equal((await api.call('POST', '/uploads', { token: owner.token, body: { filename: 'a.jpg', contentType: 'image/jpeg', dataBase64: '' } })).status, 400);
  });

  test('a wrong content type, a folder in the filename or an unknown field is refused', async () => {
    const owner = await register('homeowner', 'Xu');
    const b64 = jpegWithGps().toString('base64');
    assert.equal((await api.call('POST', '/uploads', { token: owner.token, body: { filename: 'a.jpg', contentType: 'image/gif', dataBase64: b64 } })).status, 400);
    assert.equal((await api.call('POST', '/uploads', { token: owner.token, body: { filename: '../a.jpg', contentType: 'image/jpeg', dataBase64: b64 } })).status, 400);
    assert.equal((await api.call('POST', '/uploads', { token: owner.token, body: { filename: 'a.jpg', contentType: 'image/jpeg', dataBase64: b64, extra: 1 } })).status, 400);
    assert.equal((await api.call('POST', '/uploads', { body: { filename: 'a.jpg', contentType: 'image/jpeg', dataBase64: b64 } })).status, 401);
  });

  test("another account's upload is not yours to fetch", async () => {
    const owner = await register('homeowner', 'Ma');
    const other = await register('homeowner', 'Qian');
    const { body } = await send(jpegWithGps(), 'image/jpeg', 'a.jpg', { token: owner.token });
    assert.equal((await api.call('GET', `/uploads/${body.id}`, { token: other.token })).status, 404);
    assert.equal((await api.call('GET', `/uploads/${body.id}`)).status, 401);
  });
});
