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
  BID_STATUSES,
  CONTRACTOR_KINDS,
  CONTRACTOR_STATUSES,
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
export const bidStatusEnum = pgEnum('bid_status', BID_STATUSES);

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
export const contractorProfiles = pgTable('contractor_profiles', {
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
  yearsInBusiness: integer('years_in_business').notNull(),
  teamSize: integer('team_size').notNull(),
  maxConcurrentProjects: integer('max_concurrent_projects').notNull(),
  description: text('description').notNull().default(''),
  pastProjects: jsonb('past_projects').$type<PastProject[]>().notNull().default([]),
  status: contractorStatusEnum('status').notNull().default('pending'),
  reviewNote: text('review_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One renovation of one home, published by its homeowner for bids (what the plan calls an order). */
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
    bidDeadline: timestamp('bid_deadline', { withTimezone: true }).notNull(),
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

/** A contractor's offer on a project. Other contractors never see it (D7). */
export const bids = pgTable(
  'bids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    contractorId: uuid('contractor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    priceCny: integer('price_cny').notNull(),
    labourCny: integer('labour_cny'),
    materialsCny: integer('materials_cny'),
    managementFeeCny: integer('management_fee_cny'),
    durationDays: integer('duration_days').notNull(),
    earliestStart: date('earliest_start').notNull(),
    /** Brands and models of the main materials. */
    mainMaterials: text('main_materials').notNull().default(''),
    /** The contractor's note and suggestions on the design. */
    message: text('message').notNull().default(''),
    status: bidStatusEnum('status').notNull().default('submitted'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('bids_one_per_contractor').on(t.projectId, t.contractorId),
    uniqueIndex('bids_one_selected').on(t.projectId).where(sql`${t.status} = 'selected'`),
  ],
);

export type User = typeof users.$inferSelect;
export type ContractorProfile = typeof contractorProfiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Bid = typeof bids.$inferSelect;
