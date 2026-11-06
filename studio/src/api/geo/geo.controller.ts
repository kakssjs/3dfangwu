import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LocateDto } from './geo.dto.ts';
import { GeoService } from './geo.service.ts';

@Controller('geo')
export class GeoController {
  private readonly geo: GeoService;

  constructor(geo: GeoService) {
    this.geo = geo;
  }

  /** Which real city and district a position is in. POST, so the coordinates never appear in an address or a log line. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('locate')
  @HttpCode(200)
  locate(@Body() dto: LocateDto) {
    return this.geo.locate(dto.lat, dto.lng);
  }
}
