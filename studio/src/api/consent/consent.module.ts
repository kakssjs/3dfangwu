import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller.ts';
import { ConsentService } from './consent.service.ts';

@Module({ controllers: [ConsentController], providers: [ConsentService] })
export class ConsentModule {}
