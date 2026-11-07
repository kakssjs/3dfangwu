// Runs the floor-plan reading (N4) against the real model: a headless browser draws a floor-plan
// image from our sample plan (the overlay drawing, rooms named in Chinese), the model reads it back
// into plan JSON, and the F2 checks pass on the way in. `npm run test:live`, and only when a reader
// key is in `.env.local` (DOUBAO_API_KEY or MIMO_API_KEY). One model call per run.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { chromium } from 'playwright-core';
import { MimoClient, httpTransport } from '../../src/api/agents/mimo.ts';
import { planOverlaySvg, readFloorPlan } from '../../src/api/homes/floor-plan.ts';
import { validatePlan, type PlanDocument } from '../../src/api/homes/plan-format.ts';

const studioDir = path.resolve(import.meta.dirname, '../..');
const envFile = path.join(studioDir, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const doubaoKey = process.env.DOUBAO_API_KEY ?? '';
const mimoKey = process.env.MIMO_API_KEY ?? '';
const skip = !doubaoKey && !mimoKey ? 'no DOUBAO_API_KEY or MIMO_API_KEY in .env.local' : false;

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];

/** The sample apartment as a floor-plan drawing (rooms named), rasterized in a real browser. */
async function planImage(): Promise<string> {
  const executablePath = BROWSERS.find((p) => existsSync(p));
  if (!executablePath) throw new Error('no Edge or Chrome found');
  const plan = JSON.parse(readFileSync(path.join(studioDir, 'samples/plan-sample.json'), 'utf8')) as PlanDocument;
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{width:1400px;height:1050px}</style>${planOverlaySvg(plan)}`;
  const dir = mkdtempSync(path.join(tmpdir(), 'plan-live-'));
  const file = path.join(dir, 'plan.html');
  await writeFile(file, html, 'utf8');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1050 } });
    await page.goto(`file:///${file.replace(/\\/g, '/')}`);
    const png = await page.screenshot({ type: 'png' });
    return `data:image/png;base64,${png.toString('base64')}`;
  } finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
  }
}

function reader(): MimoClient {
  if (doubaoKey) {
    return new MimoClient(httpTransport({
      apiKey: doubaoKey,
      baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.DOUBAO_MODEL || 'doubao-seed-2-1-lite-260915',
    }));
  }
  return new MimoClient(httpTransport({
    apiKey: mimoKey,
    baseUrl: process.env.MIMO_BASE_URL ?? '',
    model: process.env.MIMO_MODEL || 'MiMo-V2.6-Pro',
  }));
}

describe('the floor-plan reader, live', () => {
  test('a drawn floor plan becomes plan JSON that passes the F2 checks', { skip: skip || false, timeout: 180_000 }, async () => {
    const image = await planImage();
    const { plan, usage } = await readFloorPlan(reader(), image);
    const sample = JSON.parse(readFileSync(path.join(studioDir, 'samples/plan-sample.json'), 'utf8')) as PlanDocument;
    assert.deepEqual(validatePlan(plan), []);
    assert.ok(plan.rooms.length >= 5, `only ${plan.rooms.length} rooms were read`);
    assert.ok(usage.images >= 1, 'the image went along to the model');
    console.log(`      read ${plan.rooms.length} rooms (the drawing has ${sample.rooms.length}), ${plan.walls.length} walls (has ${sample.walls.length}), ${plan.doors.length} doors (has ${sample.doors.length}), ${plan.windows.length} windows (has ${sample.windows.length})`);
  });
});
