import { Body, Controller, Get, Header, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth.guard.ts';
import { CreateFromImageDto, CreateHomeDto, SaveDesignDto } from './homes.dto.ts';
import { HomesService } from './homes.service.ts';

/** Homes and their 3D links (F1, F6): the plan and the design versions the homeowner saves. */
@Controller('homes')
export class HomesController {
  private readonly homes: HomesService;

  constructor(homes: HomesService) {
    this.homes = homes;
  }

  /** A new home, with its plan in the F2 format and a private 3D link. */
  @Post()
  @Roles('homeowner')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHomeDto) {
    return this.homes.create(user, dto);
  }

  /** N4: a floor-plan photo (one of the uploads) read into a plan, checked, and kept as a home. */
  @Post('from-image')
  @Roles('homeowner')
  createFromImage(@CurrentUser() user: AuthUser, @Body() dto: CreateFromImageDto) {
    return this.homes.createFromImage(user, dto);
  }

  /** N4's overlay: the source photo with the reading drawn over it, for the eye-check. */
  @Get(':id/plan-overlay.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Roles('homeowner')
  overlay(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.homes.planOverlay(user, id);
  }

  /** The homeowner's homes, each with its 3D link. */
  @Get('mine')
  @Roles('homeowner')
  listOwn(@CurrentUser() user: AuthUser) {
    return this.homes.listOwn(user);
  }

  /** One home behind its id: the plan, the link and the saved versions (numbers, not states). */
  @Get(':id')
  @Roles('homeowner')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.homes.getOwn(user, id);
  }

  /** A new 3D link for the home; the old one stops working (D7: links can be replaced). */
  @Post(':id/link')
  @Roles('homeowner')
  rotateLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.homes.rotateLink(user, id);
  }

  /** F6: the homeowner's edits, saved as the next numbered design version. */
  @Post(':id/designs')
  @Roles('homeowner')
  saveDesign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveDesignDto) {
    return this.homes.saveDesign(user, id, dto);
  }

  /** F6: the design version the homeowner confirms. */
  @Post(':id/designs/:number/confirm')
  @HttpCode(200)
  @Roles('homeowner')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('number', ParseIntPipe) number: number) {
    return this.homes.confirmDesign(user, id, number);
  }
}

/**
 * The 3D link (F1): floorplan-3d loads the plan and the design versions through it, and saves
 * versions (F6). The token in the link is the only key — that is what makes the link private.
 */
@Public()
@Controller('plan-links')
export class PlanLinksController {
  private readonly homes: HomesService;

  constructor(homes: HomesService) {
    this.homes = homes;
  }

  @Get(':token')
  get(@Param('token') token: string) {
    return this.homes.getByToken(token);
  }

  @Post(':token/designs')
  saveDesign(@Param('token') token: string, @Body() dto: SaveDesignDto) {
    return this.homes.saveDesignByToken(token, dto);
  }

  /** F6: the version the homeowner confirms, from the editor (the link is the key). */
  @Post(':token/designs/:number/confirm')
  @HttpCode(200)
  confirm(@Param('token') token: string, @Param('number', ParseIntPipe) number: number) {
    return this.homes.confirmDesignByToken(token, number);
  }
}
