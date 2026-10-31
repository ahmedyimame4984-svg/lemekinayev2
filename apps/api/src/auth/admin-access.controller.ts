import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from './auth.decorators.js';
import type { AuthPrincipal } from './auth.types.js';

@ApiTags('Admin access')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'admin.portal.access is required' })
@Controller('admin')
export class AdminAccessController {
  @Get('me')
  @RequireAccountTypes(AccountType.ADMIN)
  @RequirePermissions('admin.portal.access')
  @ApiOkResponse({ description: 'Admin Portal identity and permissions' })
  getAdminPrincipal(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): AuthPrincipal {
    return principal;
  }
}
