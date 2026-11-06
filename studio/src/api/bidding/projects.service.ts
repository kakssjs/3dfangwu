import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import { ContractorsService } from '../contractors/contractors.service.ts';
import type { Db } from '../db/database.ts';
import { bids, contractorProfiles, projects, users, type ContractorProfile, type Project } from '../db/schema.ts';
import { CONFIG, DB } from '../tokens.ts';
import { refuseContactDetails, todayInChina } from '../validation.ts';
import type { CreateProjectDto, OpenProjectsQueryDto } from './bidding.dto.ts';
import {
  bidLink,
  openFor,
  projectFields,
  takingBids,
  visibleToOwner,
  type ContractorProjectView,
  type OwnerProjectView,
} from './views.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_VISIBLE = 'No such project open to you';

@Injectable()
export class ProjectsService {
  private readonly db: Db;
  private readonly siteUrl: string;
  private readonly contractors: ContractorsService;

  constructor(@Inject(DB) db: Db, @Inject(CONFIG) config: StudioConfig, contractors: ContractorsService) {
    this.db = db;
    this.siteUrl = config.siteUrl;
    this.contractors = contractors;
  }

  /** Publishes the homeowner's requirements for bids, open for `biddingDays` (default 7). */
  async create(owner: AuthUser, dto: CreateProjectDto): Promise<OwnerProjectView> {
    if (dto.budgetMinCny > dto.budgetMaxCny) throw new BadRequestException('budgetMinCny must not be more than budgetMaxCny');
    if (dto.desiredStart < todayInChina()) throw new BadRequestException('desiredStart must be today or later');
    refuseContactDetails({ title: dto.title, layout: dto.layout, style: dto.style, description: dto.description });
    const [project] = await this.db
      .insert(projects)
      .values({
        ownerId: owner.id,
        title: dto.title,
        city: dto.city,
        district: dto.district,
        floorAreaM2: dto.floorAreaM2,
        layout: dto.layout ?? '',
        renovationType: dto.renovationType,
        style: dto.style ?? '',
        budgetMinCny: dto.budgetMinCny,
        budgetMaxCny: dto.budgetMaxCny,
        desiredStart: dto.desiredStart,
        bidDeadline: new Date(Date.now() + (dto.biddingDays ?? 7) * DAY_MS),
        description: dto.description,
      })
      .returning();
    return (await this.ownerViews([project!]))[0]!;
  }

  async listMine(owner: AuthUser): Promise<OwnerProjectView[]> {
    const rows = await this.db.select().from(projects).where(eq(projects.ownerId, owner.id)).orderBy(desc(projects.createdAt));
    return this.ownerViews(rows);
  }

  /** The board a verified contractor picks from: open projects in their city, districts and types. */
  async listOpen(contractor: AuthUser, query: OpenProjectsQueryDto): Promise<ContractorProjectView[]> {
    const profile = await this.contractors.requireVerified(contractor.id);
    const conditions = openFor(profile);
    if (query.district) conditions.push(eq(projects.district, query.district));
    if (query.renovationType) conditions.push(eq(projects.renovationType, query.renovationType));
    const rows = await this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt))
      .limit(200);
    return this.contractorViews(rows, contractor.id);
  }

  /** The project behind its link: its owner sees all of it; a contractor sees it if it's open to them or they bid on it. */
  async get(user: AuthUser, id: string): Promise<OwnerProjectView | ContractorProjectView> {
    if (user.role === 'homeowner') return (await this.ownerViews([await this.requireOwn(user, id)]))[0]!;
    const [project] = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) throw new NotFoundException(NOT_VISIBLE);
    const [myBid] = await this.db
      .select({ id: bids.id })
      .from(bids)
      .where(and(eq(bids.projectId, id), eq(bids.contractorId, user.id)))
      .limit(1);
    if (!myBid) {
      const profile = await this.contractors.requireVerified(user.id);
      if (!(await this.findOpenFor(profile, id))) throw new NotFoundException(NOT_VISIBLE);
    }
    return (await this.contractorViews([project], user.id))[0]!;
  }

  async requireOwn(owner: AuthUser, id: string): Promise<Project> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id)))
      .limit(1);
    if (!project) throw new NotFoundException('No such project of yours');
    return project;
  }

  /** The project, if this contractor can bid on it now. */
  async findOpenFor(profile: ContractorProfile, id: string): Promise<Project | undefined> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), ...openFor(profile)))
      .limit(1);
    return project;
  }

  async isTakingBids(id: string): Promise<boolean> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), ...takingBids()))
      .limit(1);
    return project !== undefined;
  }

  /** Ends bidding without a pick. Bids still waiting are marked not selected. */
  async close(owner: AuthUser, id: string): Promise<OwnerProjectView> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [closed] = await tx
        .update(projects)
        .set({ status: 'closed', closedAt: now, updatedAt: now })
        .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id), eq(projects.status, 'open')))
        .returning({ id: projects.id });
      if (!closed) await refuseNotOpen(tx, owner, id);
      await tx
        .update(bids)
        .set({ status: 'not-selected', updatedAt: now })
        .where(and(eq(bids.projectId, id), eq(bids.status, 'submitted')));
    });
    return (await this.ownerViews([await this.requireOwn(owner, id)]))[0]!;
  }

  /**
   * The homeowner's pick, all at once: the project is awarded, the bid selected and the others not.
   * Only then do the two see each other's name and phone (D7). The homeowner can pick before or
   * after the deadline, while the project is open.
   */
  async select(owner: AuthUser, id: string, bidId: string): Promise<OwnerProjectView> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [awarded] = await tx
        .update(projects)
        .set({ status: 'awarded', updatedAt: now })
        .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id), eq(projects.status, 'open')))
        .returning({ id: projects.id });
      if (!awarded) await refuseNotOpen(tx, owner, id);
      const [bid] = await tx
        .select({ id: bids.id, contractorStatus: contractorProfiles.status })
        .from(bids)
        .innerJoin(contractorProfiles, eq(contractorProfiles.userId, bids.contractorId))
        .where(and(eq(bids.id, bidId), eq(bids.projectId, id)))
        .limit(1);
      if (!bid) throw new NotFoundException('No such bid on this project');
      if (bid.contractorStatus !== 'verified') {
        throw new ConflictException('This contractor is no longer verified, so their bid cannot be picked');
      }
      await tx.update(bids).set({ status: 'selected', updatedAt: now }).where(eq(bids.id, bidId));
      await tx
        .update(bids)
        .set({ status: 'not-selected', updatedAt: now })
        .where(and(eq(bids.projectId, id), ne(bids.id, bidId)));
    });
    return (await this.ownerViews([await this.requireOwn(owner, id)]))[0]!;
  }

  private async ownerViews(rows: Project[]): Promise<OwnerProjectView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const counts = await this.db
      .select({ projectId: bids.projectId, count: count() })
      .from(bids)
      .innerJoin(contractorProfiles, eq(contractorProfiles.userId, bids.contractorId))
      .where(and(inArray(bids.projectId, ids), visibleToOwner()))
      .groupBy(bids.projectId);
    const picked = await this.db
      .select({
        projectId: bids.projectId,
        bidId: bids.id,
        contractorId: bids.contractorId,
        companyName: contractorProfiles.companyName,
        name: users.displayName,
        phone: users.phone,
      })
      .from(bids)
      .innerJoin(contractorProfiles, eq(contractorProfiles.userId, bids.contractorId))
      .innerJoin(users, eq(users.id, bids.contractorId))
      .where(and(inArray(bids.projectId, ids), eq(bids.status, 'selected')));
    return rows.map((project) => {
      const pick = picked.find((p) => p.projectId === project.id);
      return {
        ...projectFields(project, this.siteUrl),
        closedAt: project.closedAt,
        updatedAt: project.updatedAt,
        bidCount: counts.find((c) => c.projectId === project.id)?.count ?? 0,
        selectedBid: pick
          ? {
              id: pick.bidId,
              link: bidLink(this.siteUrl, project.id, pick.bidId),
              contractorId: pick.contractorId,
              companyName: pick.companyName,
              contact: { name: pick.name, phone: pick.phone },
            }
          : null,
      };
    });
  }

  private async contractorViews(rows: Project[], contractorId: string): Promise<ContractorProjectView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const mine = await this.db
      .select({ id: bids.id, projectId: bids.projectId, status: bids.status })
      .from(bids)
      .where(and(eq(bids.contractorId, contractorId), inArray(bids.projectId, ids)));
    const won = mine.filter((b) => b.status === 'selected').map((b) => b.projectId);
    const owners =
      won.length === 0
        ? []
        : await this.db
            .select({ projectId: projects.id, name: users.displayName, phone: users.phone })
            .from(projects)
            .innerJoin(users, eq(users.id, projects.ownerId))
            .where(inArray(projects.id, won));
    return rows.map((project) => {
      const bid = mine.find((b) => b.projectId === project.id);
      const owner = owners.find((o) => o.projectId === project.id);
      return {
        ...projectFields(project, this.siteUrl),
        myBid: bid ? { id: bid.id, link: bidLink(this.siteUrl, project.id, bid.id), status: bid.status } : null,
        homeowner: owner ? { name: owner.name, phone: owner.phone } : null,
      };
    });
  }
}

/** Throws the reason a project of this homeowner can't be closed or awarded. */
async function refuseNotOpen(tx: Tx, owner: AuthUser, id: string): Promise<never> {
  const [project] = await tx
    .select({ status: projects.status })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id)))
    .limit(1);
  if (!project) throw new NotFoundException('No such project of yours');
  throw new ConflictException(`This project is already ${project.status}`);
}
