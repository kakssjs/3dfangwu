import { Module } from '@nestjs/common';
import { RegionsController } from './regions.controller.ts';

@Module({ controllers: [RegionsController] })
export class RegionsModule {}
