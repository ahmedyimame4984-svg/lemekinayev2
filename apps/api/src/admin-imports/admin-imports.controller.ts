import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AdminImportsService } from './admin-imports.service.js';
import {
  AdminImportJobPageQueryDto,
  AdminImportJobPageResponseDto,
} from './dto/admin-import-job.dto.js';

@ApiTags('Admin imports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@RequireAccountTypes(AccountType.ADMIN)
@Controller('admin/imports')
export class AdminImportsController {
  constructor(private readonly imports: AdminImportsService) {}

  @Get('jobs')
  @ApiOperation({
    summary:
      'Page import jobs visible to the current Admin based on domain permissions',
  })
  @ApiOkResponse({ type: AdminImportJobPageResponseDto })
  listJobs(
    @Query() query: AdminImportJobPageQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminImportJobPageResponseDto> {
    return this.imports.listJobs(query, principal);
  }
}
