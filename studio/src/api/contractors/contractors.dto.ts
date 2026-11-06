import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CONTRACTOR_KINDS,
  CONTRACTOR_STATUSES,
  DESIGN_STYLES,
  LICENCE_NUMBER,
  RENOVATION_TYPES,
  REVIEW_DECISIONS,
  type ContractorKind,
  type ContractorStatus,
  type DesignStyle,
  type RenovationType,
  type ReviewDecision,
} from '../domain.ts';
import { IsDateOnly, NormalizeLicence, Trim, TrimEach } from '../validation.ts';

export class QualificationDto {
  /** For example 建筑装修装饰工程专业承包二级. */
  @Trim()
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 60)
  number?: string;

  @IsOptional()
  @IsDateOnly()
  validUntil?: string;
}

export class PastProjectDto {
  @Trim()
  @IsString()
  @Length(1, 80)
  title!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  district?: string;

  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

/** A contractor's application, and later their profile. Saving it again updates it. */
export class ContractorProfileDto {
  @Trim()
  @IsString()
  @Length(2, 80)
  companyName!: string;

  @IsIn(CONTRACTOR_KINDS)
  kind!: ContractorKind;

  /** 统一社会信用代码 from the business licence, which you check on 国家企业信用信息公示系统 (D17). */
  @NormalizeLicence()
  @Matches(LICENCE_NUMBER, { message: 'licenceNumber must be the 18-character 统一社会信用代码 on the business licence' })
  licenceNumber!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QualificationDto)
  qualifications!: QualificationDto[];

  @Trim()
  @IsString()
  @Length(1, 40)
  city!: string;

  /** The districts they work in: only projects there can be matched to them and invite them (D23). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique()
  @TrimEach()
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  districts!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(RENOVATION_TYPES, { each: true })
  renovationTypes!: RenovationType[];

  /** The design styles they work in. Matching compares them with the homeowner's style. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(DESIGN_STYLES, { each: true })
  styles?: DesignStyle[];

  /**
   * What a full renovation usually costs with them, per m² of floor area, in CNY: both numbers or
   * neither. Matching compares it with the homeowner's budget, and homeowners see it.
   */
  @ValidateIf((o: ContractorProfileDto) => o.priceMinCnyPerM2 !== undefined || o.priceMaxCnyPerM2 !== undefined)
  @IsInt()
  @Min(100)
  @Max(50_000)
  priceMinCnyPerM2?: number;

  @ValidateIf((o: ContractorProfileDto) => o.priceMinCnyPerM2 !== undefined || o.priceMaxCnyPerM2 !== undefined)
  @IsInt()
  @Min(100)
  @Max(50_000)
  priceMaxCnyPerM2?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  yearsInBusiness!: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  teamSize!: number;

  /** How many projects they can take at once, which also caps their open invitations (D23). */
  @IsInt()
  @Min(1)
  @Max(1_000)
  maxConcurrentProjects!: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** D17 asks for at least 3 real past projects; you check them before approving. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PastProjectDto)
  pastProjects?: PastProjectDto[];
}

export class ContractorSearchDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  city?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  district?: string;

  @IsOptional()
  @IsIn(RENOVATION_TYPES)
  renovationType?: RenovationType;
}

export class AdminContractorQueryDto {
  @IsOptional()
  @IsIn(CONTRACTOR_STATUSES)
  status?: ContractorStatus;
}

export class ReviewContractorDto {
  @IsIn(REVIEW_DECISIONS)
  decision!: ReviewDecision;

  /** What you checked, or what the contractor must fix. The contractor sees it. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}
