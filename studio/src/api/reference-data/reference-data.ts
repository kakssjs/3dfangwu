import { createHash } from 'node:crypto';
import { z } from 'zod';
export const REFERENCE_KINDS = ['business', 'building', 'floorplan', 'material', 'region'] as const;
export const referenceEntrySchema = z.object({
  id: z.string().min(1).max(160), kind: z.enum(REFERENCE_KINDS),
  title: z.string().min(1).max(500), titleEn: z.string().max(500).nullable(),
  source: z.string().min(1).max(80), sourceUrl: z.url().refine((s) => s.startsWith('https://')),
  license: z.enum(['ODbL-1.0', 'CC0-1.0', 'MIT']), attribution: z.string().min(1).max(1000),
  retrievedAt: z.iso.datetime(), sourceVersion: z.string().max(100).nullable(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/), data: z.record(z.string(), z.unknown()),
}).strict();
export const referenceSnapshotSchema = z.object({ schema: z.literal('homora.reference/1'), entries: z.array(referenceEntrySchema).min(1).max(10000) }).strict().superRefine(({ entries }, ctx) => {
  const ids = new Set<string>();
  entries.forEach((entry, i) => { if (createHash('sha256').update(JSON.stringify(entry.data)).digest('hex') !== entry.sourceHash) ctx.addIssue({code: 'custom', message: 'Source data checksum mismatch', path: ['entries', i, 'sourceHash']}); if (ids.has(entry.id)) ctx.addIssue({code: 'custom', message: 'Duplicate source ID', path: ['entries', i, 'id']}); ids.add(entry.id); });
});
