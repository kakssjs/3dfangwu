import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { RENOVATION_TYPES, type RenovationType } from '../domain.ts';
import { IsDateOnly, Trim } from '../validation.ts';

const MAX_CNY = 100_000_000;

/**
 * A homeowner's renovation requirements, published as a project for verified contractors to bid on
 * (D21). Never the homeowner's name, contact or address: contractors see only what is here (D7).
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

  @IsIn(RENOVATION_TYPES)
  renovationType!: RenovationType;

  /** For example 现代简约 or 奶油风. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  style?: string;

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

  /** Days contractors have to bid. Default 7. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  biddingDays?: number;

  /** What to do, room by room, and what matters to the homeowner. */
  @Trim()
  @IsString()
  @Length(10, 5000)
  description!: string;
}

export class OpenProjectsQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  district?: string;

  @IsOptional()
  @IsIn(RENOVATION_TYPES)
  renovationType?: RenovationType;
}

/** A contractor's bid. Labour, materials and the management fee are optional parts of the price. */
export class BidDto {
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

  /** The contractor's note and suggestions on the design. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(5000)
  message?: string;
}

export const BID_SORTS = ['submitted', 'price', 'duration', 'experience'] as const;
export type BidSort = (typeof BID_SORTS)[number];

/** The homeowner's filters and order for the bids. The platform ranks nothing (WORKFLOW.md section 4.6). */
export class BidQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDurationDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minYearsInBusiness?: number;

  /** Only bids that can start on or before this date. */
  @IsOptional()
  @IsDateOnly()
  startBy?: string;

  @IsOptional()
  @IsIn(BID_SORTS)
  sort?: BidSort;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class SelectBidDto {
  @IsUUID()
  bidId!: string;
}
