import { Controller, HttpCode, Post } from '@nestjs/common';
import { AdminOnly } from '../auth/auth.guard.ts';
import { RunnerService } from './runner.ts';

/** The runner, by hand (N3): the admin key from `.env.local`. main.ts also runs it on a timer. */
@AdminOnly()
@Controller('admin/runner')
export class AdminRunnerController {
  private readonly runner: RunnerService;

  constructor(runner: RunnerService) {
    this.runner = runner;
  }

  /** Run every task that is due, once. What happened is in each task's log. */
  @Post('tick')
  @HttpCode(200)
  tick() {
    return this.runner.tick();
  }
}
