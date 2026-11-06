import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AdminOnly, CurrentUser, type AuthUser } from '../auth/auth.guard.ts';
import { UploadDto, UploadListQueryDto } from './uploads.dto.ts';
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

  /** Your own files, newest first. `?projectId=` narrows to one project's. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: UploadListQueryDto) {
    return this.uploads.listOwn(user, query.projectId);
  }

  /** The file back, for its owner: the stored bytes, with the photo metadata already gone. */
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.get(user, id);
  }
}

/** Your console (D17): the documents a contractor sent for review, with the admin key from `.env.local`. */
@AdminOnly()
@Controller('admin')
export class AdminUploadsController {
  private readonly uploads: UploadsService;

  constructor(uploads: UploadsService) {
    this.uploads = uploads;
  }

  @Get('accounts/:id/uploads')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.listFor(id);
  }

  @Get('uploads/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.getAny(id);
  }
}
