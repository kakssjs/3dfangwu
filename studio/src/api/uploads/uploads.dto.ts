import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Trim } from '../validation.ts';

/** What we take (N19: images, PDFs and spreadsheets), as the sender claims it. */
export const UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

/**
 * One file, as JSON: the bytes are base64. The content check decides what it really is — a file
 * that isn't what `contentType` claims is refused (N19).
 */
export class UploadDto {
  /** The name the sender gives it. No folders in it. */
  @Trim()
  @IsString()
  @Length(1, 200)
  @Matches(/^[^/\\]+$/)
  filename!: string;

  @IsIn(UPLOAD_CONTENT_TYPES)
  contentType!: UploadContentType;

  /** The file's bytes, base64. At most 8 MB once decoded. */
  @IsString()
  @Length(4, 11_200_000)
  dataBase64!: string;

  /** Send it for one of your projects, to keep it with the project. */
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
