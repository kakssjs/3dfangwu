import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.guard.ts';
import { BidDto } from './bidding.dto.ts';
import { BidsService } from './bids.service.ts';

@Controller('bids')
export class BidsController {
  private readonly bids: BidsService;

  constructor(bids: BidsService) {
    this.bids = bids;
  }

  /** The contractor's bids, with each project's status, and the homeowner's contact once picked. */
  @Roles('contractor')
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.bids.listMine(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bids.get(user, id);
  }

  /** Replaces the bid while the project still takes bids. */
  @Roles('contractor')
  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BidDto) {
    return this.bids.update(user, id, dto);
  }
}
