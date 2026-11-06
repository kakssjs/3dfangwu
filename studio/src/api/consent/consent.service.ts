import { Injectable, NotFoundException } from '@nestjs/common';
import { TERMS_VERSION, type Language, type Role } from '../domain.ts';
import { legalSummaries, legalText, type LegalSummary, type LegalText } from './legal-documents.ts';

/** The privacy notice and terms by version and language (N18). The texts are drafts until you approve them. */
@Injectable()
export class ConsentService {
  list(lang: Language, role?: Role): { version: string; documents: LegalSummary[] } {
    return { version: TERMS_VERSION, documents: legalSummaries(lang, role) };
  }

  get(document: string, lang: Language): LegalText {
    const text = legalText(document, lang);
    if (!text) throw new NotFoundException('No such document');
    return text;
  }
}
