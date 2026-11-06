// End to end: accounts, contractor verification, projects, bids, filters and the homeowner's pick.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { SITE_URL, dateInChina, startApi, type Api } from './helpers.ts';

let api: Api;
let nextPhone = 1;
const PASSWORD = 'correct horse battery';

before(async () => {
  api = await startApi();
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
  return { token: body.accessToken as string, id: body.user.id as string, phone };
}

function application(overrides: Record<string, unknown> = {}) {
  return {
    companyName: '浦东匠心装饰',
    kind: 'company',
    licenceNumber: '91310115MA1K4A2B3C',
    qualifications: [{ name: '建筑装修装饰工程专业承包二级', number: 'D231000000', validUntil: '2028-12-31' }],
    city: '上海',
    districts: ['浦东新区', '闵行区'],
    renovationTypes: ['old-home', 'partial'],
    yearsInBusiness: 10,
    teamSize: 25,
    maxConcurrentProjects: 6,
    description: '专注旧房翻新',
    pastProjects: [
      { title: '联洋小区三室翻新', district: '浦东新区', year: 2025, description: '全屋水电改造' },
      { title: '古美路两室改造', district: '闵行区', year: 2024 },
      { title: '世纪公园旁老公房', year: 2023 },
    ],
    ...overrides,
  };
}

async function verifiedContractor(name: string, overrides: Record<string, unknown> = {}) {
  const account = await register('contractor', name);
  const saved = await api.call('PUT', '/contractors/me', { token: account.token, body: application(overrides) });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const reviewed = await api.call('POST', `/admin/contractors/${account.id}/review`, {
    admin: api.adminKey,
    body: { decision: 'verified', note: '营业执照已在国家企业信用信息公示系统核对' },
  });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
  return account;
}

function requirements(overrides: Record<string, unknown> = {}) {
  return {
    title: '浦东三室旧房翻新',
    city: '上海',
    district: '浦东新区',
    floorAreaM2: 98.5,
    layout: '3室2厅1卫',
    renovationType: 'old-home',
    style: '现代简约',
    budgetMinCny: 150_000,
    budgetMaxCny: 200_000,
    desiredStart: dateInChina(30),
    biddingDays: 7,
    description: '全屋翻新：水电重做，厨卫翻新，客厅和卧室换木地板。',
    ...overrides,
  };
}

function bid(overrides: Record<string, unknown> = {}) {
  return {
    priceCny: 180_000,
    labourCny: 60_000,
    materialsCny: 100_000,
    managementFeeCny: 10_000,
    durationDays: 60,
    earliestStart: dateInChina(20),
    mainMaterials: '马可波罗瓷砖，大自然地板',
    message: '建议厨房改为开放式',
    ...overrides,
  };
}

describe('accounts', () => {
  test('registers homeowners and contractors, and signs them in', async () => {
    const phone = newPhone();
    const spaced = `+86 ${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    const created = await api.call('POST', '/auth/register', {
      body: { role: 'homeowner', phone: spaced, password: PASSWORD, displayName: ' 王女士 ', language: 'en', acceptTerms: true },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.user.phone, phone);
    assert.equal(created.body.user.displayName, '王女士');
    assert.equal(created.body.user.role, 'homeowner');
    assert.equal(typeof created.body.accessToken, 'string');
    assert.equal('passwordHash' in created.body.user, false);

    const again = await api.call('POST', '/auth/register', {
      body: { role: 'contractor', phone, password: PASSWORD, displayName: 'x', language: 'zh-CN', acceptTerms: true },
    });
    assert.equal(again.status, 409);

    const login = await api.call('POST', '/auth/login', { body: { phone, password: PASSWORD } });
    assert.equal(login.status, 200);
    const me = await api.call('GET', '/auth/me', { token: login.body.accessToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.language, 'en');

    const wrongPassword = await api.call('POST', '/auth/login', { body: { phone, password: 'wrong password' } });
    const unknownPhone = await api.call('POST', '/auth/login', { body: { phone: newPhone(), password: PASSWORD } });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownPhone.status, 401);
    assert.equal(wrongPassword.body.message, unknownPhone.body.message);

    assert.equal((await api.call('GET', '/auth/me')).status, 401);
    assert.equal((await api.call('GET', '/auth/me', { token: 'not-a-token' })).status, 401);
  });

  test('refuses registrations without consent, with a made-up role or with extra fields', async () => {
    const base = { role: 'homeowner', phone: newPhone(), password: PASSWORD, displayName: '李先生', language: 'zh-CN', acceptTerms: true };
    for (const body of [
      { ...base, acceptTerms: false },
      { ...base, acceptTerms: 'true' },
      { ...base, role: 'admin' },
      { ...base, isAdmin: true },
      { ...base, phone: '12345' },
      { ...base, password: 'short' },
    ]) {
      const { status } = await api.call('POST', '/auth/register', { body });
      assert.equal(status, 400, JSON.stringify(body));
    }
  });

  test('a contractor account shows where its application stands', async () => {
    const contractor = await register('contractor', '张师傅');
    assert.equal((await api.call('GET', '/auth/me', { token: contractor.token })).body.contractorStatus, 'no-profile');
    await api.call('PUT', '/contractors/me', { token: contractor.token, body: application() });
    assert.equal((await api.call('GET', '/auth/me', { token: contractor.token })).body.contractorStatus, 'pending');
  });
});

describe('contractor verification and profiles', () => {
  test('homeowners see a contractor only once you verify them, and never their contact', async () => {
    const homeowner = await register('homeowner', '陈女士');
    const contractor = await register('contractor', '刘经理');
    const saved = await api.call('PUT', '/contractors/me', {
      token: contractor.token,
      body: application({ licenceNumber: '91310115ma1k4a2b3d', companyName: '闵行安居装饰' }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.status, 'pending');
    assert.equal(saved.body.licenceNumber, '91310115MA1K4A2B3D');

    const board = await api.call('GET', '/projects/open', { token: contractor.token });
    assert.equal(board.status, 403);
    assert.match(board.body.message, /waiting for review/);
    assert.equal((await api.call('GET', `/contractors/${contractor.id}`, { token: homeowner.token })).status, 404);

    const queue = await api.call('GET', '/admin/contractors?status=pending', { admin: api.adminKey });
    const entry = queue.body.find((c: { id: string }) => c.id === contractor.id);
    assert.equal(entry.phone, contractor.phone);

    await api.call('POST', `/admin/contractors/${contractor.id}/review`, { admin: api.adminKey, body: { decision: 'verified' } });
    const profile = await api.call('GET', `/contractors/${contractor.id}`, { token: homeowner.token });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.verified, true);
    assert.equal(profile.body.qualifications[0].name, '建筑装修装饰工程专业承包二级');
    assert.equal(profile.body.pastProjects.length, 3);
    for (const hidden of ['phone', 'displayName', 'reviewNote', 'maxConcurrentProjects']) {
      assert.equal(hidden in profile.body, false, hidden);
    }
    assert.equal(JSON.stringify(profile.body).includes(contractor.phone), false);

    const inDistrict = await api.call('GET', `/contractors?city=${encodeURIComponent('上海')}&district=${encodeURIComponent('闵行区')}`, {
      token: homeowner.token,
    });
    assert.ok(inDistrict.body.some((c: { id: string }) => c.id === contractor.id));
    const elsewhere = await api.call('GET', `/contractors?district=${encodeURIComponent('静安区')}`, { token: homeowner.token });
    assert.equal(elsewhere.body.some((c: { id: string }) => c.id === contractor.id), false);
    assert.equal((await api.call('GET', '/contractors', { token: contractor.token })).status, 403);
  });

  test('refuses an application with a wrong licence number or a bad date', async () => {
    const contractor = await register('contractor', '赵老板');
    for (const overrides of [
      { licenceNumber: '12345' },
      { licenceNumber: '91310115MA1K4A2BIO' },
      { qualifications: [{ name: '二级', validUntil: '2028-02-30' }] },
      { districts: [] },
      { renovationTypes: ['castle'] },
      { pastProjects: [{ title: '项目', photos: 'x' }] },
    ]) {
      const { status } = await api.call('PUT', '/contractors/me', { token: contractor.token, body: application(overrides) });
      assert.equal(status, 400, JSON.stringify(overrides));
    }
  });

  test('changing a checked fact sends a verified contractor back to review; other changes don’t', async () => {
    const contractor = await verifiedContractor('周经理', { licenceNumber: '91310115MA1K4A2B3E' });
    const same = await api.call('PUT', '/contractors/me', {
      token: contractor.token,
      body: application({ licenceNumber: '91310115MA1K4A2B3E', description: '新的简介', teamSize: 30 }),
    });
    assert.equal(same.body.status, 'verified');

    const changed = await api.call('PUT', '/contractors/me', {
      token: contractor.token,
      body: application({ licenceNumber: '91310115MA1K4A2B3F' }),
    });
    assert.equal(changed.body.status, 'pending');
    assert.equal(changed.body.reviewNote, null);

    await api.call('POST', `/admin/contractors/${contractor.id}/review`, {
      admin: api.adminKey,
      body: { decision: 'rejected', note: '执照名称与公司名称不符' },
    });
    assert.equal((await api.call('GET', '/contractors/me', { token: contractor.token })).body.reviewNote, '执照名称与公司名称不符');
    const resent = await api.call('PUT', '/contractors/me', { token: contractor.token, body: application() });
    assert.equal(resent.body.status, 'pending');
  });
});

describe('projects, bids and the pick', () => {
  test('a homeowner posts, verified contractors in the area bid, and the homeowner filters and picks one', async () => {
    const homeowner = await register('homeowner', '孙女士');
    const near = await verifiedContractor('近邻装饰', { companyName: '近邻装饰', yearsInBusiness: 12 });
    const cheap = await verifiedContractor('实惠装饰', { companyName: '实惠装饰', yearsInBusiness: 3 });
    const farAway = await verifiedContractor('徐汇装饰', { companyName: '徐汇装饰', districts: ['徐汇区'] });

    const posted = await api.call('POST', '/projects', { token: homeowner.token, body: requirements() });
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    const projectId = posted.body.id as string;
    assert.equal(posted.body.link, `${SITE_URL}/projects/${projectId}`);
    assert.equal(posted.body.status, 'open');
    assert.equal(posted.body.bidCount, 0);

    const board = await api.call('GET', '/projects/open', { token: near.token });
    const seen = board.body.find((p: { id: string }) => p.id === projectId);
    assert.ok(seen, 'the contractor in that district sees the project');
    assert.equal(JSON.stringify(seen).includes(homeowner.phone), false);
    assert.equal('ownerId' in seen, false);
    assert.equal(seen.homeowner, null);
    const farBoard = await api.call('GET', '/projects/open', { token: farAway.token });
    assert.equal(farBoard.body.some((p: { id: string }) => p.id === projectId), false);
    assert.equal((await api.call('POST', `/projects/${projectId}/bids`, { token: farAway.token, body: bid() })).status, 404);
    assert.equal((await api.call('GET', `/projects/${projectId}`, { token: farAway.token })).status, 404);

    const first = await api.call('POST', `/projects/${projectId}/bids`, { token: near.token, body: bid() });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.link, `${SITE_URL}/projects/${projectId}/bids/${first.body.id}`);
    assert.equal(first.body.project.link, `${SITE_URL}/projects/${projectId}`);
    assert.equal((await api.call('POST', `/projects/${projectId}/bids`, { token: near.token, body: bid() })).status, 409);
    const second = await api.call('POST', `/projects/${projectId}/bids`, {
      token: cheap.token,
      body: bid({ priceCny: 150_000, labourCny: 50_000, materialsCny: 90_000, managementFeeCny: 5_000, durationDays: 75 }),
    });
    assert.equal(second.status, 201);

    // Sealed: a contractor sees only their own bid.
    assert.equal((await api.call('GET', `/bids/${second.body.id}`, { token: near.token })).status, 404);
    const changed = await api.call('PUT', `/bids/${first.body.id}`, { token: near.token, body: bid({ priceCny: 175_000 }) });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.priceCny, 175_000);

    const all = await api.call('GET', `/projects/${projectId}/bids`, { token: homeowner.token });
    assert.deepEqual(
      all.body.map((b: { contractor: { companyName: string } }) => b.contractor.companyName),
      ['近邻装饰', '实惠装饰'],
    );
    assert.ok(all.body.every((b: { contact: unknown }) => b.contact === null));
    assert.equal(all.body[0].contractor.yearsInBusiness, 12);

    const names = async (query: string) =>
      (await api.call('GET', `/projects/${projectId}/bids?${query}`, { token: homeowner.token })).body.map(
        (b: { contractor: { companyName: string } }) => b.contractor.companyName,
      );
    assert.deepEqual(await names('maxPriceCny=160000'), ['实惠装饰']);
    assert.deepEqual(await names('sort=price'), ['实惠装饰', '近邻装饰']);
    assert.deepEqual(await names('sort=price&order=desc'), ['近邻装饰', '实惠装饰']);
    assert.deepEqual(await names('maxDurationDays=70'), ['近邻装饰']);
    assert.deepEqual(await names('minYearsInBusiness=5'), ['近邻装饰']);
    assert.deepEqual(await names('sort=experience'), ['近邻装饰', '实惠装饰']);
    assert.deepEqual(await names(`startBy=${dateInChina(25)}`), ['近邻装饰', '实惠装饰']);
    assert.deepEqual(await names(`startBy=${dateInChina(10)}`), []);
    assert.equal((await api.call('GET', `/projects/${projectId}/bids?maxPriceCny=abc`, { token: homeowner.token })).status, 400);
    assert.equal((await api.call('GET', `/projects/${projectId}/bids?sort=score`, { token: homeowner.token })).status, 400);

    const stranger = await register('homeowner', '路人');
    assert.equal((await api.call('GET', `/projects/${projectId}`, { token: stranger.token })).status, 404);
    assert.equal((await api.call('GET', `/projects/${projectId}/bids`, { token: stranger.token })).status, 404);
    assert.equal(
      (await api.call('POST', `/projects/${projectId}/selection`, { token: stranger.token, body: { bidId: second.body.id } })).status,
      404,
    );

    const picked = await api.call('POST', `/projects/${projectId}/selection`, {
      token: homeowner.token,
      body: { bidId: second.body.id },
    });
    assert.equal(picked.status, 200, JSON.stringify(picked.body));
    assert.equal(picked.body.status, 'awarded');
    assert.equal(picked.body.selectedBid.id, second.body.id);
    assert.equal(picked.body.selectedBid.contact.phone, cheap.phone);
    assert.equal(picked.body.selectedBid.link, `${SITE_URL}/projects/${projectId}/bids/${second.body.id}`);

    const afterPick = await api.call('GET', `/projects/${projectId}/bids`, { token: homeowner.token });
    const byName = Object.fromEntries(afterPick.body.map((b: { contractor: { companyName: string } }) => [b.contractor.companyName, b]));
    assert.equal(byName['实惠装饰'].status, 'selected');
    assert.equal(byName['实惠装饰'].contact.phone, cheap.phone);
    assert.equal(byName['近邻装饰'].status, 'not-selected');
    assert.equal(byName['近邻装饰'].contact, null);

    const winnerBids = await api.call('GET', '/bids/mine', { token: cheap.token });
    assert.equal(winnerBids.body[0].homeowner.phone, homeowner.phone);
    assert.equal((await api.call('GET', `/projects/${projectId}`, { token: cheap.token })).body.homeowner.phone, homeowner.phone);
    const loserView = await api.call('GET', `/projects/${projectId}`, { token: near.token });
    assert.equal(loserView.status, 200);
    assert.equal(loserView.body.homeowner, null);
    assert.equal(loserView.body.myBid.status, 'not-selected');

    assert.equal((await api.call('PUT', `/bids/${first.body.id}`, { token: near.token, body: bid() })).status, 409);
    assert.equal(
      (await api.call('POST', `/projects/${projectId}/selection`, { token: homeowner.token, body: { bidId: first.body.id } })).status,
      409,
    );
    const late = await verifiedContractor('迟到装饰', { companyName: '迟到装饰' });
    assert.equal((await api.call('POST', `/projects/${projectId}/bids`, { token: late.token, body: bid() })).status, 404);
  });

  test('closing a project without a pick marks the waiting bids not selected', async () => {
    const homeowner = await register('homeowner', '吴先生');
    const contractor = await verifiedContractor('关门装饰', { companyName: '关门装饰' });
    const project = await api.call('POST', '/projects', { token: homeowner.token, body: requirements({ title: '卫生间局部改造', renovationType: 'partial' }) });
    const offer = await api.call('POST', `/projects/${project.body.id}/bids`, { token: contractor.token, body: bid() });
    assert.equal(offer.status, 201);
    const closed = await api.call('POST', `/projects/${project.body.id}/close`, { token: homeowner.token });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.status, 'closed');
    assert.ok(closed.body.closedAt);
    assert.equal((await api.call('GET', `/bids/${offer.body.id}`, { token: contractor.token })).body.status, 'not-selected');
    assert.equal((await api.call('POST', `/projects/${project.body.id}/close`, { token: homeowner.token })).status, 409);
  });

  test('refuses contact details, impossible budgets and dates, and the wrong kind of account', async () => {
    const homeowner = await register('homeowner', '郑女士');
    const contractor = await verifiedContractor('规则装饰', { companyName: '规则装饰' });
    for (const overrides of [
      { description: '请直接联系我 138 0013 9999，谢谢配合' },
      { description: '图纸发到 me@example.com 就行，谢谢' },
      { title: '加微信 13900139000' },
      { budgetMinCny: 300_000 },
      { desiredStart: dateInChina(-1) },
      { desiredStart: '2027-02-30' },
      { floorAreaM2: '98' },
      { biddingDays: 60 },
    ]) {
      const { status } = await api.call('POST', '/projects', { token: homeowner.token, body: requirements(overrides) });
      assert.equal(status, 400, JSON.stringify(overrides));
    }
    assert.equal((await api.call('POST', '/projects', { token: contractor.token, body: requirements() })).status, 403);

    const project = await api.call('POST', '/projects', { token: homeowner.token, body: requirements() });
    const path = `/projects/${project.body.id}/bids`;
    for (const overrides of [
      { labourCny: 150_000, materialsCny: 100_000 },
      { message: '有问题打我电话 13700137000' },
      { earliestStart: dateInChina(-3) },
      { priceCny: '180000' },
    ]) {
      const { status } = await api.call('POST', path, { token: contractor.token, body: bid(overrides) });
      assert.equal(status, 400, JSON.stringify(overrides));
    }
    assert.equal((await api.call('POST', path, { token: homeowner.token, body: bid() })).status, 403);
    assert.equal((await api.call('GET', '/projects/not-a-uuid', { token: homeowner.token })).status, 400);
  });
});

describe('your admin routes', () => {
  test('need the admin key; suspending a contractor hides their bids and stops them bidding', async () => {
    assert.equal((await api.call('GET', '/admin/contractors')).status, 401);
    assert.equal((await api.call('GET', '/admin/contractors', { admin: 'wrong-key-wrong-key-wrong-key' })).status, 401);

    const homeowner = await register('homeowner', '钱女士');
    const contractor = await verifiedContractor('停用装饰', { companyName: '停用装饰' });
    const project = await api.call('POST', '/projects', { token: homeowner.token, body: requirements() });
    const offer = await api.call('POST', `/projects/${project.body.id}/bids`, { token: contractor.token, body: bid() });
    assert.equal((await api.call('GET', `/projects/${project.body.id}`, { token: homeowner.token })).body.bidCount, 1);

    const suspended = await api.call('POST', `/admin/contractors/${contractor.id}/review`, {
      admin: api.adminKey,
      body: { decision: 'suspended', note: '投诉核实' },
    });
    assert.equal(suspended.body.status, 'suspended');
    assert.equal((await api.call('GET', `/projects/${project.body.id}/bids`, { token: homeowner.token })).body.length, 0);
    assert.equal((await api.call('GET', `/projects/${project.body.id}`, { token: homeowner.token })).body.bidCount, 0);
    assert.equal(
      (await api.call('POST', `/projects/${project.body.id}/selection`, { token: homeowner.token, body: { bidId: offer.body.id } })).status,
      409,
    );
    assert.match((await api.call('GET', '/projects/open', { token: contractor.token })).body.message, /suspended/);
    const resaved = await api.call('PUT', '/contractors/me', { token: contractor.token, body: application({ licenceNumber: '91310115MA1K4A2B3G' }) });
    assert.equal(resaved.body.status, 'suspended');
  });
});

describe('without an admin key, with rate limits on', () => {
  let limited: Api;

  before(async () => {
    limited = await startApi({ rateLimits: true, adminKey: '' });
  });

  after(async () => {
    await limited.close();
  });

  test('admin routes are off', async () => {
    assert.equal((await limited.call('GET', '/admin/contractors', { admin: 'anything-anything-anything' })).status, 403);
  });

  test('allows 10 sign-in attempts a minute from one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await limited.call('POST', '/auth/login', { body: { phone: '13800000000', password: 'guess' } })).status);
    }
    assert.deepEqual(statuses, [...Array(10).fill(401), 429]);
  });
});
