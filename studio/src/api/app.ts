// The I Renovation API (N19): one NestJS app (D20). Every route is under /api.

import 'reflect-metadata';
import { Module, ValidationPipe, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AgentsModule } from './agents/agents.module.ts';
import { buildDeepModel } from './agents/deep.ts';
import { MimoClient, httpTransport } from './agents/mimo.ts';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AuthModule } from './auth/auth.module.ts';
import path from 'node:path';
import type { ProxyReq, ProxyRes } from './maps/amap.ts';
import { studioDir, type StudioConfig } from './config.ts';
import { ConsentModule } from './consent/consent.module.ts';
import { ContractorsModule } from './contractors/contractors.module.ts';
import type { Database } from './db/database.ts';
import { GeoModule } from './geo/geo.module.ts';
import { nominatimLookup, type GeoLookup } from './geo/geo.ts';
import { AMAP_CONNECT_SOURCES, AMAP_IMAGE_SOURCES, AMAP_PREFIX, AMAP_SCRIPT_SOURCES, amapProxy } from './maps/amap.ts';
import { MatchingModule } from './matching/matching.module.ts';
import { MapsModule } from './maps/maps.module.ts';
import { RegionsModule } from './regions/regions.module.ts';
import { CONFIG, DB } from './tokens.ts';
import { UploadsModule } from './uploads/uploads.module.ts';

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
  static register(config: StudioConfig, database: Database, rateLimits: boolean, mimo: MimoClient, deepModel: BaseChatModel | null, geo: GeoLookup): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.register(config, database),
        // 120 requests a minute from one address; sign-up and sign-in allow 10 (auth.controller.ts).
        ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }], skipIf: () => !rateLimits }),
        AuthModule,
        ConsentModule,
        ContractorsModule,
        MatchingModule,
        RegionsModule,
        MapsModule,
        GeoModule.register(geo),
        UploadsModule,
        AgentsModule.register(mimo, deepModel),
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
  /** The agents' MiMo client. Default: the real API from the settings; the tests hand in a stub. */
  mimo?: MimoClient;
  /** The chat model for Agent 1's deep agents (D24). Default: MiMo from the settings, or none. */
  deepModel?: BaseChatModel | null;
  /** Finds a place from a position. Default: OpenStreetMap's Nominatim; the tests hand in a stub. */
  geo?: GeoLookup;
  /** Reaches Amap for the map proxy. Default: the real one; the tests hand in a stub. */
  amapFetch?: typeof fetch;
}

export async function createApp({ config, database, logger, rateLimits = true, mimo, deepModel, geo, amapFetch }: AppOptions): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(
      config,
      database,
      rateLimits,
      mimo ?? new MimoClient(httpTransport({ apiKey: config.mimoApiKey, baseUrl: config.mimoBaseUrl, model: config.mimoModel })),
      deepModel === undefined ? buildDeepModel(config) : deepModel,
      geo ?? nominatimLookup(),
    ),
    logger === false ? { logger: false } : {},
  );
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  // Behind Caddy on the same server (N20), rate limits count the visitor's address, not Caddy's.
  app.set('trust proxy', 'loopback');
  // An upload is one JSON body with its bytes in base64 (uploads, N19), so the body can be up to
  // ~12 MB; every other route sends only text fields, and the rate limits keep abuse in check.
  app.useBodyParser('json', { limit: '12mb' });
  // Unknown fields are refused, and nothing is converted silently: "false" never becomes true.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  serveSite(app, config, amapFetch);
  return app;
}

const webDir = path.join(studioDir, 'web');

// Just what the site middleware uses of Express's request and response.
interface Req {
  method: string;
  path: string;
}
interface Res {
  setHeader(name: string, value: string): void;
  sendFile(file: string): void;
}

/**
 * The interface (D25) at `/`, next to the API at `/api`: static files from `studio/web/`, and
 * index.html for the page links the API hands out (`/projects/<id>`, `/invitations/<id>`), which
 * are routes of the interface. The page's own policy allows scripts and styles from this address
 * only, and forbids framing.
 */
function serveSite(app: NestExpressApplication, config: StudioConfig, amapFetch?: typeof fetch): void {
  // Every page of the app: our own address only, and the map page may be framed by it.
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  // The map page is the one place Amap's script runs. Amap evaluates code to draw its map, which
  // the rest of the app never may, so this page has a policy of its own, and only our own pages may frame it.
  const mapPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-eval' ${AMAP_SCRIPT_SOURCES.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${AMAP_IMAGE_SOURCES.join(' ')}`,
    `connect-src 'self' ${AMAP_CONNECT_SOURCES.join(' ')}`,
    "worker-src 'self' blob:",
    "font-src data:",
    "frame-ancestors 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const proxy = amapProxy(config, amapFetch);
  app.use(AMAP_PREFIX, (req: ProxyReq, res: ProxyRes) => void proxy(req, res));
  app.use((req: Req, res: Res, next: () => void) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Content-Security-Policy', req.path === '/map-frame.html' ? mapPolicy : policy);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // The page may ask for the visitor's position ("use my location"); nothing embedded may.
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    next();
  });
  app.useStaticAssets(webDir, { index: false, maxAge: 0 });
  app.use((req: Req, res: Res, next: () => void) => {
    const page = req.method === 'GET' && !req.path.startsWith('/api') && path.extname(req.path) === '';
    if (!page) return next();
    res.sendFile(path.join(webDir, 'index.html'));
  });
}
