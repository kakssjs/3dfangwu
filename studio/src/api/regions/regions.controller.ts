import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/auth.guard.ts';
import { PROVINCES } from './regions.ts';

/** The real provinces, cities and districts the pickers offer (the data is public and changes rarely). */
@Public()
@Controller('regions')
export class RegionsController {
  @Get()
  @Header('Cache-Control', 'public, max-age=86400')
  list() {
    return { provinces: PROVINCES };
  }
}
