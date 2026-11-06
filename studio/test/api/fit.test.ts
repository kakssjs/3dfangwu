// The matching rules on their own, with no database and no server (src/api/matching/fit.ts).

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fitFor, hasRoom, isEligible, shortlist, type ProjectFacts, type TeamFacts } from '../../src/api/matching/fit.ts';

// A budget of ¥1,500–¥2,000 per m².
const PROJECT: ProjectFacts = {
  id: '11111111-1111-4111-8111-111111111111',
  city: '上海',
  district: '浦东新区',
  renovationType: 'old-home',
  floorAreaM2: 100,
  budgetMinCny: 150_000,
  budgetMaxCny: 200_000,
  style: 'cream',
};

const LOCAL_WORK = ['a', 'b', 'c'].map((title) => ({ title, district: '浦东新区' }));

/** A team that suits PROJECT in every way. */
function team(overrides: Partial<TeamFacts> = {}): TeamFacts {
  return {
    userId: 'team-a',
    status: 'verified',
    city: '上海',
    districts: ['浦东新区', '闵行区'],
    renovationTypes: ['old-home', 'partial'],
    styles: ['cream', 'nordic'],
    priceMinCnyPerM2: 1_500,
    priceMaxCnyPerM2: 2_500,
    yearsInBusiness: 10,
    teamSize: 20,
    maxConcurrentProjects: 5,
    pastProjects: LOCAL_WORK,
    ...overrides,
  };
}

const reason = (fit: ReturnType<typeof fitFor>, factor: string) => fit.reasons.find((r) => r.factor === factor);

describe('who can be matched', () => {
  test('only verified teams in the project’s city and district, on its kind of renovation', () => {
    assert.equal(isEligible(team(), PROJECT), true);
    for (const status of ['pending', 'rejected', 'suspended'] as const) {
      assert.equal(isEligible(team({ status }), PROJECT), false, status);
    }
    assert.equal(isEligible(team({ city: '杭州' }), PROJECT), false);
    assert.equal(isEligible(team({ districts: ['闵行区'] }), PROJECT), false);
    assert.equal(isEligible(team({ renovationTypes: ['new-home'] }), PROJECT), false);
  });

  test('a team has room while its open invitations are fewer than the projects it can take at once', () => {
    assert.equal(hasRoom({ maxConcurrentProjects: 2 }, 0), true);
    assert.equal(hasRoom({ maxConcurrentProjects: 2 }, 1), true);
    assert.equal(hasRoom({ maxConcurrentProjects: 2 }, 2), false);
  });
});

describe('how well a team fits', () => {
  test('a team that matches on price, style, experience and local work is a strong fit', () => {
    const fit = fitFor(PROJECT, team());
    assert.equal(fit.score, 100);
    assert.equal(fit.tier, 'strong');
    assert.deepEqual(
      fit.reasons.map((r) => [r.factor, r.result]),
      [
        ['budget', 'good'],
        ['style', 'good'],
        ['experience', 'good'],
        ['local', 'good'],
      ],
    );
    assert.match(reason(fit, 'budget')!.note, /¥1,500–¥2,000 per m².*¥1,500–¥2,500/);
  });

  test('a budget that only partly overlaps the team’s usual price scores half, and one just outside a quarter', () => {
    const partly = fitFor(PROJECT, team({ priceMinCnyPerM2: 1_800, priceMaxCnyPerM2: 2_600 }));
    assert.equal(reason(partly, 'budget')!.result, 'partial');
    assert.match(reason(partly, 'budget')!.note, /only partly overlaps/);
    assert.equal(partly.score, 83);
    assert.equal(partly.tier, 'strong');

    const near = fitFor(PROJECT, team({ priceMinCnyPerM2: 2_100, priceMaxCnyPerM2: 3_000 }));
    assert.equal(reason(near, 'budget')!.result, 'partial');
    assert.match(reason(near, 'budget')!.note, /just below/);
    assert.equal(near.score, 74);
    assert.equal(near.tier, 'good');
  });

  test('a budget far from the team’s usual price counts against it, on either side', () => {
    const pricier = fitFor(PROJECT, team({ priceMinCnyPerM2: 3_000, priceMaxCnyPerM2: 4_000 }));
    assert.equal(reason(pricier, 'budget')!.result, 'none');
    assert.match(reason(pricier, 'budget')!.note, /well below/);
    assert.equal(pricier.score, 65);
    assert.equal(pricier.tier, 'good');

    const cheaper = fitFor(PROJECT, team({ priceMinCnyPerM2: 800, priceMaxCnyPerM2: 1_200 }));
    assert.equal(reason(cheaper, 'budget')!.result, 'none');
    assert.match(reason(cheaper, 'budget')!.note, /well above/);
  });

  test('what a team has not stated is left out instead of counted against it', () => {
    const fit = fitFor(
      PROJECT,
      team({ priceMinCnyPerM2: null, priceMaxCnyPerM2: null, styles: [], yearsInBusiness: 5, pastProjects: [] }),
    );
    assert.equal(reason(fit, 'budget')!.result, 'unknown');
    assert.equal(reason(fit, 'style')!.result, 'unknown');
    assert.equal(reason(fit, 'local')!.result, 'none');
    assert.equal(fit.score, 25);
    assert.equal(fit.tier, 'possible');
  });

  test('a style the team does not list counts against it', () => {
    const fit = fitFor(PROJECT, team({ styles: ['industrial'] }));
    assert.equal(reason(fit, 'style')!.result, 'none');
    assert.match(reason(fit, 'style')!.note, /industrial/);
    assert.equal(fit.score, 75);
  });

  test('a project without a style, and a partial renovation, skip that factor', () => {
    assert.equal(reason(fitFor({ ...PROJECT, style: '' }, team({ styles: [] })), 'style'), undefined);
    const partial = fitFor({ ...PROJECT, renovationType: 'partial' }, team({ priceMinCnyPerM2: null, priceMaxCnyPerM2: null }));
    assert.equal(reason(partial, 'budget'), undefined);
  });

  test('experience and local work count in steps', () => {
    const experience = (yearsInBusiness: number) => reason(fitFor(PROJECT, team({ yearsInBusiness })), 'experience')!.result;
    assert.deepEqual([experience(1), experience(2), experience(5)], ['none', 'partial', 'good']);

    const local = (count: number) => fitFor(PROJECT, team({ pastProjects: LOCAL_WORK.slice(0, count) }));
    assert.deepEqual([0, 1, 2].map((count) => reason(local(count), 'local')!.result), ['none', 'partial', 'good']);
    assert.match(reason(local(1), 'local')!.note, /1 listed past project in 浦东新区/);
    assert.match(reason(local(2), 'local')!.note, /2 listed past projects in 浦东新区/);
  });
});

describe('the shortlist', () => {
  test('keeps only teams that are eligible and have room, best fit first, up to the limit', () => {
    const strong = team({ userId: 'strong' });
    const weak = team({ userId: 'weak', priceMinCnyPerM2: null, priceMaxCnyPerM2: null, styles: [], yearsInBusiness: 3, pastProjects: [] });
    const full = team({ userId: 'full', maxConcurrentProjects: 1 });
    const elsewhere = team({ userId: 'elsewhere', city: '杭州' });
    const unverified = team({ userId: 'unverified', status: 'pending' });
    const open = new Map([['full', 1]]);
    const ids = (limit: number) => shortlist(PROJECT, [weak, full, elsewhere, strong, unverified], open, limit).map((m) => m.team.userId);
    assert.deepEqual(ids(10), ['strong', 'weak']);
    assert.deepEqual(ids(1), ['strong']);
  });

  test('with equal scores the team with fewer open invitations comes first', () => {
    const a = team({ userId: 'team-a' });
    const b = team({ userId: 'team-b' });
    const order = (open: Map<string, number>) => shortlist(PROJECT, [a, b], open, 10).map((m) => m.team.userId);
    assert.deepEqual(order(new Map([['team-a', 2]])), ['team-b', 'team-a']);
    assert.deepEqual(order(new Map([['team-b', 2]])), ['team-a', 'team-b']);
  });

  test('otherwise a shuffle decides that is the same every time for a project and differs between projects', () => {
    const a = team({ userId: 'team-a' });
    const b = team({ userId: 'team-b' });
    const order = (id: string, teams: TeamFacts[]) =>
      shortlist({ ...PROJECT, id }, teams, new Map(), 10)
        .map((m) => m.team.userId)
        .join();
    const ids = Array.from({ length: 20 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    for (const id of ids) {
      assert.equal(order(id, [a, b]), order(id, [a, b]), 'the same project gets the same order again');
      assert.equal(order(id, [a, b]), order(id, [b, a]), 'the order does not depend on how the teams were listed');
    }
    assert.deepEqual(new Set(ids.map((id) => order(id, [a, b]))), new Set(['team-a,team-b', 'team-b,team-a']));
  });
});
