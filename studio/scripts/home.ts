// Builds or refreshes a home record (N9) from floorplan-3d data.
// If the output file already exists, its links to Homebox and its stage are kept.
//
// Usage: npm run home -- <floorplan.json> <home.json> [--id <id>] [--name <name>] [--stage <stage>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildHomeRecord, STAGE_LABELS, STAGES } from '../src/home-record.ts';
import type { FloorplanInput, HomeRecord, Stage } from '../src/home-record.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { id: { type: 'string' }, name: { type: 'string' }, stage: { type: 'string' } },
});
const [inputPath, outputPath] = positionals;
if (!inputPath || !outputPath) {
  console.error('Usage: npm run home -- <floorplan.json> <home.json> [--id <id>] [--name <name>] [--stage <stage>]');
  process.exit(2);
}
if (values.stage !== undefined && !(STAGES as readonly string[]).includes(values.stage)) {
  console.error(`--stage must be one of: ${STAGES.join(', ')}`);
  process.exit(2);
}

const input = JSON.parse(readFileSync(inputPath, 'utf8')) as FloorplanInput;
const previous = existsSync(outputPath) ? (JSON.parse(readFileSync(outputPath, 'utf8')) as HomeRecord) : undefined;
const id = values.id ?? previous?.id ?? path.basename(outputPath, '.json');
const home = buildHomeRecord(input, {
  id,
  name: values.name ?? previous?.name ?? id,
  stage: values.stage as Stage | undefined,
  previous,
});

mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
writeFileSync(outputPath, JSON.stringify(home, null, 2) + '\n', 'utf8');

const guessed = [...home.furniture, ...home.appliances].filter((i) => i.roomGuessed);
console.log(`Wrote ${outputPath} (home "${home.id}", stage ${STAGE_LABELS[home.stage]})`);
console.log(`  ${home.rooms.length} rooms`);
console.log(`  ${home.furniture.length} pieces of furniture (for Homebox)`);
console.log(`  ${home.appliances.length} appliances (for micasa, N12)`);
if (guessed.length > 0) {
  console.log(`  ${guessed.length} placed in the nearest room because they sit outside every room: ${guessed.map((i) => i.id).join(', ')}`);
}
if (previous?.links.homebox) console.log('  kept the existing links to Homebox');
