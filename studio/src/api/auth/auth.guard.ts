import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { StudioConfig } from '../config.ts';
import type { Db } from '../db/database.ts';
import { users } from '../db/schema.ts';
import type { Language, Role } from '../domain.ts';
import { CONFIG, DB } from '../tokens.ts';

const PUBLIC = 'studio:public';
const ROLES_ALLOWED = 'studio:roles';
const ADMIN = 'studio:admin';

/** Anyone can call this route, signed in or not. */
export const Public = () => SetMetadata(PUBLIC, true);

/** Only these kinds of account can call this route. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_ALLOWED, roles);

/** Only you can call this route: send the admin key from `.env.local` in the X-Admin-Key header. */
export const AdminOnly = () => SetMetadata(ADMIN, true);

/** The signed-in account, as the guard loaded it for this request. */
export interface AuthUser {
  id: string;
  role: Role;
  phone: string;
  displayName: string;
  language: Language;
}

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const user = context.switchToHttp().getRequest<HttpRequest>().user;
  if (!user) throw new UnauthorizedException('Sign in first');
  return user;
});

/**
 * Runs before every route. A route needs a signed-in account (Authorization: Bearer <token>)
 * unless it is marked @Public() or @AdminOnly(). The account is read again on every request,
 * so a deleted account stops working at once.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly reflector: Reflector;
  private readonly jwt: JwtService;
  private readonly db: Db;
  private readonly config: StudioConfig;

  constructor(reflector: Reflector, jwt: JwtService, @Inject(DB) db: Db, @Inject(CONFIG) config: StudioConfig) {
    this.reflector = reflector;
    this.jwt = jwt;
    this.db = db;
    this.config = config;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const request = context.switchToHttp().getRequest<HttpRequest>();

    if (this.reflector.getAllAndOverride<boolean>(ADMIN, targets)) {
      if (!this.config.adminKey) throw new ForbiddenException('Admin routes are off: STUDIO_ADMIN_KEY is not set');
      const given = request.headers['x-admin-key'];
      if (typeof given !== 'string' || !sameSecret(given, this.config.adminKey)) {
        throw new UnauthorizedException('Wrong admin key');
      }
      return true;
    }

    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token) throw new UnauthorizedException('Sign in first');
    let userId: string;
    try {
      userId = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException('Your sign-in has expired or is not valid: sign in again');
    }
    const [user] = await this.db
      .select({
        id: users.id,
        role: users.role,
        phone: users.phone,
        displayName: users.displayName,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new UnauthorizedException('This account no longer exists');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_ALLOWED, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException(`Only ${roles.join(' or ')} accounts can do this`);
    request.user = user;
    return true;
  }
}

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
