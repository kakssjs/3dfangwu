import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GEO_LOOKUP } from '../tokens.ts';
import { GeoUnavailable, placeFrom, type GeoLookup, type Located } from './geo.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED = 500;

@Injectable()
export class GeoService {
  private readonly lookup: GeoLookup;
  /** About 100 m squares and the answer for each, for a day: many people in one place cost one request. */
  private readonly cache = new Map<string, { at: number; place: Located }>();

  constructor(@Inject(GEO_LOOKUP) lookup: GeoLookup) {
    this.lookup = lookup;
  }

  async locate(lat: number, lng: number): Promise<Located> {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < DAY_MS) return hit.place;
    let names: string[];
    try {
      names = await this.lookup(lat, lng);
    } catch (error) {
      if (error instanceof GeoUnavailable) throw new ServiceUnavailableException('The location service is not available right now: pick your district by hand');
      throw error;
    }
    const place = placeFrom(names);
    if (this.cache.size >= MAX_CACHED) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { at: Date.now(), place });
    return place;
  }
}
