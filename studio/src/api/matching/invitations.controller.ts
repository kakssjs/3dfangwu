import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.guard.ts';
import { InvitationsService } from './invitations.service.ts';
import { DeclineDto, QuoteDto } from './matching.dto.ts';

@Controller('invitations')
export class InvitationsController {
  private readonly invitations: InvitationsService;

  constructor(invitations: InvitationsService) {
    this.invitations = invitations;
  }

  /** The invitations a team has received, with each project's brief, and the homeowner's contact once picked. */
  @Roles('contractor')
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.invitations.listMine(user);
  }

  /** One invitation by its link: for the team it was sent to, or the homeowner who sent it. */
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invitations.get(user, id);
  }

  /** The team says no, while the invitation waits for an answer. */
  @Roles('contractor')
  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DeclineDto) {
    return this.invitations.decline(user, id, dto);
  }

  /** The team's one quote. Sending it again replaces it until the homeowner picks. */
  @Roles('contractor')
  @Put(':id/quote')
  quote(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QuoteDto) {
    return this.invitations.quote(user, id, dto);
  }
}
