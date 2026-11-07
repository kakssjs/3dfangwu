// End to end: homes, their plans in the F2 format, the private 3D link, design versions (F6) and
// reading a floor-plan photo into a plan (N4), with a stubbed model.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { MimoMessage, MimoResponse, MimoTransport } from '../../src/api/agents/mimo.ts';
import { MimoClient } from '../../src/api/agents/mimo.ts';
import { SITE_URL, startApi, type Api } from './helpers.ts';
import { jpegWithGps } from './fixtures.ts';

let api: Api;
let nextPhone = 1;
const PASSWORD = 'correct horse battery';

/** What the model saw on the last reading, for the checks below. */
let seenMessages: MimoMessage[] = [];
/** What the model answers, one reply per call. */
let replies: string[] = [];

const scriptedMimo: MimoTransport = async (messages) => {
  seenMessages = messages;
  const content = replies.shift() ?? '';
  const response: MimoResponse = { content, toolCalls: [], usage: { inputTokens: 10, outputTokens: 5, images: 1 } };
  return response;
};

before(async () => {
  api = await startApi({ mimo: scriptedMimo });
});

after(async () => {
  await api.close();
});

function newPhone(): string {
  return `1380013${String(nextPhone++).padStart(4, '0')}`;
}

async function register(role: 'homeowner' | 'contractor', displayName: string) {
  const phone = newPhone();
  const { status, body } = await api.call('POST', '/auth/register', {
    body: { role, phone, password: PASSWORD, displayName, language: 'zh-CN', acceptTerms: true },
  });
  assert.equal(status, 201, JSON.stringify(body));
  return { token: body.accessToken as string, id: body.user.id as string };
}

/** A small valid plan: one room in a 4m × 3m box. */
function planDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'studio.plan/1',
    units: 'mm',
    name: '测试户型',
    nameEn: 'Test Flat',
    walls: [[0, 0, 4000, 0, 'e'], [4000, 0, 4000, 3000, 'e'], [0, 3000, 4000, 3000, 'e'], [0, 0, 0, 3000, 'e']],
    windows: [[1000, 0, 2000, 0]],
    doors: [{ name: '入户门', rect: [0, 1000, 0, 2000], h: [0, 2000], c: [1, 0], o: [0, 1], len: 900, entry: true }],
    slidingDoors: [],
    rooms: [{ id: 'living', name: '客厅', nameEn: 'Living Room', poly: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], mat: 'tile800' }],
    ...overrides,
  };
}

function designState() {
  return {
    furniture: [{ id: 'f1', type: 'sofa', name: '三人沙发', cx: 2000, cy: 1500, w: 2400, d: 900, rot: 0 }],
    rooms: { living: { name: '客厅', nameEn: 'Living Room', mat: 'wood' } },
    demolished: [],
    measures: [{ a: { x: 0, y: 0 }, b: { x: 4000, y: 0 } }],
  };
}

async function uploadImage(token: string): Promise<string> {
  const { status, body } = await api.call('POST', '/uploads', {
    token,
    body: { filename: 'plan.jpg', contentType: 'image/jpeg', dataBase64: jpegWithGps().toString('base64') },
  });
  assert.equal(status, 201, JSON.stringify(body));
  return body.id as string;
}

describe('homes and the plan format', () => {
  test('a homeowner saves a home and gets its private 3D link', async () => {
    const owner = await register('homeowner', '张先生');
    const { status, body } = await api.call('POST', '/homes', { token: owner.token, body: { name: '阳光花园 3-2-1801', plan: planDoc() } });
    assert.equal(status, 201, JSON.stringify(body));
    assert.match(body.link, new RegExp(`^${SITE_URL}/plan3d/[A-Za-z0-9_-]{16,}$`));

    const mine = await api.call('GET', '/homes/mine', { token: owner.token });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].id, body.id);

    const one = await api.call('GET', `/homes/${body.id}`, { token: owner.token });
    assert.equal(one.status, 200);
    assert.deepEqual(one.body.plan.rooms, planDoc().rooms);
    assert.deepEqual(one.body.designs, []);
  });

  test('a plan that fails the F2 checks is refused, and the message lists why', async () => {
    const owner = await register('homeowner', '张女士');
    const broken = planDoc({ schema: 'other/1', walls: [[0, 0, 1, 1, 'x']] });
    const { status, body } = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: broken } });
    assert.equal(status, 400);
    assert.match(body.message, /studio\.plan\/1/);
    assert.match(body.message, /unknown type "x"/);

    const typo = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: planDoc({ colour: 'red' }) } });
    assert.equal(typo.status, 400);
    assert.match(typo.body.message, /unknown field "colour"/);
  });

  test('only a signed-in homeowner saves homes; another account gets 404, not the record', async () => {
    const owner = await register('homeowner', '李先生');
    const created = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: planDoc() } });
    const stranger = await register('homeowner', '陌生人');
    const contractor = await register('contractor', '施工队');

    const anonymous = await api.call('POST', '/homes', { body: { name: '家', plan: planDoc() } });
    assert.equal(anonymous.status, 401);
    const byContractor = await api.call('POST', '/homes', { token: contractor.token, body: { name: '家', plan: planDoc() } });
    assert.equal(byContractor.status, 403);
    const theirs = await api.call('GET', `/homes/${created.body.id}`, { token: stranger.token });
    assert.equal(theirs.status, 404);
    const mine = await api.call('GET', '/homes/mine', { token: contractor.token });
    assert.equal(mine.status, 403);
  });

  test('the 3D link opens the plan with no account, and a new link closes the old one', async () => {
    const owner = await register('homeowner', '王女士');
    const created = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: planDoc() } });
    const token = created.body.link.split('/plan3d/')[1];

    const byLink = await api.call('GET', `/plan-links/${token}`);
    assert.equal(byLink.status, 200);
    assert.equal(byLink.body.homeId, created.body.id);
    assert.deepEqual(byLink.body.plan.walls, planDoc().walls);
    assert.deepEqual(byLink.body.designs, []);

    const wrong = await api.call('GET', '/plan-links/no-such-token-000000');
    assert.equal(wrong.status, 404);

    const rotated = await api.call('POST', `/homes/${created.body.id}/link`, { token: owner.token });
    assert.equal(rotated.status, 201, 'a new link is created');
    assert.notEqual(rotated.body.link, created.body.link);
    const old = await api.call('GET', `/plan-links/${token}`);
    assert.equal(old.status, 404, 'the old link stops working');
  });
});

describe('design versions (F6)', () => {
  test('edits save as numbered versions, from the link and from the account', async () => {
    const owner = await register('homeowner', '陈先生');
    const created = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: planDoc() } });
    const token = created.body.link.split('/plan3d/')[1];

    const first = await api.call('POST', `/plan-links/${token}/designs`, { body: { data: designState(), note: '第一版' } });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.number, 1);
    assert.equal(first.body.note, '第一版');

    const second = await api.call('POST', `/homes/${created.body.id}/designs`, { token: owner.token, body: { data: designState() } });
    assert.equal(second.body.number, 2);

    const byLink = await api.call('GET', `/plan-links/${token}`);
    assert.deepEqual(byLink.body.designs.map((d: { number: number }) => d.number), [1, 2]);
    assert.deepEqual(byLink.body.designs[0].data.rooms, designState().rooms);

    const confirmed = await api.call('POST', `/homes/${created.body.id}/designs/2/confirm`, { token: owner.token });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.confirmedDesign, 2);
    const missing = await api.call('POST', `/homes/${created.body.id}/designs/9/confirm`, { token: owner.token });
    assert.equal(missing.status, 404);
  });

  test('a design state that fails its checks is refused', async () => {
    const owner = await register('homeowner', '陈女士');
    const created = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: planDoc() } });
    const token = created.body.link.split('/plan3d/')[1];
    const { status, body } = await api.call('POST', `/plan-links/${token}/designs`, {
      body: { data: { furniture: [], rooms: { living: { name: '客厅' } }, demolished: [], measures: [] } },
    });
    assert.equal(status, 400);
    assert.match(body.message, /\.mat/);
  });
});

describe('a floor-plan photo becomes a home (N4)', () => {
  test('the photo reaches the model as an image, and the reading passes the checks on the way in', async () => {
    const owner = await register('homeowner', '赵先生');
    const uploadId = await uploadImage(owner.token);
    replies = ['Here you go:\n```json\n' + JSON.stringify(planDoc()) + '\n```'];
    seenMessages = [];

    const { status, body } = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.name, '测试户型');
    assert.deepEqual(body.plan.rooms, planDoc().rooms);
    assert.match(body.overlay, new RegExp(`^${SITE_URL}/api/homes/[\\w-]+/plan-overlay\\.svg$`));
    // The photo went along as an image part, and the reading came back through the checks.
    const withImage = seenMessages.find((m) => m.images?.length);
    assert.ok(withImage, 'the model was shown the photo');
    assert.match(withImage!.images![0]!, /^data:image\/jpeg;base64,/);
  });

  test('malformed JSON is retried, while an explicit unreadable-image answer is not', async () => {
    const owner = await register('homeowner', '格式回归');
    const uploadId = await uploadImage(owner.token);
    replies = ['{\"schema\":', JSON.stringify(planDoc())];
    const corrected = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(corrected.status, 201, JSON.stringify(corrected.body));
    assert.equal(replies.length, 0);
    assert.ok(seenMessages.some((m) => m.role === 'user' && m.content.includes('not readable JSON')));
    replies = ['broken', 'still broken'];
    const rejected = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.message, /not readable JSON/);
    replies = ['{\"error\":\"not a floor plan\"}', JSON.stringify(planDoc())];
    const notPlan = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(notPlan.status, 400);
    assert.equal(replies.length, 1);
    replies = [];
  });

  test('the model names an unreadable image, and a reading that fails twice is refused with the reasons', async () => {
    const owner = await register('homeowner', '赵女士');
    const uploadId = await uploadImage(owner.token);

    replies = ['{"error": "this is a photo of a cat, not a floor plan"}'];
    const cat = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(cat.status, 400);
    assert.match(cat.body.message, /cat/);

    replies = [JSON.stringify(planDoc({ rooms: [] })), JSON.stringify(planDoc({ rooms: [] }))];
    const twice = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(twice.status, 400);
    assert.match(twice.body.message, /at least one room/);

    // One bad reading is retried with the failures attached; the retry's fix is accepted.
    replies = [JSON.stringify(planDoc({ rooms: [] })), JSON.stringify(planDoc())];
    const fixed = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });
    assert.equal(fixed.status, 201, JSON.stringify(fixed.body));
    const retryTurn = seenMessages.find((m) => m.role === 'user' && /These checks failed/.test(m.content));
    assert.ok(retryTurn, 'the model was told which checks failed');
    assert.match(retryTurn!.content, /at least one room/);
  });

  test('a file that is not an image, or not the caller\'s, never reaches the model', async () => {
    const owner = await register('homeowner', '孙先生');
    const stranger = await register('homeowner', '孙女士');
    const { body: upload } = await api.call('POST', '/uploads', {
      token: owner.token,
      body: {
        filename: 'quote.pdf',
        contentType: 'application/pdf',
        dataBase64: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n').toString('base64'),
      },
    });
    assert.equal(upload.id !== undefined, true, JSON.stringify(upload));

    const notImage = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId: upload.id } });
    assert.equal(notImage.status, 400);
    assert.match(notImage.body.message, /not an image/);

    const photoId = await uploadImage(owner.token);
    const notTheirs = await api.call('POST', '/homes/from-image', { token: stranger.token, body: { uploadId: photoId } });
    assert.equal(notTheirs.status, 404);
  });

  test('MiMo down: the Doubao (豆包) backup reads the plan; both down: 503 naming both', async () => {
    const doubao: MimoClient = new MimoClient(async (messages) => {
      seenMessages = messages;
      return { content: JSON.stringify(planDoc()), toolCalls: [], usage: { inputTokens: 3, outputTokens: 4, images: 1 } };
    });
    const backupApi = await startApi({ mimo: async () => { throw new Error('MiMo is down'); }, backups: [doubao] });
    try {
      const { body: signed } = await backupApi.call('POST', '/auth/register', {
        body: { role: 'homeowner', phone: newPhone(), password: PASSWORD, displayName: '周先生', language: 'zh-CN', acceptTerms: true },
      });
      const { body: upload } = await backupApi.call('POST', '/uploads', {
        token: signed.accessToken,
        body: { filename: 'plan.jpg', contentType: 'image/jpeg', dataBase64: jpegWithGps().toString('base64') },
      });
      const read = await backupApi.call('POST', '/homes/from-image', { token: signed.accessToken, body: { uploadId: upload.id } });
      assert.equal(read.status, 201, JSON.stringify(read.body));
      assert.equal(read.body.name, '测试户型', 'the backup read it');
    } finally {
      await backupApi.close();
    }

    const bothDown = await startApi({ mimo: async () => { throw new Error('MiMo is down'); }, backups: [new MimoClient(async () => { throw new Error('Doubao is down too'); })] });
    try {
      const { body: signed } = await bothDown.call('POST', '/auth/register', {
        body: { role: 'homeowner', phone: newPhone(), password: PASSWORD, displayName: '周先生', language: 'zh-CN', acceptTerms: true },
      });
      const { body: upload } = await bothDown.call('POST', '/uploads', {
        token: signed.accessToken,
        body: { filename: 'plan.jpg', contentType: 'image/jpeg', dataBase64: jpegWithGps().toString('base64') },
      });
      const failed = await bothDown.call('POST', '/homes/from-image', { token: signed.accessToken, body: { uploadId: upload.id } });
      assert.equal(failed.status, 503);
      assert.match(failed.body.message, /MiMo/);
      assert.match(failed.body.message, /Doubao/);
    } finally {
      await bothDown.close();
    }
  });

  test('the overlay is one SVG: the photo under the reading', async () => {
    const owner = await register('homeowner', '吴先生');
    const uploadId = await uploadImage(owner.token);
    replies = [JSON.stringify(planDoc())];
    const created = await api.call('POST', '/homes/from-image', { token: owner.token, body: { uploadId } });

    const response = await fetch(`${api.url}/api/homes/${created.body.id}/plan-overlay.svg`, {
      headers: { authorization: `Bearer ${owner.token}` },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /image\/svg\+xml/);
    const svg = await response.text();
    assert.match(svg, /^<svg /);
    assert.match(svg, /<image href="data:image\/jpeg;base64,/);
    assert.match(svg, /客厅/);
    assert.match(svg, /stroke="#1f2937"/, 'walls are drawn');
  });
});

describe('the editor page behind the 3D link', () => {
  test('/plan3d serves floorplan-3d with its own content policy', async () => {
    const owner = await register('homeowner', '钱先生');
    const created = await api.call('POST', '/homes', { token: owner.token, body: { name: '家', plan: planDoc() } });
    const token = created.body.link.split('/plan3d/')[1];

    const page = await fetch(`${api.url}/plan3d/${token}`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<svg id="plan"|id="plan"/, 'the editor is served');
    assert.match(html, /three/, 'and its 3D engine');
    const policy = page.headers.get('content-security-policy') ?? '';
    assert.match(policy, /script-src 'self' 'unsafe-inline'/);

    const sample = await fetch(`${api.url}/plan3d`);
    assert.equal(sample.status, 200);
  });
});
