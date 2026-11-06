import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller.ts';

@Module({ controllers: [MapsController] })
export class MapsModule {}
