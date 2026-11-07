import { Controller, Get, Inject, Module, NotFoundException, Param, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { asc, count, eq } from 'drizzle-orm';
import { Public } from '../auth/auth.guard.ts';
import { DB } from '../tokens.ts';
import type { Db } from '../db/database.ts';
import { referenceEntries } from '../db/schema.ts';
import { REFERENCE_KINDS } from './reference-data.ts';
class ReferenceQuery {
  @IsOptional() @IsIn(REFERENCE_KINDS) kind?: typeof REFERENCE_KINDS[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) offset = 0;
}
@Public()
@Controller('reference-data')
class ReferenceDataController {
  private readonly db: Db;
  constructor(@Inject(DB) db: Db) { this.db = db; }
  @Get('stats') async stats() {
    return { referenceOnly: true, counts: await this.db.select({kind: referenceEntries.kind, count: count()}).from(referenceEntries).groupBy(referenceEntries.kind) };
  }
  @Get() async list(@Query() query: ReferenceQuery) {
    const where = query.kind ? eq(referenceEntries.kind, query.kind) : undefined;
    const [items, totals] = await Promise.all([
      this.db.select().from(referenceEntries).where(where).orderBy(asc(referenceEntries.id)).limit(query.limit).offset(query.offset),
      this.db.select({count: count()}).from(referenceEntries).where(where),
    ]);
    return { referenceOnly: true, total: totals[0]?.count ?? 0, items };
  }
  @Get(':id') async get(@Param('id') id: string) {
    const [item] = await this.db.select().from(referenceEntries).where(eq(referenceEntries.id, id));
    if (!item) throw new NotFoundException('Reference record not found');
    return { referenceOnly: true, item };
  }
}
@Module({controllers: [ReferenceDataController]})
export class ReferenceDataModule {}
