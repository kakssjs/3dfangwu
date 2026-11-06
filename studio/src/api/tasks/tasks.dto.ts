import { IsArray, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ArrayMaxSize } from 'class-validator';
import { LANGUAGES, TASK_OWNERS, TASK_STATUSES, type Language, type TaskOwner, type TaskStatus } from '../domain.ts';
import { STAGES, type Stage } from '../../home-record.ts';
import { IsDateOnly, Trim } from '../validation.ts';

export class CreateTaskDto {
  /** One word for what the task is: 'layout', 'verification-sheet', 'follow-up'... */
  @Trim()
  @IsString()
  @Length(1, 60)
  task!: string;

  @IsOptional()
  @IsIn(STAGES)
  stage?: Stage;

  /** The reader's language (D10). Default zh-CN. */
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: Language;

  @IsIn(TASK_OWNERS)
  from!: TaskOwner;

  @IsIn(TASK_OWNERS)
  to!: TaskOwner;

  /** What the task works from: record names or upload ids. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  inputs?: string[];

  /** What a finished task should produce, in one line. */
  @Trim()
  @IsString()
  @Length(1, 200)
  expected!: string;

  /** When it should start, YYYY-MM-DD (China time). Empty: as soon as the runner is free. */
  @IsOptional()
  @IsDateOnly()
  due?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  contractorId?: string;
}

export class TaskQueryDto {
  @IsOptional()
  @IsIn(TASK_OWNERS)
  to?: TaskOwner;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;
}

export class DecisionDto {
  @IsIn(['approve', 'send-back'])
  decision!: 'approve' | 'send-back';

  /** Your note, when you send it back. The waiting agent sees it. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}
