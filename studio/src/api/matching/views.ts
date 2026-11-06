// What homeowners and invited teams get back about projects, matches, invitations and quotes, and
// the links to them. Each rule about who sees what lives here once (D7, D23).

import { and, eq, gt, or, type SQL } from 'drizzle-orm';
import type { PublicProfile } from '../contractors/contractors.service.ts';
import { contractorProfiles, invitations, type Invitation, type Project } from '../db/schema.ts';
import type { InvitationStatus } from '../domain.ts';
import type { FitReason, FitTier } from './fit.ts';

/** Links into our site (the interface, D15): one per project and one per invitation. */
export const projectLink = (siteUrl: string, projectId: string) => `${siteUrl}/projects/${projectId}`;
export const invitationLink = (siteUrl: string, invitationId: string) => `${siteUrl}/invitations/${invitationId}`;

/** Shared only between a homeowner and the team they picked (D7). */
export interface ContactCard {
  name: string;
  phone: string;
}

/** The stored status, or `expired` for an invitation nobody answered in time. */
export type InvitationState = InvitationStatus | 'expired';

export function stateOf(invitation: Pick<Invitation, 'status' | 'expiresAt'>, now = new Date()): InvitationState {
  return invitation.status === 'invited' && invitation.expiresAt <= now ? 'expired' : invitation.status;
}

/** An invitation that still counts: waiting for the team's answer, or quoted and waiting for the homeowner. */
export function openInvitation(now = new Date()): SQL {
  return or(and(eq(invitations.status, 'invited'), gt(invitations.expiresAt, now)), eq(invitations.status, 'quoted'))!;
}

/** The homeowner sees invitations to teams that are still verified, and always the one they picked. */
export function visibleToOwner(): SQL {
  return or(eq(contractorProfiles.status, 'verified'), eq(invitations.status, 'selected'))!;
}

export function projectFields(project: Project, siteUrl: string) {
  return {
    id: project.id,
    link: projectLink(siteUrl, project.id),
    title: project.title,
    city: project.city,
    district: project.district,
    floorAreaM2: project.floorAreaM2,
    layout: project.layout,
    renovationType: project.renovationType,
    style: project.style,
    budgetMinCny: project.budgetMinCny,
    budgetMaxCny: project.budgetMaxCny,
    desiredStart: project.desiredStart,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
  };
}

export type ProjectFields = ReturnType<typeof projectFields>;

/** What an invited team sees of a project: no id or link, which only the owner opens (D7). */
export function projectBrief(project: Project) {
  return {
    title: project.title,
    city: project.city,
    district: project.district,
    floorAreaM2: project.floorAreaM2,
    layout: project.layout,
    renovationType: project.renovationType,
    style: project.style,
    budgetMinCny: project.budgetMinCny,
    budgetMaxCny: project.budgetMaxCny,
    desiredStart: project.desiredStart,
    description: project.description,
    status: project.status,
  };
}

export type ProjectBrief = ReturnType<typeof projectBrief>;

export interface OwnerProjectView extends ProjectFields {
  closedAt: Date | null;
  updatedAt: Date;
  /** Invitations that are open: waiting for an answer, or quoted. At most 3 at a time. */
  liveInvitations: number;
  /** Quotes received so far, including those from teams that were not picked. */
  quoteCount: number;
  /** The quote they picked, with the team's contact (D7). */
  selected: { invitationId: string; link: string; contractorId: string; companyName: string; contact: ContactCard } | null;
}

/** The team's one quote on an invitation. */
export interface Quote {
  priceCny: number;
  labourCny: number | null;
  materialsCny: number | null;
  managementFeeCny: number | null;
  durationDays: number;
  earliestStart: string;
  mainMaterials: string;
  note: string;
}

function quoteOf(invitation: Invitation): Quote | null {
  if (invitation.priceCny === null || invitation.durationDays === null || invitation.earliestStart === null) return null;
  return {
    priceCny: invitation.priceCny,
    labourCny: invitation.labourCny,
    materialsCny: invitation.materialsCny,
    managementFeeCny: invitation.managementFeeCny,
    durationDays: invitation.durationDays,
    earliestStart: invitation.earliestStart,
    mainMaterials: invitation.mainMaterials,
    note: invitation.quoteNote,
  };
}

export function invitationFields(invitation: Invitation, siteUrl: string, now = new Date()) {
  return {
    id: invitation.id,
    link: invitationLink(siteUrl, invitation.id),
    status: stateOf(invitation, now),
    message: invitation.message,
    declineReason: invitation.declineReason,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt,
    quote: quoteOf(invitation),
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

export type InvitationFields = ReturnType<typeof invitationFields>;

/** What the homeowner sees: the team's public profile and quote, and its contact only once picked (D7). */
export interface OwnerInvitationView extends InvitationFields {
  projectId: string;
  contractor: PublicProfile;
  contact: ContactCard | null;
}

/** What the invited team sees: the project's brief and its own quote, and the homeowner's contact only once picked (D7). */
export interface ContractorInvitationView extends InvitationFields {
  project: ProjectBrief;
  homeowner: ContactCard | null;
}

/** One suggested team: its public profile, how well it fits and why. */
export interface MatchView {
  contractor: PublicProfile;
  fit: FitTier;
  reasons: FitReason[];
}
