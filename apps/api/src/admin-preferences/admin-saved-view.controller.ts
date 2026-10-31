import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AdminSavedViewService } from './admin-saved-view.service.js';
import {
  AdminSavedViewQueryDto,
  AdminSavedViewResponseDto,
  CreateAdminSavedViewDto,
  UpdateAdminSavedViewDto,
} from './dto/admin-saved-view.dto.js';

@ApiTags('Admin preferences')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('admin.portal.access')
@Controller('admin/preferences/saved-views')
export class AdminSavedViewController {
  constructor(private readonly savedViews: AdminSavedViewService) {}

  @Get()
  @ApiOperation({ summary: 'List the current Admin saved views for one scope' })
  @ApiOkResponse({ type: AdminSavedViewResponseDto, isArray: true })
  list(
    @Query() query: AdminSavedViewQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminSavedViewResponseDto[]> {
    return this.savedViews.list(principal.userId, query.scope);
  }

  @Post()
  @ApiOperation({ summary: 'Save the current Admin view state' })
  @ApiCreatedResponse({ type: AdminSavedViewResponseDto })
  create(
    @Body() input: CreateAdminSavedViewDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminSavedViewResponseDto> {
    return this.savedViews.create(principal.userId, input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one current-Admin saved view' })
  @ApiOkResponse({ type: AdminSavedViewResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAdminSavedViewDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminSavedViewResponseDto> {
    return this.savedViews.update(principal.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one current-Admin saved view' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version', ParseIntPipe) version: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    await this.savedViews.remove(principal.userId, id, version);
  }
}
