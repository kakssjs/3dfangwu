// The I Renovation API (N19): one NestJS app (D20). Every route is under /api.

import 'reflect-metadata';
import { Module, ValidationPipe, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.ts';
import { BiddingModule } from './bidding/bidding.module.ts';
import type { StudioConfig } from './config.ts';
import { ContractorsModule } from './contractors/contractors.module.ts';
import type { Database } from './db/database.ts';
import { CONFIG, DB } from './tokens.ts';

/** The settings and the database, for every module. */
@Module({})
class CoreModule {
  static register(config: StudioConfig, database: Database): DynamicModule {
    return {
      module: CoreModule,
      global: true,
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: database.db },
      ],
      exports: [CONFIG, DB],
    };
  }
}

@Module({})
export class AppModule {
  static register(config: StudioConfig, database: Database, rateLimits: boolean): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.register(config, database),
        // 120 requests a minute from one address; sign-up and sign-in allow 10 (auth.controller.ts).
        ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }], skipIf: () => !rateLimits }),
        AuthModule,
        ContractorsModule,
        BiddingModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}

export interface AppOptions {
  config: StudioConfig;
  database: Database;
  /** false keeps the tests quiet. */
  logger?: false;
  /** false turns the rate limits off, for tests that register many accounts. */
  rateLimits?: boolean;
}

export async function createApp({ config, database, logger, rateLimits = true }: AppOptions): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config, database, rateLimits),
    logger === false ? { logger: false } : {},
  );
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  // Behind Caddy on the same server (N20), rate limits count the visitor's address, not Caddy's.
  app.set('trust proxy', 'loopback');
  // Unknown fields are refused, and nothing is converted silently: "false" never becomes true.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  return app;
}
