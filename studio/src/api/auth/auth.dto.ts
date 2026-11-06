import { Equals, IsIn, IsString, Length, Matches } from 'class-validator';
import { LANGUAGES, PHONE, ROLES, type Language, type Role } from '../domain.ts';
import { NormalizePhone, Trim } from '../validation.ts';

export class RegisterDto {
  /** `homeowner` to post renovations, `contractor` to take the work. */
  @IsIn(ROLES)
  role!: Role;

  @NormalizePhone()
  @Matches(PHONE, { message: 'phone must be a mainland China mobile number' })
  phone!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @Trim()
  @IsString()
  @Length(1, 40)
  displayName!: string;

  @IsIn(LANGUAGES)
  language!: Language;

  /** The privacy notice and the terms for their side come first (N18, D17). */
  @Equals(true, { message: 'acceptTerms must be true: accept the privacy notice and terms to register' })
  acceptTerms!: boolean;
}

export class LoginDto {
  @NormalizePhone()
  @Matches(PHONE, { message: 'phone must be a mainland China mobile number' })
  phone!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}
