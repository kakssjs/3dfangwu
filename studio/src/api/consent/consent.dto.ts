import { IsIn, IsOptional } from 'class-validator';
import { LANGUAGES, ROLES, type Language, type Role } from '../domain.ts';

export class LegalQueryDto {
  /** Which language to return. Default zh-CN. */
  @IsOptional()
  @IsIn(LANGUAGES)
  lang?: Language;
}

export class LegalListQueryDto extends LegalQueryDto {
  /** Only the documents this side accepts at registration. */
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;
}
