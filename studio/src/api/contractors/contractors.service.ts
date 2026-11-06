import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, arrayContains, asc, desc, eq, type SQL } from 'drizzle-orm';
import type { Db } from '../db/database.ts';
import { contractorProfiles, users, type ContractorProfile, type PastProject, type Qualification } from '../db/schema.ts';
import type { ContractorKind, ContractorStatus, RenovationType } from '../domain.ts';
import { DB } from '../tokens.ts';
import type { AdminContractorQueryDto, ContractorProfileDto, ContractorSearchDto, ReviewContractorDto } from './contractors.dto.ts';

/** What homeowners see: the verified facts, never the contractor's phone or the person's name (D7). */
export interface PublicProfile {
  id: string;
  companyName: string;
  kind: ContractorKind;
  licenceNumber: string;
  qualifications: Qualification[];
  city: string;
  districts: string[];
  renovationTypes: RenovationType[];
  yearsInBusiness: number;
  teamSize: number;
  description: string;
  pastProjects: PastProject[];
  verified: boolean;
  verifiedAt: Date | null;
}

/** What the contractor sees of their own application. */
export interface OwnProfile extends Omit<PublicProfile, 'verified' | 'verifiedAt'> {
  maxConcurrentProjects: number;
  status: ContractorStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What you see in the console: the application and who sent it. */
export interface AdminProfile extends OwnProfile {
  displayName: string;
  phone: string;
}

// The facts you check before approving (D17). Changing one sends a verified contractor back to review.
const CHECKED_FACTS = ['companyName', 'kind', 'licenceNumber', 'qualifications', 'city', 'yearsInBusiness', 'pastProjects'] as const;

@Injectable()
export class ContractorsService {
  private readonly db: Db;

  constructor(@Inject(DB) db: Db) {
    this.db = db;
  }

  async getOwn(userId: string): Promise<OwnProfile> {
    const profile = await this.find(userId);
    if (!profile) throw new NotFoundException('You have not applied yet: send your company details to PUT /api/contractors/me');
    return ownProfile(profile);
  }

  /**
   * Saves the application. A new one waits for your review. A rejected contractor who saves again
   * is reviewed again; a verified one only when a checked fact changes. A suspended one stays suspended.
   */
  async saveOwn(userId: string, dto: ContractorProfileDto): Promise<OwnProfile> {
    const values = {
      companyName: dto.companyName,
      kind: dto.kind,
      licenceNumber: dto.licenceNumber,
      qualifications: dto.qualifications.map((q) => ({
        name: q.name,
        ...(q.number ? { number: q.number } : {}),
        ...(q.validUntil ? { validUntil: q.validUntil } : {}),
      })),
      city: dto.city,
      districts: dto.districts,
      renovationTypes: dto.renovationTypes,
      yearsInBusiness: dto.yearsInBusiness,
      teamSize: dto.teamSize,
      maxConcurrentProjects: dto.maxConcurrentProjects,
      description: dto.description ?? '',
      pastProjects: (dto.pastProjects ?? []).map((p) => ({
        title: p.title,
        ...(p.district ? { district: p.district } : {}),
        ...(p.year ? { year: p.year } : {}),
        ...(p.description ? { description: p.description } : {}),
      })),
    };
    const existing = await this.find(userId);
    if (!existing) {
      const [created] = await this.db.insert(contractorProfiles).values({ userId, ...values }).returning();
      return ownProfile(created!);
    }
    const factsChanged = CHECKED_FACTS.some((key) => canonical(existing[key]) !== canonical(values[key]));
    const reviewAgain = existing.status === 'rejected' || (existing.status === 'verified' && factsChanged);
    const [updated] = await this.db
      .update(contractorProfiles)
      .set({
        ...values,
        updatedAt: new Date(),
        ...(reviewAgain ? { status: 'pending' as const, reviewNote: null, reviewedAt: null } : {}),
      })
      .where(eq(contractorProfiles.userId, userId))
      .returning();
    return ownProfile(updated!);
  }

  /** Verified contractors, for homeowners to browse. */
  async listVerified(query: ContractorSearchDto): Promise<PublicProfile[]> {
    const conditions: SQL[] = [eq(contractorProfiles.status, 'verified')];
    if (query.city) conditions.push(eq(contractorProfiles.city, query.city));
    if (query.district) conditions.push(arrayContains(contractorProfiles.districts, [query.district]));
    if (query.renovationType) conditions.push(arrayContains(contractorProfiles.renovationTypes, [query.renovationType]));
    const rows = await this.db
      .select()
      .from(contractorProfiles)
      .where(and(...conditions))
      .orderBy(asc(contractorProfiles.companyName))
      .limit(200);
    return rows.map(publicProfile);
  }

  async getVerified(id: string): Promise<PublicProfile> {
    const profile = await this.find(id);
    if (!profile || profile.status !== 'verified') throw new NotFoundException('No verified contractor with this id');
    return publicProfile(profile);
  }

  /** The contractor's profile, if you have verified it; otherwise a refusal that says why. */
  async requireVerified(userId: string): Promise<ContractorProfile> {
    const profile = await this.find(userId);
    if (!profile) throw new ForbiddenException('Apply first: send your company details to PUT /api/contractors/me');
    if (profile.status === 'verified') return profile;
    const why: Record<Exclude<ContractorStatus, 'verified'>, string> = {
      pending: 'Your application is waiting for review. You can see and bid on projects once it is verified',
      rejected: 'Your application was not approved. See the review note, fix it and save it again',
      suspended: 'Your account is suspended, so you cannot see or bid on projects',
    };
    throw new ForbiddenException(why[profile.status]);
  }

  async adminList(query: AdminContractorQueryDto): Promise<AdminProfile[]> {
    const rows = await this.db
      .select({ profile: contractorProfiles, displayName: users.displayName, phone: users.phone })
      .from(contractorProfiles)
      .innerJoin(users, eq(users.id, contractorProfiles.userId))
      .where(query.status ? eq(contractorProfiles.status, query.status) : undefined)
      .orderBy(desc(contractorProfiles.updatedAt));
    return rows.map((row) => ({ ...ownProfile(row.profile), displayName: row.displayName, phone: row.phone }));
  }

  /** Your decision on an application (D6, D17). */
  async review(userId: string, dto: ReviewContractorDto): Promise<AdminProfile> {
    const [updated] = await this.db
      .update(contractorProfiles)
      .set({ status: dto.decision, reviewNote: dto.note ?? null, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(contractorProfiles.userId, userId))
      .returning();
    if (!updated) throw new NotFoundException('No application from this contractor');
    const [user] = await this.db
      .select({ displayName: users.displayName, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId));
    return { ...ownProfile(updated), displayName: user!.displayName, phone: user!.phone };
  }

  private async find(userId: string): Promise<ContractorProfile | undefined> {
    const [profile] = await this.db.select().from(contractorProfiles).where(eq(contractorProfiles.userId, userId)).limit(1);
    return profile;
  }
}

/** JSON with object keys sorted, because PostgreSQL's jsonb returns keys in its own order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

export function publicProfile(profile: ContractorProfile): PublicProfile {
  return {
    id: profile.userId,
    companyName: profile.companyName,
    kind: profile.kind,
    licenceNumber: profile.licenceNumber,
    qualifications: profile.qualifications,
    city: profile.city,
    districts: profile.districts,
    renovationTypes: profile.renovationTypes,
    yearsInBusiness: profile.yearsInBusiness,
    teamSize: profile.teamSize,
    description: profile.description,
    pastProjects: profile.pastProjects,
    verified: profile.status === 'verified',
    verifiedAt: profile.status === 'verified' ? profile.reviewedAt : null,
  };
}

function ownProfile(profile: ContractorProfile): OwnProfile {
  const { verified: _verified, verifiedAt: _verifiedAt, ...shared } = publicProfile(profile);
  return {
    ...shared,
    maxConcurrentProjects: profile.maxConcurrentProjects,
    status: profile.status,
    reviewNote: profile.reviewNote,
    reviewedAt: profile.reviewedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
