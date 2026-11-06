// The marketplace's records in PostgreSQL (WORKFLOW.md section 6.3). After changing this file,
// run `npm run db:generate` to write the migration that brings existing databases up to date.

import { sql } from 'drizzle-orm';
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  CONTRACTOR_KINDS,
  CONTRACTOR_STATUSES,
  DESIGN_STYLES,
  INVITATION_STATUSES,
  LANGUAGES,
  PROJECT_STATUSES,
  RENOVATION_TYPES,
  ROLES,
} from '../domain.ts';

export const roleEnum = pgEnum('role', ROLES);
export const languageEnum = pgEnum('language', LANGUAGES);
export const contractorStatusEnum = pgEnum('contractor_status', CONTRACTOR_STATUSES);
export const renovationTypeEnum = pgEnum('renovation_type', RENOVATION_TYPES);
export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUSES);
export const invitationStatusEnum = pgEnum('invitation_status', INVITATION_STATUSES);

export interface Qualification {
  /** For example 建筑装修装饰工程专业承包二级. */
  name: string;
  number?: string;
  validUntil?: string;
}

export interface PastProject {
  title: string;
  district?: string;
  year?: number;
  description?: string;
}

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/** Everyone who registers: homeowners and contractors. You use the admin key instead (D6). */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: roleEnum('role').notNull(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  language: languageEnum('language').notNull().default('zh-CN'),
  /** Which privacy notice and terms they accepted, and when (N18). */
  consentVersion: text('consent_version').notNull(),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** A contractor's application and, once you verify it, their public profile (D17, N23). */
export const contractorProfiles = pgTable(
  'contractor_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    companyName: text('company_name').notNull(),
    kind: text('kind', { enum: CONTRACTOR_KINDS }).notNull(),
    licenceNumber: text('licence_number').notNull(),
    qualifications: jsonb('qualifications').$type<Qualification[]>().notNull().default([]),
    city: text('city').notNull(),
    districts: text('districts').array().notNull(),
    renovationTypes: renovationTypeEnum('renovation_types').array().notNull(),
    /** The design styles the team works in (`DESIGN_STYLES`): matching compares them with a project's style. */
    styles: text('styles', { enum: DESIGN_STYLES }).array().notNull().default([]),
    /** What a full renovation usually costs with this team, per m² of floor area, in CNY: matching compares it with a budget. */
    priceMinCnyPerM2: integer('price_min_cny_per_m2'),
    priceMaxCnyPerM2: integer('price_max_cny_per_m2'),
    yearsInBusiness: integer('years_in_business').notNull(),
    teamSize: integer('team_size').notNull(),
    /** How many projects the team can take at once. It also caps the invitations the team has open at once (D23). */
    maxConcurrentProjects: integer('max_concurrent_projects').notNull(),
    description: text('description').notNull().default(''),
    pastProjects: jsonb('past_projects').$type<PastProject[]>().notNull().default([]),
    status: contractorStatusEnum('status').notNull().default('pending'),
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'contractor_price_band',
      sql`(${t.priceMinCnyPerM2} is null) = (${t.priceMaxCnyPerM2} is null) and (${t.priceMinCnyPerM2} is null or ${t.priceMinCnyPerM2} <= ${t.priceMaxCnyPerM2})`,
    ),
  ],
);

/** One renovation of one home, as its homeowner describes it. Only the teams they invite see it (D23). */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    city: text('city').notNull(),
    district: text('district').notNull(),
    floorAreaM2: doublePrecision('floor_area_m2').notNull(),
    /** For example 3室2厅2卫. */
    layout: text('layout').notNull().default(''),
    renovationType: renovationTypeEnum('renovation_type').notNull(),
    style: text('style').notNull().default(''),
    budgetMinCny: integer('budget_min_cny').notNull(),
    budgetMaxCny: integer('budget_max_cny').notNull(),
    desiredStart: date('desired_start').notNull(),
    description: text('description').notNull(),
    status: projectStatusEnum('status').notNull().default('open'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('projects_budget_range', sql`${t.budgetMinCny} <= ${t.budgetMaxCny}`),
    index('projects_open_by_place').on(t.status, t.city, t.district),
  ],
);

/**
 * A homeowner's invitation to one matched team to look at a project, and the team's answer: a
 * decline, or its one quote (D23). Other teams never see it (D7).
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    contractorId: uuid('contractor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The homeowner's note to the team. */
    message: text('message').notNull().default(''),
    status: invitationStatusEnum('status').notNull().default('invited'),
    /** After this the team can no longer answer, and the invitation no longer counts as open. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** When the team declined, or first quoted. */
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    declineReason: text('decline_reason'),
    priceCny: integer('price_cny'),
    labourCny: integer('labour_cny'),
    materialsCny: integer('materials_cny'),
    managementFeeCny: integer('management_fee_cny'),
    durationDays: integer('duration_days'),
    earliestStart: date('earliest_start'),
    /** Brands and models of the main materials. */
    mainMaterials: text('main_materials').notNull().default(''),
    /** The team's note and suggestions on the design. */
    quoteNote: text('quote_note').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('invitations_one_per_contractor').on(t.projectId, t.contractorId),
    uniqueIndex('invitations_one_selected').on(t.projectId).where(sql`${t.status} = 'selected'`),
    index('invitations_by_contractor').on(t.contractorId, t.status),
    check(
      'invitations_quote_complete',
      sql`${t.status} not in ('quoted', 'selected') or (${t.priceCny} is not null and ${t.durationDays} is not null and ${t.earliestStart} is not null)`,
    ),
  ],
);

/**
 * A file someone sent us (N19): kept on disk under the files folder, with what it really is and
 * who may see it recorded here. Photos arrive with their metadata already removed (N18).
 */
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Which project it was sent for, when it was sent for one (a floor plan, a site photo). */
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    /** The name the sender gave it. */
    filename: text('filename').notNull(),
    /** What the bytes really are, after the content check (N19). */
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Where the bytes are, relative to the files folder. */
    storagePath: text('storage_path').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('uploads_by_owner').on(t.ownerId), index('uploads_by_project').on(t.projectId)],
);

export type User = typeof users.$inferSelect;
export type ContractorProfile = typeof contractorProfiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
