// Homes and their design versions (F1, F6; WORKFLOW.md build order 9): one home holds its plan in
// the F2 format and the numbered design versions the homeowner saves from floorplan-3d. The home's
// private 3D link opens the editor on our site and is the only key the editor needs (D7: a link for
// every home, like the project and invitation links).

import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { MimoClient, MimoError } from '../agents/mimo.ts';
import type { AuthUser } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import type { Db } from '../db/database.ts';
import { designVersions, homes, type Home } from '../db/schema.ts';
import { CONFIG, DB, BACKUP_READERS } from '../tokens.ts';
import { UploadsService } from '../uploads/uploads.service.ts';
import { UnreadablePlan, planOverlaySvg, readFloorPlan, type FloorPlanReading } from './floor-plan.ts';
import { validateDesignState, validatePlan, type DesignState, type PlanDocument } from './plan-format.ts';
import type { CreateFromImageDto, CreateHomeDto, SaveDesignDto } from './homes.dto.ts';

/** The home's 3D link: the editor page, served by our app at this route (F1). */
export const plan3dLink = (siteUrl: string, token: string) => `${siteUrl}/plan3d/${token}`;

/** The overlay image (N4): the source photo with the reading drawn over it, for the eye-check. */
export const planOverlayLink = (siteUrl: string, homeId: string) => `${siteUrl}/api/homes/${homeId}/plan-overlay.svg`;

export interface HomeFields {
  id: string;
  name: string;
  link: string;
  confirmedDesign: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignVersionFields {
  number: number;
  note: string;
  createdAt: Date;
}

export interface HomeView extends HomeFields {
  plan: PlanDocument;
  designs: DesignVersionFields[];
}

/** What the editor loads from the 3D link (F1): the plan and every saved version with its state. */
export interface PlanLinkView extends HomeFields {
  homeId: string;
  plan: PlanDocument;
  confirmedDesign: number | null;
  designs: (DesignVersionFields & { data: DesignState })[];
}

/** A home just read from a floor-plan photo (N4): everything above, plus the overlay to check. */
export interface HomeFromImage extends HomeView {
  overlay: string;
}

@Injectable()
export class HomesService {
  private readonly db: Db;
  private readonly siteUrl: string;
  private readonly mimo: MimoClient;
  private readonly backups: MimoClient[];
  private readonly uploads: UploadsService;

  constructor(@Inject(DB) db: Db, @Inject(CONFIG) config: StudioConfig, mimo: MimoClient, uploads: UploadsService, @Inject(BACKUP_READERS) backups: MimoClient[]) {
    this.db = db;
    this.siteUrl = config.siteUrl;
    this.mimo = mimo;
    this.backups = backups;
    this.uploads = uploads;
  }

  async create(user: AuthUser, dto: CreateHomeDto): Promise<HomeFields> {
    const plan = checkedPlan(dto.plan);
    const [home] = await this.db
      .insert(homes)
      .values({
        ownerId: user.id,
        name: dto.name,
        plan,
        linkToken: newToken(),
      })
      .returning();
    return homeFields(home!, this.siteUrl);
  }

  /**
   * N4: the homeowner's floor-plan photo, read into a plan document by the model, checked against
   * the F2 format, and kept as a new home with its 3D link. The overlay comes with it so a person
   * can check the reading by eye (WORKFLOW.md section 8); what is wrong, they fix in the editor.
   */
  async createFromImage(user: AuthUser, dto: CreateFromImageDto): Promise<HomeFromImage> {
    const upload = await this.uploads.get(user, dto.uploadId);
    if (!upload.contentType.startsWith('image/')) throw new BadRequestException('The file is not an image');
    const dataUrl = `data:${upload.contentType};base64,${upload.dataBase64}`;
    let reading;
    try {
      reading = await this.readPlan(dataUrl);
    } catch (error) {
      if (error instanceof UnreadablePlan) {
        throw new BadRequestException(`This floor plan could not be read into a valid plan: ${error.message}`);
      }
      if (error instanceof MimoError) {
        throw new ServiceUnavailableException(`The floor-plan reader is unavailable: ${error.message}`);
      }
      throw error;
    }
    const plan = reading.plan;
    const [home] = await this.db
      .insert(homes)
      .values({
        ownerId: user.id,
        name: dto.name ?? plan.name ?? 'My home',
        plan,
        linkToken: newToken(),
        sourceUploadId: upload.id,
      })
      .returning();
    return {
      ...homeFields(home!, this.siteUrl),
      plan,
      designs: [],
      overlay: planOverlayLink(this.siteUrl, home!.id),
    };
  }

  /** N4's overlay for one home: the source photo with the reading drawn over it (an SVG image). */
  async planOverlay(user: AuthUser, id: string): Promise<string> {
    const home = await this.ownedHome(user, id);
    let photo: string | undefined;
    if (home.sourceUploadId) {
      try {
        const upload = await this.uploads.get(user, home.sourceUploadId);
        photo = `data:${upload.contentType};base64,${upload.dataBase64}`;
      } catch {
        // The photo is gone (deleted on request, N18): draw the reading alone.
      }
    }
    return planOverlaySvg(home.plan, photo);
  }

  async listOwn(user: AuthUser): Promise<HomeFields[]> {
    const rows = await this.db.select().from(homes).where(eq(homes.ownerId, user.id)).orderBy(desc(homes.createdAt));
    return rows.map((home) => homeFields(home, this.siteUrl));
  }

  async getOwn(user: AuthUser, id: string): Promise<HomeView> {
    const home = await this.ownedHome(user, id);
    const versions = await this.db
      .select({ number: designVersions.number, note: designVersions.note, createdAt: designVersions.createdAt })
      .from(designVersions)
      .where(eq(designVersions.homeId, home.id))
      .orderBy(designVersions.number);
    return { ...homeFields(home, this.siteUrl), plan: home.plan, designs: versions };
  }

  /** A new private link for the home. The old link stops working at once. */
  async rotateLink(user: AuthUser, id: string): Promise<HomeFields> {
    const home = await this.ownedHome(user, id);
    const [updated] = await this.db
      .update(homes)
      .set({ linkToken: newToken(), updatedAt: new Date() })
      .where(eq(homes.id, home.id))
      .returning();
    return homeFields(updated!, this.siteUrl);
  }

  async saveDesign(user: AuthUser, id: string, dto: SaveDesignDto): Promise<DesignVersionFields> {
    const home = await this.ownedHome(user, id);
    return this.addVersion(home, dto);
  }

  async confirmDesign(user: AuthUser, id: string, number: number): Promise<HomeFields> {
    const home = await this.ownedHome(user, id);
    const [version] = await this.db
      .select({ number: designVersions.number })
      .from(designVersions)
      .where(and(eq(designVersions.homeId, home.id), eq(designVersions.number, number)))
      .limit(1);
    if (!version) throw new NotFoundException(`Design version ${number} does not exist`);
    const [updated] = await this.db
      .update(homes)
      .set({ confirmedDesign: number, updatedAt: new Date() })
      .where(eq(homes.id, home.id))
      .returning();
    return homeFields(updated!, this.siteUrl);
  }

  /** The 3D link's view (F1): the plan and every design version with its state. The token is the key. */
  async getByToken(token: string): Promise<PlanLinkView> {
    const home = await this.homeByToken(token);
    const versions = await this.db
      .select()
      .from(designVersions)
      .where(eq(designVersions.homeId, home.id))
      .orderBy(designVersions.number);
    return {
      ...homeFields(home, this.siteUrl),
      homeId: home.id,
      plan: home.plan,
      designs: versions.map((v) => ({ number: v.number, note: v.note, createdAt: v.createdAt, data: v.data })),
    };
  }

  /** F6 from the editor: the homeowner's edits, saved as the next numbered version. */
  async saveDesignByToken(token: string, dto: SaveDesignDto): Promise<DesignVersionFields> {
    const home = await this.homeByToken(token);
    return this.addVersion(home, dto);
  }

  /** F6 from the editor: the version the homeowner confirms. */
  async confirmDesignByToken(token: string, number: number): Promise<HomeFields> {
    const home = await this.homeByToken(token);
    const [version] = await this.db
      .select({ number: designVersions.number })
      .from(designVersions)
      .where(and(eq(designVersions.homeId, home.id), eq(designVersions.number, number)))
      .limit(1);
    if (!version) throw new NotFoundException(`Design version ${number} does not exist`);
    const [updated] = await this.db
      .update(homes)
      .set({ confirmedDesign: number, updatedAt: new Date() })
      .where(eq(homes.id, home.id))
      .returning();
    return homeFields(updated!, this.siteUrl);
  }

  /**
   * N4's reader: MiMo first (the event's model, D9); then the boss's backup readers in order —
   * Doubao (豆包), then Agnes AI — whenever a channel is down or its reading fails the checks
   * twice. None answers: the error names each channel's reason.
   */
  private async readPlan(dataUrl: string): Promise<FloorPlanReading> {
    const readers = [this.mimo, ...this.backups];
    const reasons: string[] = [];
    for (let i = 0; i < readers.length; i++) {
      try {
        return await readFloorPlan(readers[i]!, dataUrl);
      } catch (error) {
        const down = error instanceof MimoError;
        if (!down && !(error instanceof UnreadablePlan)) throw error;
        reasons.push(`${down ? 'down' : 'unreadable'}: ${error instanceof Error ? error.message : String(error)}`);
        if (i === readers.length - 1) {
          if (down) throw new MimoError(reasons.join('; '));
          throw error;
        }
      }
    }
    throw new MimoError('no floor-plan reader is configured');
  }

  private async addVersion(home: Home, dto: SaveDesignDto): Promise<DesignVersionFields> {
    const data = checkedDesign(dto.data);
    // The number is the next one; the unique index (home_id, number) backstops two saves at once.
    for (let attempt = 0; ; attempt++) {
      const [{ max }] = await this.db
        .select({ max: sql<number>`coalesce(max(${designVersions.number}), 0)` })
        .from(designVersions)
        .where(eq(designVersions.homeId, home.id));
      try {
        const [version] = await this.db
          .insert(designVersions)
          .values({ homeId: home.id, number: max + 1, data, note: dto.note ?? '' })
          .returning();
        return { number: version!.number, note: version!.note, createdAt: version!.createdAt };
      } catch (error) {
        if (attempt < 2 && isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }

  private async ownedHome(user: AuthUser, id: string): Promise<Home> {
    const [home] = await this.db.select().from(homes).where(eq(homes.id, id)).limit(1);
    // Not found, or not yours to see: the same answer either way (D7).
    if (!home || home.ownerId !== user.id) throw new NotFoundException('No such home');
    return home;
  }

  private async homeByToken(token: string): Promise<Home> {
    const [home] = await this.db.select().from(homes).where(eq(homes.linkToken, token)).limit(1);
    if (!home) throw new NotFoundException('No home behind this link');
    return home;
  }
}

function checkedPlan(value: Record<string, unknown>): PlanDocument {
  const errors = validatePlan(value);
  if (errors.length) throw new BadRequestException(errors.map((e) => `${e}`).join('; '));
  return value as unknown as PlanDocument;
}

function checkedDesign(value: Record<string, unknown>): DesignState {
  const errors = validateDesignState(value);
  if (errors.length) throw new BadRequestException(errors.join('; '));
  return value as unknown as DesignState;
}

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

function homeFields(home: Home, siteUrl: string): HomeFields {
  return {
    id: home.id,
    name: home.name,
    link: plan3dLink(siteUrl, home.linkToken),
    confirmedDesign: home.confirmedDesign,
    createdAt: home.createdAt,
    updatedAt: home.updatedAt,
  };
}
