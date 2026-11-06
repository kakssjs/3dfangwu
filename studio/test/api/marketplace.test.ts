// End to end: accounts, contractor verification, matching, invitations, sealed quotes and the homeowner's pick.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { invitations } from '../../src/api/db/schema.ts';
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
    styles: ['modern-minimalist', 'cream'],
    priceMinCnyPerM2: 1_500,
    priceMaxCnyPerM2: 2_500,
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
    style: 'modern-minimalist',
    budgetMinCny: 150_000,
    budgetMaxCny: 200_000,
    desiredStart: dateInChina(30),
    description: '全屋翻新：水电重做，厨卫翻新，客厅和卧室换木地板。',
    ...overrides,
  };
}

/** Matching looks at teams by city, so each test works in a city of its own and sees only its own teams. */
/** Two real districts of each city the tests use: a team works in both, or just the second. */
const DISTRICTS: Record<string, [string, string]> = {
  上海: ['浦东新区', '闵行区'],
  苏州: ['姑苏区', '吴中区'],
  无锡: ['梁溪区', '滨湖区'],
  杭州: ['西湖区', '拱墅区'],
  长沙: ['岳麓区', '芙蓉区'],
  南京: ['玄武区', '秦淮区'],
  成都: ['锦江区', '青羊区'],
  武汉: ['武昌区', '江岸区'],
  宁波: ['海曙区', '江北区'],
};
const districtA = (city: string) => DISTRICTS[city]![0];
const districtB = (city: string) => DISTRICTS[city]![1];

/** A verified team in `city`, working in both of its districts. */
function team(city: string, name: string, overrides: Record<string, unknown> = {}) {
  return verifiedContractor(name, { companyName: name, city, districts: DISTRICTS[city], ...overrides });
}

/** `count` past projects listed in `district`. */
function pastIn(district: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({ title: `${district}项目${i + 1}`, district, year: 2025 }));
}

/** A homeowner's requirements for a home in `city`, in its first district. */
function projectIn(city: string, overrides: Record<string, unknown> = {}) {
  return requirements({ city, district: districtA(city), ...overrides });
}

function quote(overrides: Record<string, unknown> = {}) {
  return {
    priceCny: 180_000,
    labourCny: 60_000,
    materialsCny: 100_000,
    managementFeeCny: 10_000,
    durationDays: 60,
    earliestStart: dateInChina(20),
    mainMaterials: '马可波罗瓷砖，大自然地板',
    note: '建议厨房改为开放式',
    ...overrides,
  };
}

/** The company names in a list of matches or invitations, in order. */
const names = (list: { contractor: { companyName: string } }[]) => list.map((entry) => entry.contractor.companyName);

interface Reason {
  factor: string;
  result: string;
  note: string;
}

/** A match's reasons, by factor. */
const reasonsOf = (match: { reasons: Reason[] }): Partial<Record<string, Reason>> =>
  Object.fromEntries(match.reasons.map((r) => [r.factor, r]));

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

    // Until you verify the application, the team can't answer invitations.
    const early = await api.call('PUT', `/invitations/${randomUUID()}/quote`, { token: contractor.token, body: quote() });
    assert.equal(early.status, 403);
    assert.match(early.body.message, /waiting for review/);
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
    assert.deepEqual(profile.body.styles, ['modern-minimalist', 'cream']);
    assert.equal(profile.body.priceMinCnyPerM2, 1_500);
    assert.equal(profile.body.priceMaxCnyPerM2, 2_500);
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

  test('refuses an application with a wrong licence number, a bad date, an unknown style or a price range that does not add up', async () => {
    const contractor = await register('contractor', '赵老板');
    for (const overrides of [
      { licenceNumber: '12345' },
      { licenceNumber: '91310115MA1K4A2BIO' },
      { qualifications: [{ name: '二级', validUntil: '2028-02-30' }] },
      { districts: [] },
      { renovationTypes: ['castle'] },
      { pastProjects: [{ title: '项目', photos: 'x' }] },
      { styles: ['castle'] },
      { styles: ['cream', 'cream'] },
      { priceMaxCnyPerM2: undefined },
      { priceMinCnyPerM2: 3_000 },
      { priceMinCnyPerM2: 50 },
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

describe('matching, invitations and the pick', () => {
  test('a homeowner is matched to suitable teams, invites some, compares their sealed quotes and picks one', async () => {
    const city = '苏州';
    const homeowner = await register('homeowner', '孙女士');
    const best = await team(city, '近邻装饰', { yearsInBusiness: 12, pastProjects: pastIn(districtA(city), 3) });
    const dear = await team(city, '高端装饰', { priceMinCnyPerM2: 5_000, priceMaxCnyPerM2: 8_000 });
    const quiet = await team(city, '低调装饰', { styles: [], priceMinCnyPerM2: undefined, priceMaxCnyPerM2: undefined, yearsInBusiness: 3 });
    // These can't be matched to the project: another district, another kind of work, another city,
    // not yet verified, suspended.
    const otherDistrict = await team(city, '开发区装饰', { districts: [districtB(city)] });
    const otherWork = await team(city, '新房装饰', { renovationTypes: ['new-home'] });
    const otherCity = await team('无锡', '外地装饰');
    const waiting = await register('contractor', '待审装饰');
    await api.call('PUT', '/contractors/me', { token: waiting.token, body: application({ city, districts: [districtA(city)] }) });
    const stopped = await team(city, '停用装饰');
    await api.call('POST', `/admin/contractors/${stopped.id}/review`, { admin: api.adminKey, body: { decision: 'suspended' } });

    const posted = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city) });
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    const projectId = posted.body.id as string;
    assert.equal(posted.body.link, `${SITE_URL}/projects/${projectId}`);
    assert.equal(posted.body.status, 'open');
    assert.equal(posted.body.liveInvitations, 0);
    assert.equal(posted.body.quoteCount, 0);

    // The matches: best fit first, with the reasons, and nothing private.
    const matched = await api.call('GET', `/projects/${projectId}/matches`, { token: homeowner.token });
    assert.equal(matched.status, 200, JSON.stringify(matched.body));
    assert.deepEqual(names(matched.body), ['近邻装饰', '高端装饰', '低调装饰']);
    assert.deepEqual(
      matched.body.map((m: { fit: string }) => m.fit),
      ['strong', 'possible', 'possible'],
    );
    assert.equal(reasonsOf(matched.body[0]).budget?.result, 'good');
    assert.equal(reasonsOf(matched.body[0]).style?.result, 'good');
    assert.equal(reasonsOf(matched.body[1]).budget?.result, 'none');
    assert.match(reasonsOf(matched.body[1]).budget?.note ?? '', /well below/);
    assert.equal(reasonsOf(matched.body[2]).budget?.result, 'unknown');
    assert.equal(reasonsOf(matched.body[2]).style?.result, 'unknown');
    assert.equal('score' in matched.body[0], false);
    assert.equal('phone' in matched.body[0].contractor, false);
    const exposed = JSON.stringify(matched.body);
    for (const account of [best, dear, quiet]) assert.equal(exposed.includes(account.phone), false);
    assert.equal((await api.call('GET', `/projects/${projectId}/matches?limit=2`, { token: homeowner.token })).body.length, 2);
    for (const query of ['limit=0', 'limit=11', 'limit=abc', 'sort=price']) {
      assert.equal((await api.call('GET', `/projects/${projectId}/matches?${query}`, { token: homeowner.token })).status, 400, query);
    }

    // Only matched teams can be invited.
    const invite = (token: string, contractorId: string, message?: string) =>
      api.call('POST', `/projects/${projectId}/invitations`, {
        token,
        body: message === undefined ? { contractorId } : { contractorId, message },
      });
    for (const unsuitable of [otherDistrict.id, otherWork.id, otherCity.id, waiting.id, stopped.id, randomUUID()]) {
      assert.equal((await invite(homeowner.token, unsuitable)).status, 404, unsuitable);
    }
    const first = await invite(homeowner.token, best.id, '希望周末能来量房');
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.link, `${SITE_URL}/invitations/${first.body.id}`);
    assert.equal(first.body.projectId, projectId);
    assert.equal(first.body.status, 'invited');
    assert.equal(first.body.quote, null);
    assert.equal(first.body.contact, null);
    assert.equal(first.body.contractor.companyName, '近邻装饰');
    assert.ok(new Date(first.body.expiresAt).getTime() > Date.now() + 6 * 86_400_000, 'a team has about 7 days to answer');
    assert.equal((await invite(homeowner.token, best.id)).status, 409);
    const second = await invite(homeowner.token, quiet.id);
    assert.equal(second.status, 201);
    assert.deepEqual(
      names((await api.call('GET', `/projects/${projectId}/matches`, { token: homeowner.token })).body),
      ['高端装饰'],
      'a team already invited is not suggested again',
    );

    // A team sees its invitation with a brief of the project, never the homeowner's contact, and never another team's invitation.
    const mine = await api.call('GET', '/invitations/mine', { token: best.token });
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].id, first.body.id);
    assert.equal(mine.body[0].message, '希望周末能来量房');
    assert.equal(mine.body[0].project.title, '浦东三室旧房翻新');
    assert.equal(mine.body[0].project.budgetMaxCny, 200_000);
    assert.equal(mine.body[0].homeowner, null);
    assert.equal('id' in mine.body[0].project, false);
    assert.equal('link' in mine.body[0].project, false);
    assert.equal(JSON.stringify(mine.body).includes(homeowner.phone), false);
    assert.equal((await api.call('GET', `/invitations/${second.body.id}`, { token: best.token })).status, 404);
    assert.equal((await api.call('GET', `/invitations/${first.body.id}`, { token: dear.token })).status, 404);
    assert.equal((await api.call('GET', `/invitations/${first.body.id}`, { token: homeowner.token })).status, 200);
    assert.equal((await api.call('GET', `/projects/${projectId}`, { token: best.token })).status, 403, 'teams see a brief, not the project');

    // One sealed quote each, which the team can revise until the pick.
    const quoted = await api.call('PUT', `/invitations/${first.body.id}/quote`, { token: best.token, body: quote() });
    assert.equal(quoted.status, 200, JSON.stringify(quoted.body));
    assert.equal(quoted.body.status, 'quoted');
    assert.equal(quoted.body.quote.priceCny, 180_000);
    assert.ok(quoted.body.respondedAt);
    const revised = await api.call('PUT', `/invitations/${first.body.id}/quote`, { token: best.token, body: quote({ priceCny: 175_000 }) });
    assert.equal(revised.status, 200);
    assert.equal(revised.body.quote.priceCny, 175_000);
    assert.equal(revised.body.respondedAt, quoted.body.respondedAt);
    const cheap = await api.call('PUT', `/invitations/${second.body.id}/quote`, {
      token: quiet.token,
      body: quote({ priceCny: 148_000, labourCny: 50_000, materialsCny: 90_000, managementFeeCny: 5_000, durationDays: 75 }),
    });
    assert.equal(cheap.status, 200, JSON.stringify(cheap.body));

    // The homeowner sees the quotes in the order the invitations went out, whatever the prices.
    const listed = await api.call('GET', `/projects/${projectId}/invitations`, { token: homeowner.token });
    assert.deepEqual(names(listed.body), ['近邻装饰', '低调装饰']);
    assert.deepEqual(
      listed.body.map((i: { quote: { priceCny: number } }) => i.quote.priceCny),
      [175_000, 148_000],
    );
    assert.ok(listed.body.every((i: { contact: unknown }) => i.contact === null));
    assert.deepEqual(names((await api.call('GET', `/projects/${projectId}/invitations?sort=price`, { token: homeowner.token })).body), [
      '近邻装饰',
      '低调装饰',
    ]);
    const overview = await api.call('GET', `/projects/${projectId}`, { token: homeowner.token });
    assert.equal(overview.body.liveInvitations, 2);
    assert.equal(overview.body.quoteCount, 2);
    assert.equal(overview.body.selected, null);

    // Nobody else gets in.
    const stranger = await register('homeowner', '路人');
    for (const path of [`/projects/${projectId}`, `/projects/${projectId}/matches`, `/projects/${projectId}/invitations`, `/invitations/${first.body.id}`]) {
      assert.equal((await api.call('GET', path, { token: stranger.token })).status, 404, path);
    }
    assert.equal((await invite(stranger.token, dear.id)).status, 404);
    assert.equal(
      (await api.call('POST', `/projects/${projectId}/selection`, { token: stranger.token, body: { invitationId: second.body.id } })).status,
      404,
    );

    // Only a quote can be picked.
    const third = await invite(homeowner.token, dear.id);
    assert.equal(third.status, 201);
    const early = await api.call('POST', `/projects/${projectId}/selection`, { token: homeowner.token, body: { invitationId: third.body.id } });
    assert.equal(early.status, 409);
    assert.match(early.body.message, /Only a quote can be picked/);
    assert.equal((await api.call('GET', `/projects/${projectId}`, { token: homeowner.token })).body.status, 'open');

    // The pick: the project is awarded, the others are not selected, and only now do the two see each other's contact (D7).
    const picked = await api.call('POST', `/projects/${projectId}/selection`, { token: homeowner.token, body: { invitationId: second.body.id } });
    assert.equal(picked.status, 200, JSON.stringify(picked.body));
    assert.equal(picked.body.status, 'awarded');
    assert.equal(picked.body.selected.invitationId, second.body.id);
    assert.equal(picked.body.selected.companyName, '低调装饰');
    assert.equal(picked.body.selected.contact.phone, quiet.phone);
    assert.equal(picked.body.selected.link, `${SITE_URL}/invitations/${second.body.id}`);
    assert.equal(picked.body.liveInvitations, 0);
    assert.equal(picked.body.quoteCount, 2);

    const after = await api.call('GET', `/projects/${projectId}/invitations`, { token: homeowner.token });
    const byName = Object.fromEntries(after.body.map((i: { contractor: { companyName: string } }) => [i.contractor.companyName, i]));
    assert.equal(byName['低调装饰'].status, 'selected');
    assert.equal(byName['低调装饰'].contact.phone, quiet.phone);
    assert.equal(byName['近邻装饰'].status, 'not-selected');
    assert.equal(byName['近邻装饰'].contact, null);
    assert.equal(byName['高端装饰'].status, 'not-selected');

    const winner = await api.call('GET', '/invitations/mine', { token: quiet.token });
    assert.equal(winner.body[0].status, 'selected');
    assert.equal(winner.body[0].homeowner.phone, homeowner.phone);
    const loser = await api.call('GET', `/invitations/${first.body.id}`, { token: best.token });
    assert.equal(loser.status, 200);
    assert.equal(loser.body.status, 'not-selected');
    assert.equal(loser.body.homeowner, null);
    const seenByLoser = JSON.stringify(loser.body);
    for (const secret of [quiet.phone, homeowner.phone, '低调装饰', '148000']) {
      assert.equal(seenByLoser.includes(secret), false, `a team that was not picked is told nothing about the winner: ${secret}`);
    }

    // After the pick nothing changes.
    assert.equal((await api.call('PUT', `/invitations/${first.body.id}/quote`, { token: best.token, body: quote() })).status, 409);
    assert.equal(
      (await api.call('POST', `/projects/${projectId}/selection`, { token: homeowner.token, body: { invitationId: first.body.id } })).status,
      409,
    );
    const late = await team(city, '迟到装饰');
    assert.equal((await invite(homeowner.token, late.id)).status, 409);
    assert.equal((await api.call('GET', `/projects/${projectId}/matches`, { token: homeowner.token })).status, 409);
  });

  test('at most 3 invitations are open at once; a decline or a lapse frees a place; a team is invited once', async () => {
    const city = '杭州';
    const homeowner = await register('homeowner', '林先生');
    const a = await team(city, '甲装饰');
    const b = await team(city, '乙装饰');
    const c = await team(city, '丙装饰');
    const d = await team(city, '丁装饰');
    const e = await team(city, '戊装饰');
    const project = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city) });
    const projectId = project.body.id as string;
    const invite = (contractorId: string) =>
      api.call('POST', `/projects/${projectId}/invitations`, { token: homeowner.token, body: { contractorId } });
    const live = async () => (await api.call('GET', `/projects/${projectId}`, { token: homeowner.token })).body.liveInvitations;

    const ia = await invite(a.id);
    const ib = await invite(b.id);
    const ic = await invite(c.id);
    for (const sent of [ia, ib, ic]) assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const full = await invite(d.id);
    assert.equal(full.status, 409);
    assert.match(full.body.message, /3 invitations open/);
    assert.equal(await live(), 3);

    // A decline frees a place, and the reason reaches the homeowner.
    const declined = await api.call('POST', `/invitations/${ia.body.id}/decline`, { token: a.token, body: { reason: '这个月排期已满' } });
    assert.equal(declined.status, 200, JSON.stringify(declined.body));
    assert.equal(declined.body.status, 'declined');
    const seen = await api.call('GET', `/invitations/${ia.body.id}`, { token: homeowner.token });
    assert.equal(seen.body.status, 'declined');
    assert.equal(seen.body.declineReason, '这个月排期已满');
    assert.equal(await live(), 2);
    assert.equal((await api.call('POST', `/invitations/${ia.body.id}/decline`, { token: a.token, body: {} })).status, 409);
    assert.equal((await api.call('PUT', `/invitations/${ia.body.id}/quote`, { token: a.token, body: quote() })).status, 409);
    assert.equal((await invite(a.id)).status, 409, 'a team that declined is not invited again');
    assert.equal((await invite(d.id)).status, 201);
    assert.equal((await invite(e.id)).status, 409);

    // A team that has quoted can no longer decline: the homeowner decides.
    assert.equal((await api.call('PUT', `/invitations/${ic.body.id}/quote`, { token: c.token, body: quote() })).status, 200);
    const tooLate = await api.call('POST', `/invitations/${ic.body.id}/decline`, { token: c.token, body: {} });
    assert.equal(tooLate.status, 409);
    assert.match(tooLate.body.message, /already sent a quote/);

    // An invitation nobody answers lapses after 7 days: it reads as expired, can't be answered, and frees its place.
    await api.db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(invitations.id, ib.body.id));
    const lapsed = await api.call('GET', `/invitations/${ib.body.id}`, { token: b.token });
    assert.equal(lapsed.body.status, 'expired');
    assert.equal((await api.call('GET', `/invitations/${ib.body.id}`, { token: homeowner.token })).body.status, 'expired');
    const answer = await api.call('PUT', `/invitations/${ib.body.id}/quote`, { token: b.token, body: quote() });
    assert.equal(answer.status, 409);
    assert.match(answer.body.message, /expired/);
    assert.equal((await api.call('POST', `/invitations/${ib.body.id}/decline`, { token: b.token, body: {} })).status, 409);
    assert.equal(await live(), 2);
    assert.equal((await invite(e.id)).status, 201);
    assert.equal(await live(), 3);
  });

  test('invitations sent at the same moment still respect the limit of 3', async () => {
    const city = '长沙';
    const homeowner = await register('homeowner', '何先生');
    const teams = [];
    for (const name of ['一号装饰', '二号装饰', '三号装饰', '四号装饰', '五号装饰']) teams.push(await team(city, name));
    const project = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city) });
    const sent = await Promise.all(
      teams.map((t) => api.call('POST', `/projects/${project.body.id}/invitations`, { token: homeowner.token, body: { contractorId: t.id } })),
    );
    assert.deepEqual(sent.map((r) => r.status).sort(), [201, 201, 201, 409, 409]);
  });

  test('a team is not invited beyond the projects it can take at once', async () => {
    const city = '南京';
    const busy = await team(city, '忙碌装饰', { maxConcurrentProjects: 1 });
    const one = await register('homeowner', '周先生');
    const two = await register('homeowner', '吴女士');
    const p1 = await api.call('POST', '/projects', { token: one.token, body: projectIn(city) });
    const p2 = await api.call('POST', '/projects', { token: two.token, body: projectIn(city) });
    const inviteToSecond = () =>
      api.call('POST', `/projects/${p2.body.id}/invitations`, { token: two.token, body: { contractorId: busy.id } });

    const held = await api.call('POST', `/projects/${p1.body.id}/invitations`, { token: one.token, body: { contractorId: busy.id } });
    assert.equal(held.status, 201);
    assert.deepEqual((await api.call('GET', `/projects/${p2.body.id}/matches`, { token: two.token })).body, []);
    const refused = await inviteToSecond();
    assert.equal(refused.status, 409);
    assert.match(refused.body.message, /as it can take/);

    // A quote still holds the place until the homeowner decides.
    assert.equal((await api.call('PUT', `/invitations/${held.body.id}/quote`, { token: busy.token, body: quote() })).status, 200);
    assert.equal((await inviteToSecond()).status, 409);

    // Ending the first search frees it.
    assert.equal((await api.call('POST', `/projects/${p1.body.id}/close`, { token: one.token })).status, 200);
    assert.deepEqual(names((await api.call('GET', `/projects/${p2.body.id}/matches`, { token: two.token })).body), ['忙碌装饰']);
    assert.equal((await inviteToSecond()).status, 201);
  });

  test('ending the search without a pick marks the open invitations not selected', async () => {
    const city = '成都';
    const homeowner = await register('homeowner', '吴先生');
    const waiting = await team(city, '等候装饰');
    const quoting = await team(city, '报价装饰');
    const declining = await team(city, '婉拒装饰');
    const project = await api.call('POST', '/projects', {
      token: homeowner.token,
      body: projectIn(city, { title: '卫生间局部改造', renovationType: 'partial' }),
    });
    const projectId = project.body.id as string;
    const invite = (contractorId: string) =>
      api.call('POST', `/projects/${projectId}/invitations`, { token: homeowner.token, body: { contractorId } });
    const w = await invite(waiting.id);
    const q = await invite(quoting.id);
    const x = await invite(declining.id);
    for (const sent of [w, q, x]) assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.equal((await api.call('PUT', `/invitations/${q.body.id}/quote`, { token: quoting.token, body: quote() })).status, 200);
    assert.equal((await api.call('POST', `/invitations/${x.body.id}/decline`, { token: declining.token, body: {} })).status, 200);

    const closed = await api.call('POST', `/projects/${projectId}/close`, { token: homeowner.token });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.status, 'closed');
    assert.ok(closed.body.closedAt);
    assert.equal(closed.body.liveInvitations, 0);
    const statusOf = async (token: string, id: string) => (await api.call('GET', `/invitations/${id}`, { token })).body.status;
    assert.equal(await statusOf(waiting.token, w.body.id), 'not-selected');
    assert.equal(await statusOf(quoting.token, q.body.id), 'not-selected');
    assert.equal(await statusOf(declining.token, x.body.id), 'declined');

    assert.equal((await api.call('PUT', `/invitations/${q.body.id}/quote`, { token: quoting.token, body: quote() })).status, 409);
    assert.equal((await api.call('POST', `/invitations/${w.body.id}/decline`, { token: waiting.token, body: {} })).status, 409);
    assert.equal((await invite(waiting.id)).status, 409);
    assert.equal((await api.call('GET', `/projects/${projectId}/matches`, { token: homeowner.token })).status, 409);
    assert.equal(
      (await api.call('POST', `/projects/${projectId}/selection`, { token: homeowner.token, body: { invitationId: q.body.id } })).status,
      409,
    );
    assert.equal((await api.call('POST', `/projects/${projectId}/close`, { token: homeowner.token })).status, 409);
  });

  test('refuses contact details, impossible budgets and dates, and the wrong kind of account', async () => {
    const city = '武汉';
    const homeowner = await register('homeowner', '郑女士');
    const contractor = await team(city, '规则装饰');
    for (const overrides of [
      { description: '请直接联系我 138 0013 9999，谢谢配合' },
      { description: '图纸发到 me@example.com 就行，谢谢' },
      { title: '加微信 13900139000' },
      { budgetMinCny: 300_000 },
      { desiredStart: dateInChina(-1) },
      { desiredStart: '2027-02-30' },
      { floorAreaM2: '98' },
      { style: '现代简约' },
      { biddingDays: 7 },
    ]) {
      const { status } = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city, overrides) });
      assert.equal(status, 400, JSON.stringify(overrides));
    }
    assert.equal((await api.call('POST', '/projects', { token: contractor.token, body: projectIn(city) })).status, 403);

    const project = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city) });
    const projectId = project.body.id as string;
    for (const body of [
      { contractorId: contractor.id, message: '加我 13700137000 细聊' },
      { contractorId: 'not-a-uuid' },
      { contractorId: contractor.id, price: 1 },
    ]) {
      const { status } = await api.call('POST', `/projects/${projectId}/invitations`, { token: homeowner.token, body });
      assert.equal(status, 400, JSON.stringify(body));
    }
    const invited = await api.call('POST', `/projects/${projectId}/invitations`, { token: homeowner.token, body: { contractorId: contractor.id } });
    assert.equal(invited.status, 201);

    const quotePath = `/invitations/${invited.body.id}/quote`;
    for (const overrides of [
      { labourCny: 150_000, materialsCny: 100_000 },
      { note: '有问题打我电话 13700137000' },
      { mainMaterials: '详情发 me@example.com' },
      { earliestStart: dateInChina(-3) },
      { priceCny: '180000' },
      { priceCny: 500 },
      { durationDays: 0 },
      { message: '不是报价的字段' },
    ]) {
      const { status } = await api.call('PUT', quotePath, { token: contractor.token, body: quote(overrides) });
      assert.equal(status, 400, JSON.stringify(overrides));
    }
    const declineRefused = await api.call('POST', `/invitations/${invited.body.id}/decline`, {
      token: contractor.token,
      body: { reason: '微信 13600136000' },
    });
    assert.equal(declineRefused.status, 400);

    assert.equal((await api.call('PUT', quotePath, { token: homeowner.token, body: quote() })).status, 403);
    assert.equal((await api.call('GET', `/projects/${projectId}/matches`, { token: contractor.token })).status, 403);
    assert.equal((await api.call('GET', '/projects/open', { token: contractor.token })).status, 403, 'there is no board of open projects');
    assert.equal((await api.call('GET', '/projects/not-a-uuid', { token: homeowner.token })).status, 400);
    assert.equal((await api.call('POST', `/projects/${projectId}/bids`, { token: contractor.token, body: {} })).status, 404, 'open bidding is gone');
    assert.equal((await api.call('GET', '/bids/mine', { token: contractor.token })).status, 404, 'open bidding is gone');
  });
});

describe('your admin routes', () => {
  test('need the admin key; suspending a team hides its invitations and stops it answering', async () => {
    assert.equal((await api.call('GET', '/admin/contractors')).status, 401);
    assert.equal((await api.call('GET', '/admin/contractors', { admin: 'wrong-key-wrong-key-wrong-key' })).status, 401);

    const city = '宁波';
    const homeowner = await register('homeowner', '钱女士');
    const contractor = await team(city, '停用装饰');
    const project = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city) });
    const projectId = project.body.id as string;
    const invited = await api.call('POST', `/projects/${projectId}/invitations`, { token: homeowner.token, body: { contractorId: contractor.id } });
    assert.equal(invited.status, 201);
    assert.equal((await api.call('PUT', `/invitations/${invited.body.id}/quote`, { token: contractor.token, body: quote() })).status, 200);
    const before = (await api.call('GET', `/projects/${projectId}`, { token: homeowner.token })).body;
    assert.equal(before.quoteCount, 1);
    assert.equal(before.liveInvitations, 1);

    const suspended = await api.call('POST', `/admin/contractors/${contractor.id}/review`, {
      admin: api.adminKey,
      body: { decision: 'suspended', note: '投诉核实' },
    });
    assert.equal(suspended.body.status, 'suspended');
    assert.equal((await api.call('GET', `/projects/${projectId}/invitations`, { token: homeowner.token })).body.length, 0);
    assert.equal((await api.call('GET', `/invitations/${invited.body.id}`, { token: homeowner.token })).status, 404);
    const after = (await api.call('GET', `/projects/${projectId}`, { token: homeowner.token })).body;
    assert.equal(after.quoteCount, 0);
    assert.equal(after.liveInvitations, 0, 'a suspended team does not hold one of the 3 places');
    assert.equal(
      (await api.call('POST', `/projects/${projectId}/selection`, { token: homeowner.token, body: { invitationId: invited.body.id } })).status,
      409,
    );

    const another = await api.call('POST', '/projects', { token: homeowner.token, body: projectIn(city) });
    assert.deepEqual((await api.call('GET', `/projects/${another.body.id}/matches`, { token: homeowner.token })).body, []);
    assert.equal(
      (await api.call('POST', `/projects/${another.body.id}/invitations`, { token: homeowner.token, body: { contractorId: contractor.id } })).status,
      404,
    );

    const answer = await api.call('PUT', `/invitations/${invited.body.id}/quote`, { token: contractor.token, body: quote() });
    assert.equal(answer.status, 403);
    assert.match(answer.body.message, /suspended/);
    assert.equal((await api.call('GET', '/invitations/mine', { token: contractor.token })).body.length, 1, 'the team can still read its history');
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
