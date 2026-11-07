import { Module, type DynamicModule } from '@nestjs/common';
import { MimoClient } from '../agents/mimo.ts';
import { BACKUP_READERS } from '../tokens.ts';
import { UploadsModule } from '../uploads/uploads.module.ts';
import { HomesController, PlanLinksController } from './homes.controller.ts';
import { HomesService } from './homes.service.ts';

/**
 * Homes, their plans and their design versions (F1, F2, F6, N4). The MiMo client comes in from
 * `AppModule.register` — the same one the agents use — with the boss's backup readers (Doubao,
 * Agnes AI) in order. The tests hand in stub transports.
 */
@Module({})
export class HomesModule {
  static register(client: MimoClient, backups: MimoClient[]): DynamicModule {
    return {
      module: HomesModule,
      imports: [UploadsModule],
      controllers: [HomesController, PlanLinksController],
      providers: [HomesService, { provide: MimoClient, useValue: client }, { provide: BACKUP_READERS, useValue: backups }],
    };
  }
}
