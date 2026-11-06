import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import type { Db } from '../db/database.ts';
import { contractorProfiles, invitations, projects, users, type Project } from '../db/schema.ts';
import { requirePlace } from '../regions/place.ts';
import { CONFIG, DB } from '../tokens.ts';
import { refuseContactDetails, todayInChina } from '../validation.ts';
import type { CreateProjectDto } from './matching.dto.ts';
import { invitationLink, openInvitation, projectFields, stateOf, visibleToOwner, type OwnerProjectView } from './views.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const NOT_YOURS = 'No such project of yours';

@Injectable()
export class ProjectsService {
  private readonly db: Db;
  private readonly siteUrl: string;

  constructor(@Inject(DB) db: Db, @Inject(CONFIG) config: StudioConfig) {
    this.db = db;
    this.siteUrl = config.siteUrl;
  }

  /** Saves the homeowner's requirements. Nobody else sees them until the homeowner invites a team (D23). */
  async create(owner: AuthUser, dto: CreateProjectDto): Promise<OwnerProjectView> {
    if (dto.budgetMinCny > dto.budgetMaxCny) throw new BadRequestException('budgetMinCny must not be more than budgetMaxCny');
    if (dto.desiredStart < todayInChina()) throw new BadRequestException('desiredStart must be today or later');
    const city = requirePlace(dto.city, [dto.district]);
    refuseContactDetails({ title: dto.title, layout: dto.layout, community: dto.community, description: dto.description });
    const [project] = await this.db
      .insert(projects)
      .values({
        ownerId: owner.id,
        title: dto.title,
        city,
        district: dto.district,
        floorAreaM2: dto.floorAreaM2,
        layout: dto.layout ?? '',
        community: dto.community ?? '',
        renovationType: dto.renovationType,
        style: dto.style ?? '',
        budgetMinCny: dto.budgetMinCny,
        budgetMaxCny: dto.budgetMaxCny,
        desiredStart: dto.desiredStart,
        description: dto.description,
      })
      .returning();
    return (await this.ownerViews([project!]))[0]!;
  }

  async listMine(owner: AuthUser): Promise<OwnerProjectView[]> {
    const rows = await this.db.select().from(projects).where(eq(projects.ownerId, owner.id)).orderBy(desc(projects.createdAt));
    return this.ownerViews(rows);
  }

  /** The project behind its link. Only its owner opens it: teams see a brief inside their invitation (D7). */
  async get(owner: AuthUser, id: string): Promise<OwnerProjectView> {
    return (await this.ownerViews([await this.requireOwn(owner, id)]))[0]!;
  }

  async requireOwn(owner: AuthUser, id: string): Promise<Project> {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id)))
      .limit(1);
    if (!project) throw new NotFoundException(NOT_YOURS);
    return project;
  }

  /** Ends the search without a pick. Invitations still open are marked not selected. */
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
        .update(invitations)
        .set({ status: 'not-selected', updatedAt: now })
        .where(and(eq(invitations.projectId, id), openInvitation(now)));
    });
    return this.get(owner, id);
  }

  /**
   * The homeowner's pick, all at once: the project is awarded, the quote selected and every other
   * open invitation not selected, with no word on prices. Only then do the two see each other's
   * name and phone (D7). Only a quote can be picked.
   */
  async select(owner: AuthUser, id: string, invitationId: string): Promise<OwnerProjectView> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [awarded] = await tx
        .update(projects)
        .set({ status: 'awarded', updatedAt: now })
        .where(and(eq(projects.id, id), eq(projects.ownerId, owner.id), eq(projects.status, 'open')))
        .returning({ id: projects.id });
      if (!awarded) await refuseNotOpen(tx, owner, id);
      const [invitation] = await tx
        .select({ status: invitations.status, expiresAt: invitations.expiresAt, teamStatus: contractorProfiles.status })
        .from(invitations)
        .innerJoin(contractorProfiles, eq(contractorProfiles.userId, invitations.contractorId))
        .where(and(eq(invitations.id, invitationId), eq(invitations.projectId, id)))
        .limit(1);
      if (!invitation) throw new NotFoundException('No such invitation on this project');
      if (invitation.status !== 'quoted') {
        throw new ConflictException(`Only a quote can be picked, and this invitation's status is ${stateOf(invitation, now)}`);
      }
      if (invitation.teamStatus !== 'verified') {
        throw new ConflictException('This team is no longer verified, so its quote cannot be picked');
      }
      await tx.update(invitations).set({ status: 'selected', updatedAt: now }).where(eq(invitations.id, invitationId));
      await tx
        .update(invitations)
        .set({ status: 'not-selected', updatedAt: now })
        .where(and(eq(invitations.projectId, id), ne(invitations.id, invitationId), openInvitation(now)));
    });
    return this.get(owner, id);
  }

  private async ownerViews(rows: Project[]): Promise<OwnerProjectView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const now = new Date();
    const seen = await this.db
      .select({
        projectId: invitations.projectId,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        priceCny: invitations.priceCny,
      })
      .from(invitations)
      .innerJoin(contractorProfiles, eq(contractorProfiles.userId, invitations.contractorId))
      .where(and(inArray(invitations.projectId, ids), visibleToOwner()));
    const picked = await this.db
      .select({
        projectId: invitations.projectId,
        invitationId: invitations.id,
        contractorId: invitations.contractorId,
        companyName: contractorProfiles.companyName,
        name: users.displayName,
        phone: users.phone,
      })
      .from(invitations)
      .innerJoin(contractorProfiles, eq(contractorProfiles.userId, invitations.contractorId))
      .innerJoin(users, eq(users.id, invitations.contractorId))
      .where(and(inArray(invitations.projectId, ids), eq(invitations.status, 'selected')));
    return rows.map((project) => {
      const theirs = seen.filter((i) => i.projectId === project.id);
      const pick = picked.find((p) => p.projectId === project.id);
      return {
        ...projectFields(project, this.siteUrl),
        closedAt: project.closedAt,
        updatedAt: project.updatedAt,
        liveInvitations: theirs.filter((i) => {
          const state = stateOf(i, now);
          return state === 'invited' || state === 'quoted';
        }).length,
        quoteCount: theirs.filter((i) => i.priceCny !== null).length,
        selected: pick
          ? {
              invitationId: pick.invitationId,
              link: invitationLink(this.siteUrl, pick.invitationId),
              contractorId: pick.contractorId,
              companyName: pick.companyName,
              contact: { name: pick.name, phone: pick.phone },
            }
          : null,
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
  if (!project) throw new NotFoundException(NOT_YOURS);
  throw new ConflictException(`This project is already ${project.status}`);
}
