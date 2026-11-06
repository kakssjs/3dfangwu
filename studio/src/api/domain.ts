// The words and rules of the marketplace API (N19, N22, N23), shared by the database schema,
// the request checks and the services.

export const ROLES = ['homeowner', 'contractor'] as const;
export type Role = (typeof ROLES)[number];

export const LANGUAGES = ['zh-CN', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** 新房装修, 旧房翻新, 局部改造 (WORKFLOW.md section 4.3, stage 1). */
export const RENOVATION_TYPES = ['new-home', 'old-home', 'partial'] as const;
export type RenovationType = (typeof RENOVATION_TYPES)[number];

export const CONTRACTOR_KINDS = ['company', 'team'] as const;
export type ContractorKind = (typeof CONTRACTOR_KINDS)[number];

/** A contractor sees projects and bids only while `verified`, which only you can set (D17). */
export const CONTRACTOR_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type ContractorStatus = (typeof CONTRACTOR_STATUSES)[number];
export const REVIEW_DECISIONS = ['verified', 'rejected', 'suspended'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** `open` takes bids until the deadline; `awarded` once the homeowner picks one; `closed` without a pick. */
export const PROJECT_STATUSES = ['open', 'awarded', 'closed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const BID_STATUSES = ['submitted', 'selected', 'not-selected'] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

/** The privacy notice and terms people accept when they register (N18, D17). Both are still drafts. */
export const TERMS_VERSION = 'draft-2026-11-06';

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
 * contractor get each other's contact only once the homeowner picks the bid (D7), so text that
 * carries one is refused.
 */
export function findContactDetails(text: string): string | undefined {
  if (/(?<!\d)1[3-9](?:[\s-]?\d){9}(?!\d)/.test(text)) return 'a phone number';
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) return 'an email address';
  return undefined;
}
