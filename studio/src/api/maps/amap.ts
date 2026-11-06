// Amap (高德地图), for finding a home's community on a map (D26).
//
// The key in `.env.local` (`AMAP_KEY`) is a "Web (JS API)" key: the browser loads Amap's map with it,
// which is how those keys are meant to be used. Since Amap's 2021 change, that key needs a security
// code (`AMAP_SECURITY_CODE`) for searches. The code must not reach the browser, so the page sends
// Amap's service calls to `/_AMapService/` on our own server, which adds the code and forwards them
// (Amap's recommended "proxy" setup). Without the code the map still shows; search says it isn't set up.

import type { StudioConfig } from '../config.ts';

/** What the proxy uses of Express's request and response. */
export interface ProxyReq {
  method: string;
  url: string;
  ip?: string;
}
export interface ProxyRes {
  status(code: number): ProxyRes;
  type(value: string): ProxyRes;
  send(body: unknown): unknown;
  json(body: unknown): unknown;
}

export const AMAP_PREFIX = '/_AMapService';
const UPSTREAM = 'https://restapi.amap.com';
const PER_MINUTE = 240;

/** Where Amap's map script, tiles and images come from: allowed by the page's content policy, and only when a key is set. */
export const AMAP_SCRIPT_SOURCES = ['https://webapi.amap.com', 'https://jsapi.amap.com'];
export const AMAP_CONNECT_SOURCES = ['https://*.amap.com', 'https://*.autonavi.com'];
export const AMAP_IMAGE_SOURCES = ['https://*.amap.com', 'https://*.autonavi.com'];

/** The public part of the settings the page needs. The JS key is public by design; the security code is never in it. */
export function publicMapConfig(config: Pick<StudioConfig, 'amapKey' | 'amapSecurityCode'>) {
  return config.amapKey ? { amap: { key: config.amapKey, searchReady: Boolean(config.amapSecurityCode), serviceHost: AMAP_PREFIX } } : { amap: null };
}

/** Forwards the map's read-only service calls to Amap with the security code added. */
export function amapProxy(config: Pick<StudioConfig, 'amapKey' | 'amapSecurityCode'>, fetchImpl: typeof fetch = fetch) {
  const hits = new Map<string, { count: number; reset: number }>();
  return async (req: ProxyReq, res: ProxyRes): Promise<void> => {
    if (!config.amapKey || !config.amapSecurityCode) {
      res.status(503).json({ message: 'Map search is not set up: the Amap security code is missing' });
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ message: 'Only GET' });
      return;
    }
    const target = new URL(req.url, UPSTREAM);
    // Read-only service paths, and only with our own key: this is not an open proxy.
    // `//other.host/...` would resolve to another host, so the address must still be Amap's.
    if (target.origin !== UPSTREAM || !/^\/v[34]\//.test(target.pathname) || target.searchParams.get('key') !== config.amapKey) {
      res.status(403).json({ message: 'Not allowed' });
      return;
    }
    const who = req.ip ?? 'unknown';
    const now = Date.now();
    const seen = hits.get(who);
    if (!seen || seen.reset < now) hits.set(who, { count: 1, reset: now + 60_000 });
    else if (++seen.count > PER_MINUTE) {
      res.status(429).json({ message: 'Too many map requests' });
      return;
    }
    target.searchParams.set('jscode', config.amapSecurityCode);
    try {
      const upstream = await fetchImpl(target, { signal: AbortSignal.timeout(8_000) });
      res.status(upstream.status).type(upstream.headers.get('content-type') ?? 'application/json').send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(502).json({ message: 'The map service did not answer' });
    }
  };
}
