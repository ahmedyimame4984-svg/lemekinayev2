import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import {
  AuditEntityHistoryQueryDto,
  AuditEntityHistoryResponseDto,
  AuditLogAdminPageQueryDto,
  AuditLogPageResponseDto,
} from './dto/audit-log.dto.js';
import { AuditService } from './audit.service.js';

@ApiTags('Admin audit history')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'admin.audit.read is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('admin.audit.read')
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('entities/:entityType/:entityId/history')
  @ApiOperation({
    summary:
      'Read one entity version timeline including related catalog/fitment events',
  })
  @ApiOkResponse({ type: AuditEntityHistoryResponseDto })
  entityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: AuditEntityHistoryQueryDto,
  ): Promise<AuditEntityHistoryResponseDto> {
    return this.audit.getEntityHistory(entityType, entityId, query);
  }

  @Get()
  @ApiOperation({ summary: 'Search and page immutable Admin audit history' })
  @ApiOkResponse({ type: AuditLogPageResponseDto })
  list(
    @Query() query: AuditLogAdminPageQueryDto,
  ): Promise<AuditLogPageResponseDto> {
    return this.audit.listAdminAuditLogs(query);
  }
}
