import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/database.ts';
import { contractorProfiles, users, type User } from '../db/schema.ts';
import { TERMS_VERSION, type ContractorStatus, type Language, type Role } from '../domain.ts';
import { DB } from '../tokens.ts';
import type { AuthUser } from './auth.guard.ts';
import type { LoginDto, RegisterDto } from './auth.dto.ts';
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

  constructor(@Inject(DB) db: Db, jwt: JwtService) {
    this.db = db;
    this.jwt = jwt;
  }

  async register(dto: RegisterDto): Promise<Session> {
    const [user] = await this.db
      .insert(users)
      .values({
        role: dto.role,
        phone: dto.phone,
        passwordHash: await hashPassword(dto.password),
        displayName: dto.displayName,
        language: dto.language,
        consentVersion: TERMS_VERSION,
        consentAt: new Date(),
      })
      .onConflictDoNothing({ target: users.phone })
      .returning();
    if (!user) throw new ConflictException('This phone number is already registered: sign in instead');
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
