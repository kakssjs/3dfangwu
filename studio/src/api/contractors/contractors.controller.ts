import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.guard.ts';
import { ContractorProfileDto, ContractorSearchDto } from './contractors.dto.ts';
import { ContractorsService } from './contractors.service.ts';

@Controller('contractors')
export class ContractorsController {
  private readonly contractors: ContractorsService;

  constructor(contractors: ContractorsService) {
    this.contractors = contractors;
  }

  /** The contractor's own application, with where its review stands. */
  @Roles('contractor')
  @Get('me')
  getOwn(@CurrentUser() user: AuthUser) {
    return this.contractors.getOwn(user.id);
  }

  @Roles('contractor')
  @Put('me')
  saveOwn(@CurrentUser() user: AuthUser, @Body() dto: ContractorProfileDto) {
    return this.contractors.saveOwn(user.id, dto);
  }

  /** Verified contractors and their qualifications, for homeowners. */
  @Roles('homeowner')
  @Get()
  list(@Query() query: ContractorSearchDto) {
    return this.contractors.listVerified(query);
  }

  @Roles('homeowner')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractors.getVerified(id);
  }
}
