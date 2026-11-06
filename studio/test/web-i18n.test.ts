// The interface's text (studio/web/js/i18n.js): every key the screens use exists in both languages,
// every enum the API sends has a label, and both languages fill the same placeholders.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { dictionary } from '../web/js/i18n.js';
import {
  CONTRACTOR_KINDS, CONTRACTOR_STATUSES, DESIGN_STYLES, INVITATION_STATUSES, PROJECT_STATUSES, RENOVATION_TYPES, TASK_STATUSES,
} from '../src/api/domain.ts';

const root = path.join(import.meta.dirname, '..', 'web', 'js');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
const source = files(root).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('the interface text', () => {
  test('every key a screen asks for exists, in Chinese and in English', () => {
    const used = new Set([...source.matchAll(/\bt\('([^']+)'/g)].map((m) => m[1]!));
    // Keys built from a variable: see the template literals in the screens.
    for (const n of [1, 2, 3]) used.add(`home.s${n}.title`).add(`home.s${n}.body`);
    for (const code of [400, 401, 403, 404, 409, 429]) used.add(`err.${code}`);
    for (const name of ['contractors', 'tasks', 'runner']) used.add(`adm.${name}`);
    for (const status of ['rejected', 'suspended']) used.add(`app.${status}`);
    for (const role of ['homeowner', 'contractor']) used.add(`role.${role}`);
    assert.ok(used.size > 150, `found only ${used.size} keys: the scan is broken`);
    const missing = [...used].filter((key) => !dictionary[key]?.[0]?.trim() || !dictionary[key]?.[1]?.trim());
    assert.deepEqual(missing, []);
  });

  test('every status, type and style the API can send has a label', () => {
    const wanted = [
      ...RENOVATION_TYPES.map((v) => `type.${v}`),
      ...DESIGN_STYLES.map((v) => `style.${v}`),
      ...CONTRACTOR_KINDS.map((v) => `kind.${v}`),
      ...[...PROJECT_STATUSES, ...INVITATION_STATUSES, ...CONTRACTOR_STATUSES, ...TASK_STATUSES, 'expired', 'strong', 'good', 'possible'].map((v) => `status.${v}`),
      ...['budget', 'style', 'experience', 'local'].map((v) => `factor.${v}`),
      ...['good', 'partial', 'none', 'unknown'].map((v) => `result.${v}`),
    ];
    assert.deepEqual(wanted.filter((key) => !dictionary[key]), []);
  });

  test('both languages fill the same placeholders', () => {
    const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    const odd = Object.entries(dictionary).filter(([, [zh, en]]) => holes(zh) !== holes(en)).map(([key]) => key);
    assert.deepEqual(odd, []);
  });

  test('no screen builds HTML from text', () => {
    assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  });
});
