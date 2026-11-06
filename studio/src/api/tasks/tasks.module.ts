import { Module } from '@nestjs/common';
import { AdminTasksController } from './tasks.controller.ts';
import { TasksService } from './tasks.service.ts';

@Module({ controllers: [AdminTasksController], providers: [TasksService], exports: [TasksService] })
export class TasksModule {}
