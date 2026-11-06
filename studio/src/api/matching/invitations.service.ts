import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, notInArray, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import { ContractorsService, publicProfile } from '../contractors/contractors.service.ts';
import type { Db } from '../db/database.ts';
import { contractorProfiles, invitations, projects, users, type Invitation } from '../db/schema.ts';
import { INVITATION_DAYS, MAX_LIVE_INVITATIONS } from '../domain.ts';
import { CONFIG, DB } from '../tokens.ts';
import { refuseContactDetails, todayInChina } from '../validation.ts';
import { hasRoom, isEligible, shortlist } from './fit.ts';
import type { DeclineDto, InviteDto, MatchesQueryDto, QuoteDto } from './matching.dto.ts';
import { ProjectsService } from './projects.service.ts';
import {
  invitationFields,
  openInvitation,
  projectBrief,
  stateOf,
  visibleToOwner,
  type ContractorInvitationView,
  type InvitationState,
  type MatchView,
  type OwnerInvitationView,
} from './views.ts';

/** Something that can run a query: the database, or a transaction on it. */
type Reader = Pick<Db, 'select'>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MATCHES = 5;
const CHANGED = 'This invitation changed while you were answering it: reload it and try again';

/** Why an invitation can't be answered any more, in words for the team. */
const CANNOT_ANSWER: Record<Exclude<InvitationState, 'invited'>, string> = {
  expired: `This invitation has expired: teams have ${INVITATION_DAYS} days to answer`,
  declined: 'You declined this invitation',
  quoted: 'You have already sent a quote, so you can no longer decline it: the homeowner decides',
  selected: 'The homeowner has picked your quote, so it can no longer change',
  'not-selected': 'The homeowner has already decided on this project',
};

@Injectable()
export class InvitationsService {
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

  /**
   * The verified teams that suit the homeowner's project, best fit first, each with the reasons (D23).
   * Teams already invited to this project are left out, and so are teams with all the invitations
   * they can take already open. Nothing here depends on a quote or on money paid to us (D17).
   */
  async matches(owner: AuthUser, projectId: string, query: MatchesQueryDto): Promise<MatchView[]> {
    const project = await this.projects.requireOwn(owner, projectId);
    if (project.status !== 'open') throw new ConflictException(`This project is already ${project.status}`);
    const alreadyInvited = this.db.select({ id: invitations.contractorId }).from(invitations).where(eq(invitations.projectId, projectId));
    // The district and the kind of renovation are judged by `shortlist`, which holds the rules.
    const teams = await this.db
      .select()
      .from(contractorProfiles)
      .where(
        and(
          eq(contractorProfiles.status, 'verified'),
          eq(contractorProfiles.city, project.city),
          notInArray(contractorProfiles.userId, alreadyInvited),
        ),
      );
    const open = await openInvitationCounts(
      this.db,
      teams.map((team) => team.userId),
      new Date(),
    );
    return shortlist(project, teams, open, query.limit ?? DEFAULT_MATCHES).map(({ team, fit }) => ({
      contractor: publicProfile(team),
      fit: fit.tier,
      reasons: fit.reasons,
    }));
  }

  /**
   * The homeowner invites one matched team to look at the project. At most `MAX_LIVE_INVITATIONS`
   * can be open at once, and a team can't be invited past the projects it can take at once (D23).
   */
  async invite(owner: AuthUser, projectId: string, dto: InviteDto): Promise<OwnerInvitationView> {
    refuseContactDetails({ message: dto.message });
    const id = await this.db.transaction(async (tx) => {
      const now = new Date();
      // Locking the project and the team makes invitations sent at the same moment count one after
      // the other, so the limits hold.
      const [project] = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, owner.id)))
        .limit(1)
        .for('update');
      if (!project) throw new NotFoundException('No such project of yours');
      if (project.status !== 'open') throw new ConflictException(`This project is already ${project.status}`);
      const [team] = await tx
        .select()
        .from(contractorProfiles)
        .where(eq(contractorProfiles.userId, dto.contractorId))
        .limit(1)
        .for('update');
      if (!team || !isEligible(team, project)) {
        throw new NotFoundException('No verified team with this id works in your district on this kind of renovation');
      }
      const [already] = await tx
        .select({ id: invitations.id })
        .from(invitations)
        .where(and(eq(invitations.projectId, projectId), eq(invitations.contractorId, team.userId)))
        .limit(1);
      if (already) throw new ConflictException('You have already invited this team to this project');
      const [live] = await tx
        .select({ open: count() })
        .from(invitations)
        .innerJoin(contractorProfiles, eq(contractorProfiles.userId, invitations.contractorId))
        .where(and(eq(invitations.projectId, projectId), openInvitation(now), visibleToOwner()));
      if (live!.open >= MAX_LIVE_INVITATIONS) {
        throw new ConflictException(
          `You can have ${MAX_LIVE_INVITATIONS} invitations open at once: wait for answers (an invitation lapses after ${INVITATION_DAYS} days)`,
        );
      }
      const busy = (await openInvitationCounts(tx, [team.userId], now)).get(team.userId) ?? 0;
      if (!hasRoom(team, busy)) throw new ConflictException('This team has as many invitations open as it can take right now');
      const [invitation] = await tx
        .insert(invitations)
        .values({
          projectId,
          contractorId: team.userId,
          message: dto.message ?? '',
          expiresAt: new Date(now.getTime() + INVITATION_DAYS * DAY_MS),
        })
        .returning({ id: invitations.id });
      return invitation!.id;
    });
    return (await this.ownerViews([eq(invitations.id, id)]))[0]!;
  }

  /** The invitations on a homeowner's project, in the order they were sent. There is no ranking by price (D23). */
  async listForOwner(owner: AuthUser, projectId: string): Promise<OwnerInvitationView[]> {
    await this.projects.requireOwn(owner, projectId);
    return this.ownerViews([eq(invitations.projectId, projectId)], [asc(invitations.createdAt), asc(invitations.id)]);
  }

  async listMine(contractor: AuthUser): Promise<ContractorInvitationView[]> {
    const rows = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.contractorId, contractor.id))
      .orderBy(desc(invitations.createdAt), asc(invitations.id));
    return this.contractorViews(rows);
  }

  /** The invitation behind its link: for the team it was sent to, or the homeowner who sent it. */
  async get(user: AuthUser, id: string): Promise<ContractorInvitationView | OwnerInvitationView> {
    if (user.role === 'contractor') return (await this.contractorViews([await this.findOwn(user, id)]))[0]!;
    const ownProjects = this.db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, user.id));
    const [view] = await this.ownerViews([eq(invitations.id, id), inArray(invitations.projectId, ownProjects)]);
    if (!view) throw new NotFoundException('No such invitation on your projects');
    return view;
  }

  /** The team says no. Only while the invitation waits for an answer. */
  async decline(contractor: AuthUser, id: string, dto: DeclineDto): Promise<ContractorInvitationView> {
    await this.contractors.requireVerified(contractor.id);
    const existing = await this.findOwn(contractor, id);
    const state = stateOf(existing);
    if (state !== 'invited') throw new ConflictException(CANNOT_ANSWER[state]);
    refuseContactDetails({ reason: dto.reason });
    const now = new Date();
    const [declined] = await this.db
      .update(invitations)
      .set({ status: 'declined', declineReason: dto.reason || null, respondedAt: now, updatedAt: now })
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.contractorId, contractor.id),
          eq(invitations.status, 'invited'),
          gt(invitations.expiresAt, now),
        ),
      )
      .returning();
    if (!declined) throw new ConflictException(CHANGED);
    return (await this.contractorViews([declined]))[0]!;
  }

  /** The team's one quote. Sending it again replaces it, until the homeowner picks or the search ends. */
  async quote(contractor: AuthUser, id: string, dto: QuoteDto): Promise<ContractorInvitationView> {
    await this.contractors.requireVerified(contractor.id);
    const existing = await this.findOwn(contractor, id);
    const state = stateOf(existing);
    if (state !== 'invited' && state !== 'quoted') throw new ConflictException(CANNOT_ANSWER[state]);
    checkQuote(dto);
    const now = new Date();
    const [quoted] = await this.db
      .update(invitations)
      .set({ ...quoteValues(dto), status: 'quoted', respondedAt: existing.respondedAt ?? now, updatedAt: now })
      .where(and(eq(invitations.id, id), eq(invitations.contractorId, contractor.id), openInvitation(now)))
      .returning();
    if (!quoted) throw new ConflictException(CHANGED);
    return (await this.contractorViews([quoted]))[0]!;
  }

  private async findOwn(contractor: AuthUser, id: string): Promise<Invitation> {
    const [invitation] = await this.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, id), eq(invitations.contractorId, contractor.id)))
      .limit(1);
    if (!invitation) throw new NotFoundException('No such invitation of yours');
    return invitation;
  }

  /** What a homeowner sees: invitations to teams that are still verified, and always the one they picked. */
  private async ownerViews(conditions: SQL[], order: SQL[] = []): Promise<OwnerInvitationView[]> {
    const now = new Date();
    const rows = await this.db
      .select({ invitation: invitations, profile: contractorProfiles, name: users.displayName, phone: users.phone })
      .from(invitations)
      .innerJoin(contractorProfiles, eq(contractorProfiles.userId, invitations.contractorId))
      .innerJoin(users, eq(users.id, invitations.contractorId))
      .where(and(visibleToOwner(), ...conditions))
      .orderBy(...order);
    return rows.map((row) => ({
      ...invitationFields(row.invitation, this.siteUrl, now),
      projectId: row.invitation.projectId,
      contractor: publicProfile(row.profile),
      contact: row.invitation.status === 'selected' ? { name: row.name, phone: row.phone } : null,
    }));
  }

  /** What a team sees: the project's brief, its own answer, and the homeowner's contact once picked. */
  private async contractorViews(rows: Invitation[]): Promise<ContractorInvitationView[]> {
    if (rows.length === 0) return [];
    const found = await this.db
      .select({ project: projects, name: users.displayName, phone: users.phone })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .where(
        inArray(
          projects.id,
          rows.map((invitation) => invitation.projectId),
        ),
      );
    const now = new Date();
    return rows.map((invitation) => {
      const { project, name, phone } = found.find((f) => f.project.id === invitation.projectId)!;
      return {
        ...invitationFields(invitation, this.siteUrl, now),
        project: projectBrief(project),
        homeowner: invitation.status === 'selected' ? { name, phone } : null,
      };
    });
  }
}

/** How many invitations each of these teams has open right now, across all projects (D23). */
async function openInvitationCounts(reader: Reader, teamIds: string[], now: Date): Promise<Map<string, number>> {
  if (teamIds.length === 0) return new Map();
  const rows = await reader
    .select({ contractorId: invitations.contractorId, open: count() })
    .from(invitations)
    .where(and(inArray(invitations.contractorId, teamIds), openInvitation(now)))
    .groupBy(invitations.contractorId);
  return new Map(rows.map((row) => [row.contractorId, row.open]));
}

function quoteValues(dto: QuoteDto) {
  return {
    priceCny: dto.priceCny,
    labourCny: dto.labourCny ?? null,
    materialsCny: dto.materialsCny ?? null,
    managementFeeCny: dto.managementFeeCny ?? null,
    durationDays: dto.durationDays,
    earliestStart: dto.earliestStart,
    mainMaterials: dto.mainMaterials ?? '',
    quoteNote: dto.note ?? '',
  };
}

/** The rules a quote must meet, on top of each field's own checks. */
function checkQuote(dto: QuoteDto): void {
  const parts = (dto.labourCny ?? 0) + (dto.materialsCny ?? 0) + (dto.managementFeeCny ?? 0);
  if (parts > dto.priceCny) throw new BadRequestException('Labour, materials and the management fee add up to more than priceCny');
  if (dto.earliestStart < todayInChina()) throw new BadRequestException('earliestStart must be today or later');
  refuseContactDetails({ mainMaterials: dto.mainMaterials, note: dto.note });
}
