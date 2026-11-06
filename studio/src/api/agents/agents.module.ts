import { Module, type DynamicModule } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TasksModule } from '../tasks/tasks.module.ts';
import { AdminRunnerController } from './agents.controller.ts';
import { DEEP_MODEL } from '../tokens.ts';
import { DeepAgentService } from './deep.ts';
import { MimoClient } from './mimo.ts';
import { RunnerService } from './runner.ts';
import { ToolsService } from './tools.ts';

/**
 * The agent framework (N3): the runner, the two agents' tools and their MiMo client (WORKFLOW.md
 * section 5). The client is injected — the tests hand in a stub transport; the app hands in the
 * real one from `.env.local`.
 */
@Module({})
export class AgentsModule {
  static register(client: MimoClient, deepModel: BaseChatModel | null): DynamicModule {
    return {
      module: AgentsModule,
      imports: [TasksModule],
      controllers: [AdminRunnerController],
      providers: [ToolsService, RunnerService, DeepAgentService, { provide: MimoClient, useValue: client }, { provide: DEEP_MODEL, useValue: deepModel }],
      exports: [RunnerService],
    };
  }
}
