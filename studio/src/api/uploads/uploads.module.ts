import { Module } from '@nestjs/common';
import { AdminUploadsController, UploadsController } from './uploads.controller.ts';
import { UploadsService } from './uploads.service.ts';

@Module({ controllers: [UploadsController, AdminUploadsController], providers: [UploadsService], exports: [UploadsService] })
export class UploadsModule {}
