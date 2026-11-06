import { Module } from '@nestjs/common';
import { ContractorsModule } from '../contractors/contractors.module.ts';
import { BidsController } from './bids.controller.ts';
import { BidsService } from './bids.service.ts';
import { ProjectsController } from './projects.controller.ts';
import { ProjectsService } from './projects.service.ts';

@Module({
  imports: [ContractorsModule],
  controllers: [ProjectsController, BidsController],
  providers: [ProjectsService, BidsService],
})
export class BiddingModule {}
