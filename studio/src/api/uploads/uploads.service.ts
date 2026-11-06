// Files people send us (N19): checked by content and size, photo metadata removed (N18), and
// stored under the files folder, with the record in the database saying what it is and who may
// see it — its owner today; a project's people when uploads go with invitations (N23).

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import type { Db } from '../db/database.ts';
import { projects, uploads, type Upload } from '../db/schema.ts';
import { CONFIG, DB } from '../tokens.ts';
import { UnsafeImageError, isImage, sniffContentType, stripImageMetadata } from './image-metadata.ts';
import type { UploadDto } from './uploads.dto.ts';

/** A photo is a few MB; a scan of a licence or a quote can be more. 8 MB covers all of them. */
const MAX_BYTES = 8 * 1024 * 1024;

export interface UploadView {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  projectId: string | null;
  createdAt: Date;
}

export interface UploadFile extends UploadView {
  /** The bytes, base64: photos come back with their metadata already gone. */
  dataBase64: string;
}

@Injectable()
export class UploadsService {
  private readonly db: Db;
  private readonly filesDir: string;

  constructor(@Inject(DB) db: Db, @Inject(CONFIG) config: StudioConfig) {
    this.db = db;
    this.filesDir = config.filesDir;
  }

  async create(user: AuthUser, dto: UploadDto): Promise<UploadView> {
    const bytes = decodeBase64(dto.dataBase64);
    if (bytes.length === 0) throw new BadRequestException('dataBase64 holds no bytes');
    if (bytes.length > MAX_BYTES) throw new BadRequestException('This file is over 8 MB');
    // What it claims is only a claim: the bytes decide, and both must agree (N19).
    const kind = sniffContentType(bytes);
    if (!kind || kind.contentType !== dto.contentType) {
      throw new BadRequestException(`This file's content is not ${dto.contentType}: send what it really is`);
    }
    let stored = bytes;
    if (isImage(kind.contentType)) {
      try {
        stored = stripImageMetadata(bytes, kind.contentType);
      } catch (error) {
        if (error instanceof UnsafeImageError) {
          throw new BadRequestException("We can't remove this photo's metadata, so we can't store it");
        }
        throw error;
      }
    }
    if (dto.projectId) await this.requireOwnProject(user, dto.projectId);

    const id = randomUUID();
    const storagePath = path.join('uploads', `${id}${kind.extension}`);
    await mkdir(path.join(this.filesDir, 'uploads'), { recursive: true });
    await writeFile(path.join(this.filesDir, storagePath), stored);
    const [row] = await this.db
      .insert(uploads)
      .values({
        id,
        ownerId: user.id,
        projectId: dto.projectId ?? null,
        filename: dto.filename,
        contentType: kind.contentType,
        sizeBytes: stored.length,
        storagePath,
      })
      .returning();
    return view(row!);
  }

  /** The file back, for its owner. */
  async get(user: AuthUser, id: string): Promise<UploadFile> {
    const [row] = await this.db.select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.ownerId, user.id))).limit(1);
    if (!row) throw new NotFoundException('No such upload of yours');
    const bytes = await readFile(path.join(this.filesDir, row.storagePath));
    return { ...view(row), dataBase64: bytes.toString('base64') };
  }

  private async requireOwnProject(user: AuthUser, projectId: string): Promise<void> {
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!project) throw new NotFoundException('No such project of yours');
  }
}

function view(row: Upload): UploadView {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    projectId: row.projectId,
    createdAt: row.createdAt,
  };
}

/**
 * Strict base64: Node's decoder forgives junk, so the shape is checked first. 4 characters to
 * every 3 bytes, with `=` padding at the end only.
 */
function decodeBase64(value: string): Buffer {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new BadRequestException('dataBase64 is not valid base64');
  }
  return Buffer.from(value, 'base64');
}
