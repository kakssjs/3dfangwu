import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../auth/auth.guard.ts';
import type { StudioConfig } from '../config.ts';
import { CONFIG } from '../tokens.ts';
import { publicMapConfig } from './amap.ts';

/** What the page needs to know about the map: whether there is one, and its public key. */
@Public()
@Controller('config')
export class MapsController {
  private readonly config: StudioConfig;

  constructor(@Inject(CONFIG) config: StudioConfig) {
    this.config = config;
  }

  @Get()
  get() {
    return publicMapConfig(this.config);
  }
}
