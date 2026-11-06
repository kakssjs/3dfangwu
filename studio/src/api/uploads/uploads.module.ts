import { Module } from '@nestjs/common';
import { AdminUploadsController, UploadsController } from './uploads.controller.ts';
import { UploadsService } from './uploads.service.ts';

@Module({ controllers: [UploadsController, AdminUploadsController], providers: [UploadsService] })
export class UploadsModule {}
