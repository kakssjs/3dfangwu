import { Equals, IsEmail, IsIn, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { LANGUAGES, PHONE, ROLES, type Language, type Role } from '../domain.ts';
import { NormalizePhone, Trim } from '../validation.ts';

const NormalizeEmail = () => Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  /** `homeowner` to post renovations, `contractor` to take the work. */
  @IsIn(ROLES)
  role!: Role;

  @NormalizePhone()
  @Matches(PHONE, { message: 'phone must be a mainland China mobile number' })
  phone!: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @NormalizeEmail()
  @IsEmail()
  @Length(1, 254)
  email?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @Matches(/^\d{6}$/)
  emailCode?: string;

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

export class EmailCodeDto {
  @NormalizeEmail()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @IsIn(['register', 'login'])
  purpose!: 'register' | 'login';

  @ValidateIf((dto: EmailCodeDto) => dto.purpose === 'register' || dto.acceptTerms !== undefined)
  @Equals(true)
  acceptTerms?: boolean;
}

export class EmailLoginDto {
  @NormalizeEmail()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}
