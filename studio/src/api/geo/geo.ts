// Finding a person's district from their position (the "use my location" button).
//
// The browser asks the person for permission and sends us the coordinates; we ask OpenStreetMap's
// public Nominatim service (open data, ODbL) which place that is, match its answer against the real
// regions list, and forget the coordinates. They are never stored or logged. Nominatim's rules: at
// most one request a second, and an application name in the User-Agent.

import { PROVINCES, citiesNamed, knownCity, knownPlace } from '../regions/regions.ts';

/** Every place name Nominatim gives for a point, smallest area first. */
export type GeoLookup = (lat: number, lng: number) => Promise<string[]>;

/** The service didn't answer. The person can still pick their district by hand. */
export class GeoUnavailable extends Error {}

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'IRenovation/0.1 (+https://github.com/kakssjs/3dfangwu)';
const MIN_GAP_MS = 1_100;

export function nominatimLookup(fetchImpl: typeof fetch = fetch): GeoLookup {
  let last = 0;
  let chain: Promise<unknown> = Promise.resolve();
  const paced = <T>(work: () => Promise<T>): Promise<T> => {
    const run = chain.then(async () => {
      const wait = last + MIN_GAP_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      last = Date.now();
      return work();
    });
    chain = run.catch(() => undefined);
    return run;
  };
  return (lat, lng) =>
    paced(async () => {
      const url = `${ENDPOINT}?format=jsonv2&zoom=14&addressdetails=1&accept-language=zh-CN&lat=${lat}&lon=${lng}`;
      let response: Response;
      try {
        response = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(8_000) });
      } catch {
        throw new GeoUnavailable('the location service did not answer');
      }
      if (!response.ok) throw new GeoUnavailable(`the location service answered ${response.status}`);
      const body = (await response.json()) as { display_name?: string; address?: Record<string, string> };
      return [...(body.display_name ?? '').split(/[,，]\s*/), ...Object.values(body.address ?? {})].map((s) => s.trim()).filter(Boolean);
    });
}

export interface Located {
  province: string | null;
  city: string | null;
  district: string | null;
  /** True when both the city and the district are real places from our list. */
  matched: boolean;
}

/** Matches the names against the real regions list. Nominatim puts a city in the district slot in some places, so every name is tried. */
export function placeFrom(names: string[]): Located {
  const city = names.map((n) => knownCity(n)).find((c): c is string => c !== undefined) ?? null;
  const district = city ? (names.find((n) => knownPlace(city, n)) ?? null) : null;
  const province = city ? (PROVINCES.find((p) => p.cities.some((c) => citiesNamed(city).includes(c)))?.name ?? null) : null;
  return { province, city, district, matched: city !== null && district !== null };
}
