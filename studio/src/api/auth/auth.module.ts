import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { StudioConfig } from '../config.ts';
import { CONFIG } from '../tokens.ts';
import { AuthController } from './auth.controller.ts';
import { AuthGuard } from './auth.guard.ts';
import { AuthService } from './auth.service.ts';
import { EMAIL_SEND, type EmailSender } from './email.ts';
import { EmailService } from './email.service.ts';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [CONFIG],
      useFactory: (config: StudioConfig) => ({
        secret: config.jwtSecret,
        signOptions: { algorithm: 'HS256', expiresIn: '7d' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {
  static register(emailSend: EmailSender): DynamicModule {
    return { module: AuthModule, providers: [{ provide: EMAIL_SEND, useValue: emailSend }] };
  }
}
