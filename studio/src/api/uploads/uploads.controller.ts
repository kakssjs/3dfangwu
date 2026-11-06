import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.ts';
import { UploadDto } from './uploads.dto.ts';
import { UploadsService } from './uploads.service.ts';

/** Files people send us (N19): one file per request, as JSON with its bytes in base64. */
@Controller('uploads')
export class UploadsController {
  private readonly uploads: UploadsService;

  constructor(uploads: UploadsService) {
    this.uploads = uploads;
  }

  /** Stores one file: checked by content and size, photo metadata removed (N18). */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UploadDto) {
    return this.uploads.create(user, dto);
  }

  /** The file back, for its owner: the stored bytes, with the photo metadata already gone. */
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.get(user, id);
  }
}
