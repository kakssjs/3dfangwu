import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/auth.guard.ts';
import { LegalListQueryDto, LegalQueryDto } from './consent.dto.ts';
import { ConsentService } from './consent.service.ts';

/**
 * The privacy notice and the terms, for people to read before they register (N18). No sign-in:
 * registration needs `acceptTerms`, and saves which version the person accepted (`GET /auth/me`
 * shows where the account stands).
 */
@Public()
@Controller('legal')
export class ConsentController {
  private readonly consent: ConsentService;

  constructor(consent: ConsentService) {
    this.consent = consent;
  }

  /** The current version and the documents, with their titles. `role` narrows to one side's. */
  @Get()
  list(@Query() query: LegalListQueryDto) {
    return this.consent.list(query.lang ?? 'zh-CN', query.role);
  }

  /** One document in one language: its title and full text, with the version it is. */
  @Get(':document')
  get(@Param('document') document: string, @Query() query: LegalQueryDto) {
    return this.consent.get(document, query.lang ?? 'zh-CN');
  }
}
