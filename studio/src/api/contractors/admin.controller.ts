import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AdminOnly } from '../auth/auth.guard.ts';
import { AdminContractorQueryDto, ReviewContractorDto } from './contractors.dto.ts';
import { ContractorsService } from './contractors.service.ts';

/** Your side (D6, D17): send the admin key from `.env.local` in the X-Admin-Key header. */
@AdminOnly()
@Controller('admin/contractors')
export class AdminContractorsController {
  private readonly contractors: ContractorsService;

  constructor(contractors: ContractorsService) {
    this.contractors = contractors;
  }

  /** Applications, newest first. `?status=pending` is your review queue. */
  @Get()
  list(@Query() query: AdminContractorQueryDto) {
    return this.contractors.adminList(query);
  }

  /** Verify, reject or suspend, after checking the licence on 国家企业信用信息公示系统. */
  @Post(':id/review')
  @HttpCode(200)
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewContractorDto) {
    return this.contractors.review(id, dto);
  }
}
