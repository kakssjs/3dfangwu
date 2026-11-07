// Imports only a reviewed snapshot. Stop the local API before --apply when using PGlite.
import { readFileSync, existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { referenceSnapshotSchema } from '../dist/src/api/reference-data/reference-data.js';
import { referenceEntries } from '../dist/src/api/db/schema.js';
import { openDatabase } from '../dist/src/api/db/database.js';
import { loadConfig, envFile } from '../dist/src/api/config.js';
const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || args.length > 1) throw new Error('Use --dry-run or --apply');
const snapshot = referenceSnapshotSchema.parse(JSON.parse(readFileSync(new URL('../data/open-reference/snapshot.json', import.meta.url))));
const counts = {};
for (const entry of snapshot.entries) counts[entry.kind] = (counts[entry.kind] || 0) + 1;
console.log(JSON.stringify({records: snapshot.entries.length, counts}));
if (!args.includes('--apply')) { console.log('Validated only; database unchanged.'); process.exit(0); }
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config = loadConfig(process.env);
if (!config.databaseUrl) {
  let running = false;
  try { running = (await fetch(`http://127.0.0.1:${config.port}/`, {signal: AbortSignal.timeout(1500)})).ok; } catch {}
  if (running) throw new Error('Stop the local API and back up its database folder before importing.');
}
const database = await openDatabase({url: config.databaseUrl, dataDir: config.dbDir, poolMax: config.databasePoolMax});
try {
  await database.db.transaction(async tx => {
    for (let offset = 0; offset < snapshot.entries.length; offset += 100) {
      const entries = snapshot.entries.slice(offset, offset + 100).map(entry => ({...entry, retrievedAt: new Date(entry.retrievedAt)}));
      await tx.insert(referenceEntries).values(entries).onConflictDoUpdate({target: referenceEntries.id, set: {
        title: sql`excluded.title`, titleEn: sql`excluded.title_en`, source: sql`excluded.source`,
        sourceUrl: sql`excluded.source_url`, kind: sql`excluded.kind`, license: sql`excluded.license`,
        attribution: sql`excluded.attribution`, retrievedAt: sql`excluded.retrieved_at`,
        sourceVersion: sql`excluded.source_version`, sourceHash: sql`excluded.source_hash`, data: sql`excluded.data`,
      }});
    }
  });
  console.log('Imported transactionally. Existing business accounts and customer records were not changed.');
} finally { await database.close(); }
