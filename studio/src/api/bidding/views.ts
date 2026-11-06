// What homeowners and contractors get back about projects and bids, and the links to them.

import { eq, gt, inArray, or, type SQL } from 'drizzle-orm';
import { bids, contractorProfiles, projects, type Bid, type ContractorProfile, type Project } from '../db/schema.ts';
import type { BidStatus } from '../domain.ts';
import type { PublicProfile } from '../contractors/contractors.service.ts';

/** Links into our site (the interface, D15), one per project and one per bid. */
export const projectLink = (siteUrl: string, projectId: string) => `${siteUrl}/projects/${projectId}`;
export const bidLink = (siteUrl: string, projectId: string, bidId: string) => `${siteUrl}/projects/${projectId}/bids/${bidId}`;

/** Shared only between a homeowner and the contractor they picked (D7). */
export interface ContactCard {
  name: string;
  phone: string;
}

/** A project still takes bids: open, and its deadline hasn't passed. */
export function takingBids(now = new Date()): SQL[] {
  return [eq(projects.status, 'open'), gt(projects.bidDeadline, now)];
}

/** The projects a verified contractor can see and bid on: in their city, districts and renovation types (D21). */
export function openFor(profile: ContractorProfile, now = new Date()): SQL[] {
  return [
    ...takingBids(now),
    eq(projects.city, profile.city),
    inArray(projects.district, profile.districts),
    inArray(projects.renovationType, profile.renovationTypes),
  ];
}

/** The homeowner sees bids from contractors who are still verified, and always the one they picked. */
export function visibleToOwner(): SQL {
  return or(eq(contractorProfiles.status, 'verified'), eq(bids.status, 'selected'))!;
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
    bidDeadline: project.bidDeadline,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
  };
}

export type ProjectFields = ReturnType<typeof projectFields>;

export interface OwnerProjectView extends ProjectFields {
  closedAt: Date | null;
  updatedAt: Date;
  /** Bids the homeowner can see. */
  bidCount: number;
  /** The bid they picked, with the contractor's contact (D7). */
  selectedBid: { id: string; link: string; contractorId: string; companyName: string; contact: ContactCard } | null;
}

export interface ContractorProjectView extends ProjectFields {
  myBid: { id: string; link: string; status: BidStatus } | null;
  /** Only once the homeowner has picked this contractor's bid (D7). */
  homeowner: ContactCard | null;
}

export function bidFields(bid: Bid, siteUrl: string) {
  return {
    id: bid.id,
    link: bidLink(siteUrl, bid.projectId, bid.id),
    projectId: bid.projectId,
    priceCny: bid.priceCny,
    labourCny: bid.labourCny,
    materialsCny: bid.materialsCny,
    managementFeeCny: bid.managementFeeCny,
    durationDays: bid.durationDays,
    earliestStart: bid.earliestStart,
    mainMaterials: bid.mainMaterials,
    message: bid.message,
    status: bid.status,
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
  };
}

export type BidFields = ReturnType<typeof bidFields>;

export interface OwnerBidView extends BidFields {
  contractor: PublicProfile;
  /** Only for the bid the homeowner picked (D7). */
  contact: ContactCard | null;
}

export interface ContractorBidView extends BidFields {
  project: Pick<ProjectFields, 'id' | 'link' | 'title' | 'city' | 'district' | 'status' | 'bidDeadline'>;
  homeowner: ContactCard | null;
}
