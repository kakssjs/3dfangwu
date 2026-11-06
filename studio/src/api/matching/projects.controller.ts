import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.guard.ts';
import { InvitationsService } from './invitations.service.ts';
import { CreateProjectDto, InviteDto, MatchesQueryDto, SelectDto } from './matching.dto.ts';
import { ProjectsService } from './projects.service.ts';

/** A homeowner's renovation projects, the teams matched to them, the invitations and the pick (D23). */
@Roles('homeowner')
@Controller('projects')
export class ProjectsController {
  private readonly projects: ProjectsService;
  private readonly invitations: InvitationsService;

  constructor(projects: ProjectsService, invitations: InvitationsService) {
    this.projects = projects;
    this.invitations = invitations;
  }

  /** Saves the homeowner's renovation requirements. Only the teams they invite will see them. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.projects.listMine(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(user, id);
  }

  /** Ends the search without a pick. */
  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.close(user, id);
  }

  /** The verified teams that suit this project, best fit first, each with its reasons. Query: limit (1-10, default 5). */
  @Get(':id/matches')
  matches(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: MatchesQueryDto) {
    return this.invitations.matches(user, id, query);
  }

  /** The invitations on this project with the teams' answers and quotes, in the order they were sent. */
  @Get(':id/invitations')
  listInvitations(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invitations.listForOwner(user, id);
  }

  /** Invites one matched team. At most 3 invitations can be open at once. */
  @Post(':id/invitations')
  invite(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InviteDto) {
    return this.invitations.invite(user, id, dto);
  }

  /** The homeowner's final pick: one quote. */
  @Post(':id/selection')
  @HttpCode(200)
  select(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SelectDto) {
    return this.projects.select(user, id, dto.invitationId);
  }
}
