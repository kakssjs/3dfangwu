import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/database.ts';
import { contractorProfiles, users, type User } from '../db/schema.ts';
import { TERMS_VERSION, type ContractorStatus, type Language, type Role } from '../domain.ts';
import { DB } from '../tokens.ts';
import type { AuthUser } from './auth.guard.ts';
import type { EmailLoginDto, LoginDto, RegisterDto } from './auth.dto.ts';
import { EmailService } from './email.service.ts';
import { hashPassword, verifyPassword } from './password.ts';

export interface AccountView {
  id: string;
  role: Role;
  phone: string;
  displayName: string;
  language: Language;
}

/** What the interface keeps after sign-in: the token for the Authorization header, and whose it is. */
export interface Session {
  accessToken: string;
  user: AccountView;
}

// Checked when a phone number isn't registered, so a wrong number takes as long as a wrong password.
const UNUSED_HASH = hashPassword('not anyone’s password');

@Injectable()
export class AuthService {
  private readonly db: Db;
  private readonly jwt: JwtService;
  private readonly email: EmailService;

  constructor(@Inject(DB) db: Db, jwt: JwtService, email: EmailService) {
    this.db = db;
    this.jwt = jwt;
    this.email = email;
  }

  async register(dto: RegisterDto): Promise<Session> {
    if (this.email.enabled && (!dto.email || !dto.emailCode)) {
      throw new BadRequestException('Email and emailCode are required');
    }
    const passwordHash = await hashPassword(dto.password);
    const user = await this.db.transaction(async (tx) => {
      if (this.email.enabled && !await this.email.consume(tx, dto.email!, dto.emailCode!, 'register')) return false;
      const [created] = await tx.insert(users).values({
        role: dto.role,
        phone: dto.phone,
        passwordHash,
        email: this.email.enabled ? dto.email : null,
        emailVerifiedAt: this.email.enabled ? new Date() : null,
        displayName: dto.displayName,
        language: dto.language,
        consentVersion: TERMS_VERSION,
        consentAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
      if (!created) throw new ConflictException('This phone number or email is already registered: sign in instead');
      return created;
    });
    if (user === false) throw new BadRequestException('Invalid or expired verification code');
    return this.session(user);
  }

  async emailLogin(dto: EmailLoginDto): Promise<Session> {
    this.email.requireEnabled();
    const user = await this.db.transaction(async (tx) => {
      if (!await this.email.consume(tx, dto.email, dto.code, 'login')) return undefined;
      const [found] = await tx.select().from(users)
        .where(and(eq(users.email, dto.email), isNotNull(users.emailVerifiedAt))).limit(1);
      return found;
    });
    if (!user) throw new UnauthorizedException('Invalid or expired verification code');
    return this.session(user);
  }

  async login(dto: LoginDto): Promise<Session> {
    const [user] = await this.db.select().from(users).where(eq(users.phone, dto.phone)).limit(1);
    const matches = await verifyPassword(dto.password, user?.passwordHash ?? (await UNUSED_HASH));
    if (!user || !matches) throw new UnauthorizedException('Wrong phone number or password');
    return this.session(user);
  }

  /** The account, and for a contractor where their application stands. */
  async me(user: AuthUser): Promise<AccountView & { contractorStatus?: ContractorStatus | 'no-profile' }> {
    if (user.role !== 'contractor') return accountView(user);
    const [profile] = await this.db
      .select({ status: contractorProfiles.status })
      .from(contractorProfiles)
      .where(eq(contractorProfiles.userId, user.id))
      .limit(1);
    return { ...accountView(user), contractorStatus: profile?.status ?? 'no-profile' };
  }

  private async session(user: User): Promise<Session> {
    return { accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }), user: accountView(user) };
  }
}

function accountView(user: AccountView): AccountView {
  return { id: user.id, role: user.role, phone: user.phone, displayName: user.displayName, language: user.language };
}
