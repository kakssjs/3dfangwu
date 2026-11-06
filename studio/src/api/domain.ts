// The words and rules of the marketplace API (N19, N22, N23), shared by the database schema,
// the request checks and the services.

export const ROLES = ['homeowner', 'contractor'] as const;
export type Role = (typeof ROLES)[number];

export const LANGUAGES = ['zh-CN', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** 新房装修, 旧房翻新, 局部改造 (WORKFLOW.md section 4.3, stage 1). */
export const RENOVATION_TYPES = ['new-home', 'old-home', 'partial'] as const;
export type RenovationType = (typeof RENOVATION_TYPES)[number];

/**
 * The design styles, shared by the design stage, restyles (R2), projects and contractors' profiles,
 * so a homeowner's style and a team's styles can be compared: 现代简约, 奶油风, 原木风, 新中式, 北欧,
 * 轻奢, 工业风, 侘寂.
 */
export const DESIGN_STYLES = [
  'modern-minimalist',
  'cream',
  'natural-wood',
  'new-chinese',
  'nordic',
  'modern-luxury',
  'industrial',
  'wabi-sabi',
] as const;
export type DesignStyle = (typeof DESIGN_STYLES)[number];

export const CONTRACTOR_KINDS = ['company', 'team'] as const;
export type ContractorKind = (typeof CONTRACTOR_KINDS)[number];

/** A contractor is matched, invited and can quote only while `verified`, which only you can set (D17). */
export const CONTRACTOR_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type ContractorStatus = (typeof CONTRACTOR_STATUSES)[number];
export const REVIEW_DECISIONS = ['verified', 'rejected', 'suspended'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** `open` while the homeowner looks for a team; `awarded` once they pick a quote; `closed` without a pick. */
export const PROJECT_STATUSES = ['open', 'awarded', 'closed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * An invitation is stored as `invited` until the team answers: `declined`, or `quoted` once it has
 * sent its quote. The homeowner's pick makes one `selected` and every other open one `not-selected`.
 * `expired` is never stored: an `invited` one past its `expiresAt` reads as expired.
 */
export const INVITATION_STATUSES = ['invited', 'declined', 'quoted', 'selected', 'not-selected'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** A homeowner can have at most this many invitations open at once (WORKFLOW.md D23). */
export const MAX_LIVE_INVITATIONS = 3;
/** Days a team has to answer an invitation before it lapses. */
export const INVITATION_DAYS = 7;

/**
 * Who a task goes to in the runner's queue (WORKFLOW.md sections 5 and 6.5): the two agents, or
 * you, for a sign-off (★). The runner itself and the code checks appear in a task's `from`.
 */
export const TASK_OWNERS = ['agent-1', 'agent-2', 'you'] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];

/** A task's life: waiting, running, finished, retried out, or waiting for you to decide. */
export const TASK_STATUSES = ['todo', 'doing', 'done', 'failed', 'escalated'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The privacy notice and terms people accept when they register (N18, D17). Both are still drafts. */
export const TERMS_VERSION = 'draft-2026-11-07.2';

/** A mainland China mobile number, once `normalizePhone` has removed spaces, dashes and +86. */
export const PHONE = /^1[3-9]\d{9}$/;
export function normalizePhone(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '').replace(/^(?:\+86|0086)/, '') : value;
}

/** 统一社会信用代码: the 18-character code on every Chinese business licence (营业执照). */
export const LICENCE_NUMBER = /^[0-9A-HJ-NP-RTUW-Y]{2}\d{6}[0-9A-HJ-NP-RTUW-Y]{10}$/;

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Finds contact details in free text: a phone number or an email address. A homeowner and a
 * contractor get each other's contact only once the homeowner picks a quote (D7), so text that
 * carries one is refused.
 */
export function findContactDetails(text: string): string | undefined {
  if (/(?<!\d)1[3-9](?:[\s-]?\d){9}(?!\d)/.test(text)) return 'a phone number';
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return 'an email address';
  return undefined;
}
