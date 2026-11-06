import { BadRequestException } from '@nestjs/common';
import { knownCity, knownPlace } from './regions.ts';

/**
 * Refuses a place that doesn't exist, and returns the city's canonical name (上海市 → 上海). Cities
 * and districts come from the real list at `GET /api/regions`, so projects and contractors always
 * use the same names and matching by district can work.
 */
export function requirePlace(city: string, districts: string[]): string {
  const canonical = knownCity(city);
  if (!canonical) throw new BadRequestException(`city "${city}" is not a known city: pick one from GET /api/regions`);
  for (const district of districts) {
    if (!knownPlace(canonical, district)) throw new BadRequestException(`"${district}" is not a district of ${canonical}: pick one from GET /api/regions`);
  }
  return canonical;
}
