import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.guard.ts';
import { BidDto, BidQueryDto, CreateProjectDto, OpenProjectsQueryDto, SelectBidDto } from './bidding.dto.ts';
import { BidsService } from './bids.service.ts';
import { ProjectsService } from './projects.service.ts';

@Controller('projects')
export class ProjectsController {
  private readonly projects: ProjectsService;
  private readonly bids: BidsService;

  constructor(projects: ProjectsService, bids: BidsService) {
    this.projects = projects;
    this.bids = bids;
  }

  /** A homeowner publishes their renovation requirements for bids. */
  @Roles('homeowner')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Roles('homeowner')
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.projects.listMine(user);
  }

  /** The projects a verified contractor can bid on. */
  @Roles('contractor')
  @Get('open')
  listOpen(@CurrentUser() user: AuthUser, @Query() query: OpenProjectsQueryDto) {
    return this.projects.listOpen(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(user, id);
  }

  @Roles('homeowner')
  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.close(user, id);
  }

  /** The bids on the homeowner's project. Filters: minPriceCny, maxPriceCny, maxDurationDays, minYearsInBusiness, startBy; sort: submitted, price, duration, experience. */
  @Roles('homeowner')
  @Get(':id/bids')
  listBids(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: BidQueryDto) {
    return this.bids.listForOwner(user, id, query);
  }

  @Roles('contractor')
  @Post(':id/bids')
  bid(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BidDto) {
    return this.bids.create(user, id, dto);
  }

  /** The homeowner's final pick. */
  @Roles('homeowner')
  @Post(':id/selection')
  @HttpCode(200)
  select(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SelectBidDto) {
    return this.projects.select(user, id, dto.bidId);
  }
}
