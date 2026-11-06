import { Module, type DynamicModule } from '@nestjs/common';
import { GEO_LOOKUP } from '../tokens.ts';
import { GeoController } from './geo.controller.ts';
import type { GeoLookup } from './geo.ts';
import { GeoService } from './geo.service.ts';

@Module({})
export class GeoModule {
  static register(lookup: GeoLookup): DynamicModule {
    return { module: GeoModule, controllers: [GeoController], providers: [GeoService, { provide: GEO_LOOKUP, useValue: lookup }] };
  }
}
