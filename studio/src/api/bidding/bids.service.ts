import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import { ContractorsService, publicProfile } from '../contractors/contractors.service.ts';
import type { Db } from '../db/database.ts';
import { bids, contractorProfiles, projects, users, type Bid } from '../db/schema.ts';
import { CONFIG, DB } from '../tokens.ts';
import { refuseContactDetails, todayInChina } from '../validation.ts';
import type { BidDto, BidQueryDto, BidSort } from './bidding.dto.ts';
import { ProjectsService } from './projects.service.ts';
import { bidFields, projectFields, visibleToOwner, type ContractorBidView, type OwnerBidView } from './views.ts';

const SORT_COLUMNS = {
  submitted: bids.createdAt,
  price: bids.priceCny,
  duration: bids.durationDays,
  experience: contractorProfiles.yearsInBusiness,
} as const;
const DEFAULT_ORDER: Record<BidSort, 'asc' | 'desc'> = { submitted: 'asc', price: 'asc', duration: 'asc', experience: 'desc' };

@Injectable()
export class BidsService {
  private readonly db: Db;
  private readonly siteUrl: string;
  private readonly contractors: ContractorsService;
  private readonly projects: ProjectsService;

  constructor(
    @Inject(DB) db: Db,
    @Inject(CONFIG) config: StudioConfig,
    contractors: ContractorsService,
    projectsService: ProjectsService,
  ) {
    this.db = db;
    this.siteUrl = config.siteUrl;
    this.contractors = contractors;
    this.projects = projectsService;
  }

  /** A verified contractor's bid on a project open to them. One bid per contractor per project. */
  async create(contractor: AuthUser, projectId: string, dto: BidDto): Promise<ContractorBidView> {
    const profile = await this.contractors.requireVerified(contractor.id);
    if (!(await this.projects.findOpenFor(profile, projectId))) {
      throw new NotFoundException('This project is not open for bids in your area, or its deadline has passed');
    }
    checkBid(dto);
    const [bid] = await this.db
      .insert(bids)
      .values({ projectId, contractorId: contractor.id, ...bidValues(dto) })
      .onConflictDoNothing({ target: [bids.projectId, bids.contractorId] })
      .returning();
    if (!bid) throw new ConflictException('You have already bid on this project: change that bid with PUT /api/bids/:id');
    return (await this.contractorViews([bid]))[0]!;
  }

  /** Replaces a bid, while the project still takes bids and nobody has been picked. */
  async update(contractor: AuthUser, bidId: string, dto: BidDto): Promise<ContractorBidView> {
    await this.contractors.requireVerified(contractor.id);
    const [existing] = await this.db
      .select()
      .from(bids)
      .where(and(eq(bids.id, bidId), eq(bids.contractorId, contractor.id)))
      .limit(1);
    if (!existing) throw new NotFoundException('No such bid of yours');
    if (existing.status !== 'submitted' || !(await this.projects.isTakingBids(existing.projectId))) {
      throw new ConflictException('This bid can no longer change: the project is closed or awarded, or its deadline has passed');
    }
    checkBid(dto);
    const [bid] = await this.db
      .update(bids)
      .set({ ...bidValues(dto), updatedAt: new Date() })
      .where(eq(bids.id, bidId))
      .returning();
    return (await this.contractorViews([bid!]))[0]!;
  }

  async listMine(contractor: AuthUser): Promise<ContractorBidView[]> {
    const rows = await this.db.select().from(bids).where(eq(bids.contractorId, contractor.id)).orderBy(desc(bids.createdAt));
    return this.contractorViews(rows);
  }

  /** The bid behind its link: for the contractor who made it, or the homeowner whose project it is. */
  async get(user: AuthUser, bidId: string): Promise<ContractorBidView | OwnerBidView> {
    if (user.role === 'contractor') {
      const [bid] = await this.db
        .select()
        .from(bids)
        .where(and(eq(bids.id, bidId), eq(bids.contractorId, user.id)))
        .limit(1);
      if (!bid) throw new NotFoundException('No such bid of yours');
      return (await this.contractorViews([bid]))[0]!;
    }
    const ownProjects = this.db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, user.id));
    const [view] = await this.ownerViews([eq(bids.id, bidId), inArray(bids.projectId, ownProjects)]);
    if (!view) throw new NotFoundException('No such bid on your projects');
    return view;
  }

  /** The bids on a homeowner's project, filtered and in the order they choose. */
  async listForOwner(owner: AuthUser, projectId: string, query: BidQueryDto): Promise<OwnerBidView[]> {
    await this.projects.requireOwn(owner, projectId);
    if (query.minPriceCny !== undefined && query.maxPriceCny !== undefined && query.minPriceCny > query.maxPriceCny) {
      throw new BadRequestException('minPriceCny must not be more than maxPriceCny');
    }
    const conditions: SQL[] = [eq(bids.projectId, projectId)];
    if (query.minPriceCny !== undefined) conditions.push(gte(bids.priceCny, query.minPriceCny));
    if (query.maxPriceCny !== undefined) conditions.push(lte(bids.priceCny, query.maxPriceCny));
    if (query.maxDurationDays !== undefined) conditions.push(lte(bids.durationDays, query.maxDurationDays));
    if (query.minYearsInBusiness !== undefined) conditions.push(gte(contractorProfiles.yearsInBusiness, query.minYearsInBusiness));
    if (query.startBy !== undefined) conditions.push(lte(bids.earliestStart, query.startBy));
    const sort = query.sort ?? 'submitted';
    const direction = query.order ?? DEFAULT_ORDER[sort];
    return this.ownerViews(conditions, [(direction === 'asc' ? asc : desc)(SORT_COLUMNS[sort]), asc(bids.createdAt), asc(bids.id)]);
  }

  private async ownerViews(conditions: SQL[], order: SQL[] = []): Promise<OwnerBidView[]> {
    const rows = await this.db
      .select({ bid: bids, profile: contractorProfiles, name: users.displayName, phone: users.phone })
      .from(bids)
      .innerJoin(contractorProfiles, eq(contractorProfiles.userId, bids.contractorId))
      .innerJoin(users, eq(users.id, bids.contractorId))
      .where(and(visibleToOwner(), ...conditions))
      .orderBy(...order);
    return rows.map((row) => ({
      ...bidFields(row.bid, this.siteUrl),
      contractor: publicProfile(row.profile),
      contact: row.bid.status === 'selected' ? { name: row.name, phone: row.phone } : null,
    }));
  }

  private async contractorViews(rows: Bid[]): Promise<ContractorBidView[]> {
    if (rows.length === 0) return [];
    const found = await this.db
      .select({ project: projects, name: users.displayName, phone: users.phone })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .where(
        inArray(
          projects.id,
          rows.map((b) => b.projectId),
        ),
      );
    return rows.map((bid) => {
      const { project, name, phone } = found.find((f) => f.project.id === bid.projectId)!;
      const fields = projectFields(project, this.siteUrl);
      return {
        ...bidFields(bid, this.siteUrl),
        project: {
          id: fields.id,
          link: fields.link,
          title: fields.title,
          city: fields.city,
          district: fields.district,
          status: fields.status,
          bidDeadline: fields.bidDeadline,
        },
        homeowner: bid.status === 'selected' ? { name, phone } : null,
      };
    });
  }
}

function bidValues(dto: BidDto) {
  return {
    priceCny: dto.priceCny,
    labourCny: dto.labourCny ?? null,
    materialsCny: dto.materialsCny ?? null,
    managementFeeCny: dto.managementFeeCny ?? null,
    durationDays: dto.durationDays,
    earliestStart: dto.earliestStart,
    mainMaterials: dto.mainMaterials ?? '',
    message: dto.message ?? '',
  };
}

/** The rules a bid must meet, on top of each field's own checks. */
function checkBid(dto: BidDto): void {
  const parts = (dto.labourCny ?? 0) + (dto.materialsCny ?? 0) + (dto.managementFeeCny ?? 0);
  if (parts > dto.priceCny) throw new BadRequestException('Labour, materials and the management fee add up to more than priceCny');
  if (dto.earliestStart < todayInChina()) throw new BadRequestException('earliestStart must be today or later');
  refuseContactDetails({ mainMaterials: dto.mainMaterials, message: dto.message });
}
