import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller.ts';
import { UploadsService } from './uploads.service.ts';

@Module({ controllers: [UploadsController], providers: [UploadsService] })
export class UploadsModule {}
