import { Module } from '@nestjs/common';
import { ContractorsModule } from '../contractors/contractors.module.ts';
import { InvitationsController } from './invitations.controller.ts';
import { InvitationsService } from './invitations.service.ts';
import { ProjectsController } from './projects.controller.ts';
import { ProjectsService } from './projects.service.ts';

@Module({
  imports: [ContractorsModule],
  controllers: [ProjectsController, InvitationsController],
  providers: [ProjectsService, InvitationsService],
})
export class MatchingModule {}
