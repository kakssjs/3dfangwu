import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginDto, RegisterDto } from './auth.dto.ts';
import { CurrentUser, Public, type AuthUser } from './auth.guard.ts';
import { AuthService } from './auth.service.ts';

// At most 10 sign-ups or sign-ins a minute from one address, against password guessing.
const SIGN_IN_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  private readonly auth: AuthService;

  constructor(auth: AuthService) {
    this.auth = auth;
  }

  /** Creates a homeowner or contractor account and signs it in. */
  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }
}
