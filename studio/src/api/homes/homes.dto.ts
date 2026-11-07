import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Trim } from '../validation.ts';

/** A new home: its title and its plan in the F2 format (`studio/docs/plan-format.md`). */
export class CreateHomeDto {
  /** The home's title, for example 三室两厅两卫. */
  @Trim()
  @IsString()
  @Length(1, 120)
  name!: string;

  /** The plan document. Its shape is checked against the F2 format in the service. */
  @IsObject()
  plan!: Record<string, unknown>;
}

/** A home read from a floor-plan photo (N4): one of the uploads, already checked and cleaned. */
export class CreateFromImageDto {
  @IsUUID()
  uploadId!: string;

  /** The home's title. Defaults to the name the model read off the drawing. */
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 120)
  name?: string;
}

/** One saved design version (F6): the state floorplan-3d's "Export plan JSON" writes. */
export class SaveDesignDto {
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 300)
  note?: string;
}
