import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AdminOnly } from '../auth/auth.guard.ts';
import { CreateTaskDto, DecisionDto, TaskQueryDto } from './tasks.dto.ts';
import { TasksService } from './tasks.service.ts';

/** Your queue and the task records (N3, WORKFLOW.md sections 6.5 and 9.4): the admin key from `.env.local`. */
@AdminOnly()
@Controller('admin/tasks')
export class AdminTasksController {
  private readonly tasks: TasksService;

  constructor(tasks: TasksService) {
    this.tasks = tasks;
  }

  /** The task records, newest first. `?to=you` is your queue of sign-offs (★); `?status=escalated` what failed twice. */
  @Get()
  list(@Query() query: TaskQueryDto) {
    return this.tasks.adminList(query);
  }

  /** Create a task by hand: a sign-off for yourself, a follow-up with a due date, anything the runner should pick up. */
  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto, 'you');
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.get(id);
  }

  /** Your decision (6.5): approving marks a waiting task done, sending it back marks it failed with your note. */
  @Post(':id/decision')
  @HttpCode(200)
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.tasks.decide(id, dto);
  }
}
