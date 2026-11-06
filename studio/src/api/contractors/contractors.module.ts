import { Module } from '@nestjs/common';
import { AdminContractorsController } from './admin.controller.ts';
import { ContractorsController } from './contractors.controller.ts';
import { ContractorsService } from './contractors.service.ts';

@Module({
  controllers: [ContractorsController, AdminContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService],
})
export class ContractorsModule {}
