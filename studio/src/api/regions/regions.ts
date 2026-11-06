// Real places: China's provinces, cities and districts (GB/T 2260 administrative divisions), from
// the `china-area-data` package (MIT). Projects and contractors are matched by city and district,
// so both sides must pick the same real names, not type their own.

import { createRequire } from 'node:module';

type Raw = Record<string, Record<string, string>>;
const raw = createRequire(import.meta.url)('china-area-data/data.json') as Raw;

export interface City {
  name: string;
  districts: string[];
}
export interface Province {
  name: string;
  cities: City[];
}

/** The four cities that are provinces too: their districts hang straight under them. */
const MUNICIPALITIES = new Set(['110000', '120000', '310000', '500000']);
const PLACEHOLDERS = new Set(['市辖区', '县']);

/** 深圳市 → 深圳: how people write a city. Prefectures (自治州, 地区, 盟) keep their names. */
export const shortCity = (name: string): string => (name.length > 2 && name.endsWith('市') ? name.slice(0, -1) : name.trim());

function build(): Province[] {
  const provinces: Province[] = [];
  for (const [pcode, pname] of Object.entries(raw['86'] ?? {})) {
    const cities: City[] = [];
    const children = raw[pcode] ?? {};
    if (MUNICIPALITIES.has(pcode)) {
      const districts = Object.keys(children).flatMap((ccode) => Object.values(raw[ccode] ?? {})).filter((n) => !PLACEHOLDERS.has(n));
      cities.push({ name: shortCity(pname), districts });
    } else {
      for (const [ccode, cname] of Object.entries(children)) {
        const below = Object.values(raw[ccode] ?? {}).filter((n) => !PLACEHOLDERS.has(n));
        if (cname.includes('直辖县级行政区划')) {
          // Counties and county-level cities that belong to the province directly: each is its own city.
          for (const county of below) cities.push({ name: shortCity(county), districts: [county] });
        } else {
          cities.push({ name: shortCity(cname), districts: below.length ? below : [shortCity(cname)] });
        }
      }
    }
    provinces.push({ name: pname, cities });
  }
  return provinces;
}

export const PROVINCES: Province[] = build();

const CITIES = new Map<string, City[]>();
for (const province of PROVINCES) {
  for (const city of province.cities) CITIES.set(city.name, [...(CITIES.get(city.name) ?? []), city]);
}

/** The cities with that name (a few names exist in more than one province). */
export const citiesNamed = (name: string): City[] => CITIES.get(shortCity(name)) ?? [];

/** The city's canonical name if it is a real one, else undefined. */
export const knownCity = (name: string): string | undefined => (citiesNamed(name).length ? shortCity(name) : undefined);

/** True when `district` is a district of a real city called `city`. */
export const knownPlace = (city: string, district: string): boolean => citiesNamed(city).some((c) => c.districts.includes(district.trim()));
