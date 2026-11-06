import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { DESIGN_STYLES, RENOVATION_TYPES, type DesignStyle, type RenovationType } from '../domain.ts';
import { IsDateOnly, Trim } from '../validation.ts';

const MAX_CNY = 100_000_000;

/**
 * A homeowner's renovation requirements. Only the teams they invite see it (D23), and never the
 * homeowner's name, contact or address: invited teams see only what is here (D7).
 */
export class CreateProjectDto {
  @Trim()
  @IsString()
  @Length(2, 80)
  title!: string;

  @Trim()
  @IsString()
  @Length(1, 40)
  city!: string;

  @Trim()
  @IsString()
  @Length(1, 40)
  district!: string;

  /** 建筑面积 in m². */
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(5)
  @Max(10_000)
  floorAreaM2!: number;

  /** For example 3室2厅2卫. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  layout?: string;

  /** The community found on the map. Only the owner sees it. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  community?: string;

  @IsIn(RENOVATION_TYPES)
  renovationType!: RenovationType;

  /** The style they chose, if they have: matching compares it with the styles each team works in. */
  @IsOptional()
  @IsIn(DESIGN_STYLES)
  style?: DesignStyle;

  @IsInt()
  @Min(1_000)
  @Max(MAX_CNY)
  budgetMinCny!: number;

  @IsInt()
  @Min(1_000)
  @Max(MAX_CNY)
  budgetMaxCny!: number;

  @IsDateOnly()
  desiredStart!: string;

  /** What to do, room by room, and what matters to the homeowner. */
  @Trim()
  @IsString()
  @Length(10, 5000)
  description!: string;
}

export class MatchesQueryDto {
  /** How many teams to suggest. Default 5. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

export class InviteDto {
  /** The team's id: `id` in a match or in a contractor's profile. */
  @IsUUID()
  contractorId!: string;

  /** A note to the team. Never a phone number or email: contacts come only after the pick (D7). */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

/** A team's one quote on an invitation. Labour, materials and the management fee are optional parts of the price. */
export class QuoteDto {
  @IsInt()
  @Min(1_000)
  @Max(MAX_CNY)
  priceCny!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CNY)
  labourCny?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CNY)
  materialsCny?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CNY)
  managementFeeCny?: number;

  @IsInt()
  @Min(1)
  @Max(1_000)
  durationDays!: number;

  @IsDateOnly()
  earliestStart!: string;

  /** Brands and models of the main materials. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  mainMaterials?: string;

  /** The team's note and suggestions on the design. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(5000)
  note?: string;
}

export class DeclineDto {
  /** Shown to the homeowner. Optional. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SelectDto {
  @IsUUID()
  invitationId!: string;
}
