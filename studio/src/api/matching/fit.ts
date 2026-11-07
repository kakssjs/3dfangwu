// Which verified teams suit a project, and how well: the rules behind the shortlist that Agent 2
// explains (WORKFLOW.md section 4.3, stage 3; D23). Plain functions on plain data, so anyone can
// read the rules and test them on their own: no database, no clock, no randomness.
//
// Fit is worked out from verified facts and what the team itself states (its styles and its usual
// price per m²). Nobody can pay for a better place (D17), and nothing here looks at a quote.

import { createHash } from 'node:crypto';
import type { ContractorProfile, Project } from '../db/schema.ts';

export type ProjectFacts = Pick<
  Project,
  'id' | 'city' | 'district' | 'renovationType' | 'floorAreaM2' | 'budgetMinCny' | 'budgetMaxCny' | 'style'
>;

export type TeamFacts = Pick<
  ContractorProfile,
  | 'userId'
  | 'status'
  | 'city'
  | 'districts'
  | 'renovationTypes'
  | 'styles'
  | 'priceMinCnyPerM2'
  | 'priceMaxCnyPerM2'
  | 'yearsInBusiness'
  | 'teamSize'
  | 'maxConcurrentProjects'
  | 'pastProjects'
>;

export const FIT_TIERS = ['strong', 'good', 'possible'] as const;
export type FitTier = (typeof FIT_TIERS)[number];

export type FitFactor = 'budget' | 'style' | 'experience' | 'local';
/** `unknown`: the team hasn't said, so the factor isn't counted either way. */
export type FitResult = 'good' | 'partial' | 'none' | 'unknown';

export interface FitReason {
  factor: FitFactor;
  result: FitResult;
  /** A plain sentence with the numbers, for the agent to put into the homeowner's language. */
  note: string;
  /** The same, in Chinese (D10). */
  noteZh: string;
}

export interface Fit {
  tier: FitTier;
  /** 0–100. Used to order the shortlist; people see the tier and the reasons, not this number. */
  score: number;
  reasons: FitReason[];
}

/** What each factor is worth. A factor that can't be judged (no style chosen, no price stated) is left out of the total. */
/** Style names as people read them in Chinese. */
const STYLE_ZH: Record<string, string> = {
  'modern-minimalist': '现代简约', cream: '奶油风', 'natural-wood': '原木风', 'new-chinese': '新中式', nordic: '北欧', 'modern-luxury': '轻奢', industrial: '工业风', 'wabi-sabi': '侘寂风',
};

const WEIGHTS = { budget: 35, style: 25, experience: 20, local: 20 } as const;
const STRONG_FROM = 75;
const GOOD_FROM = 50;

/** Only these teams can be matched to a project or invited to it: verified, working in its city and district, on its kind of renovation. */
export function isEligible(team: TeamFacts, project: ProjectFacts): boolean {
  return (
    team.status === 'verified' &&
    team.city === project.city &&
    team.districts.includes(project.district) &&
    team.renovationTypes.includes(project.renovationType)
  );
}

/**
 * A team can't have more invitations open than the projects it said it can take at once, so a
 * popular team isn't flooded and the work reaches the next fit.
 */
export function hasRoom(team: Pick<TeamFacts, 'maxConcurrentProjects'>, openInvitations: number): boolean {
  return openInvitations < team.maxConcurrentProjects;
}

interface Factor {
  /** Points earned, out of the factor's weight. */
  earned: number;
  /** false: left out of the total. */
  counts: boolean;
  reason?: FitReason;
}

const yuan = (n: number) => `¥${Math.round(n).toLocaleString('en-US')}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function budgetFactor(project: ProjectFacts, team: TeamFacts): Factor {
  // A price per m² describes a whole renovation, not a bathroom or a kitchen.
  if (project.renovationType === 'partial') return { earned: 0, counts: false };
  const min = team.priceMinCnyPerM2;
  const max = team.priceMaxCnyPerM2;
  if (min === null || max === null) {
    return {
      earned: 0,
      counts: false,
      reason: { factor: 'budget', result: 'unknown', note: "Hasn't stated its usual price per m², so the budget isn't compared", noteZh: '未说明常见每平米价格，所以不比较预算' },
    };
  }
  const low = project.budgetMinCny / project.floorAreaM2;
  const high = project.budgetMaxCny / project.floorAreaM2;
  const budget = `${yuan(low)}–${yuan(high)}`;
  const usual = `${yuan(min)}–${yuan(max)}`;
  const overlap = Math.min(high, max) - Math.max(low, min);
  const weight = WEIGHTS.budget;
  if (overlap >= 0) {
    // The middle of the budget falls in the team's usual range: it can do this job at that price.
    const middle = (low + high) / 2;
    if (middle >= min && middle <= max) {
      return {
        earned: weight,
        counts: true,
        reason: { factor: 'budget', result: 'good', note: `Your budget is about ${budget} per m²; this team usually works at ${usual}`, noteZh: `你的预算约为每平米 ${budget}；该团队常见价格为 ${usual}` },
      };
    }
    return {
      earned: weight / 2,
      counts: true,
      reason: {
        factor: 'budget',
        result: 'partial',
        note: `Your budget is about ${budget} per m²; this team usually works at ${usual}, which only partly overlaps`,
        noteZh: `你的预算约为每平米 ${budget}；该团队常见价格为 ${usual}，只有部分重合`,
      },
    };
  }
  const above = low > max;
  const gap = above ? low - max : min - high;
  const near = gap <= 0.15 * (above ? max : min);
  const side = above ? 'above' : 'below';
  if (near) {
    return {
      earned: weight / 4,
      counts: true,
      reason: {
        factor: 'budget',
        result: 'partial',
        note: `Your budget of about ${budget} per m² is just ${side} this team's usual ${usual}`,
        noteZh: `你的预算约为每平米 ${budget}，略${above ? '高' : '低'}于该团队常见的 ${usual}`,
      },
    };
  }
  return {
    earned: 0,
    counts: true,
    reason: { factor: 'budget', result: 'none', note: `Your budget of about ${budget} per m² is well ${side} this team's usual ${usual}`, noteZh: `你的预算约为每平米 ${budget}，明显${above ? '高' : '低'}于该团队常见的 ${usual}` },
  };
}

function styleFactor(project: ProjectFacts, team: TeamFacts): Factor {
  if (project.style === '') return { earned: 0, counts: false };
  if (team.styles.length === 0) {
    return {
      earned: 0,
      counts: false,
      reason: { factor: 'style', result: 'unknown', note: "Hasn't listed the styles it works in, so the style isn't compared", noteZh: '未列出擅长风格，所以不比较风格' },
    };
  }
  if ((team.styles as readonly string[]).includes(project.style)) {
    return {
      earned: WEIGHTS.style,
      counts: true,
      reason: { factor: 'style', result: 'good', note: `Works in your chosen style (${project.style})`, noteZh: `擅长你选的风格（${STYLE_ZH[project.style] ?? project.style}）` },
    };
  }
  return {
    earned: 0,
    counts: true,
    reason: { factor: 'style', result: 'none', note: `Doesn't list your chosen style (${project.style}); works in ${team.styles.join(', ')}`, noteZh: `没有列出你选的风格（${STYLE_ZH[project.style] ?? project.style}）；擅长 ${team.styles.map((x) => STYLE_ZH[x] ?? x).join('、')}` },
  };
}

function experienceFactor(team: TeamFacts): Factor {
  const years = team.yearsInBusiness;
  const result: FitResult = years >= 5 ? 'good' : years >= 2 ? 'partial' : 'none';
  return {
    earned: (WEIGHTS.experience * Math.min(years, 10)) / 10,
    counts: true,
    reason: { factor: 'experience', result, note: `${plural(years, 'year')} in business, team of ${team.teamSize}`, noteZh: `从业 ${years} 年，团队 ${team.teamSize} 人` },
  };
}

function localFactor(project: ProjectFacts, team: TeamFacts): Factor {
  const here = team.pastProjects.filter((p) => p.district === project.district).length;
  const result: FitResult = here >= 2 ? 'good' : here === 1 ? 'partial' : 'none';
  return {
    earned: (WEIGHTS.local * Math.min(here, 3)) / 3,
    counts: true,
    reason: {
      factor: 'local',
      result,
      note: here > 0 ? `${plural(here, 'listed past project')} in ${project.district}` : `No listed past projects in ${project.district}`,
      noteZh: here > 0 ? `在${project.district}有 ${here} 个过往项目` : `在${project.district}没有列出过往项目`,
    },
  };
}

/** How well one eligible team fits the project, with the reasons. */
export function fitFor(project: ProjectFacts, team: TeamFacts): Fit {
  const factors = [budgetFactor(project, team), styleFactor(project, team), experienceFactor(team), localFactor(project, team)];
  const weights = [WEIGHTS.budget, WEIGHTS.style, WEIGHTS.experience, WEIGHTS.local];
  let earned = 0;
  let possible = 0;
  factors.forEach((factor, i) => {
    if (!factor.counts) return;
    earned += factor.earned;
    possible += weights[i]!;
  });
  // Experience and local work always count, so `possible` is never 0.
  const score = Math.round((100 * earned) / possible);
  return {
    tier: score >= STRONG_FROM ? 'strong' : score >= GOOD_FROM ? 'good' : 'possible',
    score,
    reasons: factors.flatMap((factor) => (factor.reason ? [factor.reason] : [])),
  };
}

/** The same for every request, different for every project, so no company is always first among equals. */
function shuffleKey(projectId: string, teamId: string): string {
  return createHash('sha256').update(`${projectId}:${teamId}`).digest('hex');
}

export interface Match<T extends TeamFacts> {
  team: T;
  fit: Fit;
}

/**
 * The teams to suggest, best fit first. Only eligible teams with room for another invitation are
 * considered. Teams with the same score: the one with fewer invitations open first, then a fixed
 * shuffle that differs for every project.
 */
export function shortlist<T extends TeamFacts>(
  project: ProjectFacts,
  teams: readonly T[],
  openInvitations: ReadonlyMap<string, number>,
  limit: number,
): Match<T>[] {
  const open = (team: T) => openInvitations.get(team.userId) ?? 0;
  return teams
    .filter((team) => isEligible(team, project) && hasRoom(team, open(team)))
    .map((team) => ({ team, fit: fitFor(project, team) }))
    .sort((a, b) => {
      if (a.fit.score !== b.fit.score) return b.fit.score - a.fit.score;
      if (open(a.team) !== open(b.team)) return open(a.team) - open(b.team);
      const [x, y] = [shuffleKey(project.id, a.team.userId), shuffleKey(project.id, b.team.userId)];
      return x < y ? -1 : x > y ? 1 : 0;
    })
    .slice(0, limit);
}
