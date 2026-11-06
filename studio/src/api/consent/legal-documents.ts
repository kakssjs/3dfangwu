// The privacy notice and terms people accept when they register (N18, D7, D17): the drafts in
// `studio/templates/legal/`, one file per document and language, each starting with its title
// (`# ...`). `TERMS_VERSION` (domain.ts) is the version these texts are; when a text changes,
// bump it there, and registration keeps recording what the person accepted.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { studioDir } from '../config.ts';
import { LANGUAGES, TERMS_VERSION, type Language, type Role } from '../domain.ts';

export interface LegalText {
  document: string;
  version: string;
  lang: Language;
  title: string;
  body: string;
}

export interface LegalSummary {
  document: string;
  roles: readonly Role[];
  title: string;
}

/** Which documents each side accepts at registration. */
export const LEGAL_DOCUMENTS: readonly { document: string; roles: readonly Role[] }[] = [
  { document: 'privacy', roles: ['homeowner', 'contractor'] },
  { document: 'terms', roles: ['homeowner', 'contractor'] },
  { document: 'contractor-terms', roles: ['contractor'] },
];

function load(document: string, lang: Language): LegalText {
  const file = path.join(studioDir, 'templates', 'legal', `${document}.${lang}.md`);
  const text = readFileSync(file, 'utf8');
  const title = /^# (.+)\r?\n/.exec(text);
  if (!title) throw new Error(`${file} must start with its title (\`# ...\`)`);
  return { document, version: TERMS_VERSION, lang, title: title[1]!.trim(), body: text.slice(title[0].length).trim() };
}

// Loaded once: these texts change only with a TERMS_VERSION bump, and a missing file should fail
// the app at startup, not at someone's registration.
const texts = new Map<string, LegalText>();
for (const { document } of LEGAL_DOCUMENTS) {
  for (const lang of LANGUAGES) texts.set(`${document}.${lang}`, load(document, lang));
}

export function legalText(document: string, lang: Language): LegalText | undefined {
  return texts.get(`${document}.${lang}`);
}

export function legalSummaries(lang: Language, role?: Role): LegalSummary[] {
  return LEGAL_DOCUMENTS.filter(({ roles }) => !role || roles.includes(role)).map(({ document, roles }) => ({
    document,
    roles,
    title: texts.get(`${document}.${lang}`)!.title,
  }));
}
