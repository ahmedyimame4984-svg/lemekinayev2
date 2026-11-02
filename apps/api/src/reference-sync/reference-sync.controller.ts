import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import { ReferenceSyncService } from './reference-sync.service.js';
import { SyncResult, SyncStatusReport } from './reference-sync.types.js';

export class TriggerSnapshotDto {
  @ApiPropertyOptional({
    description: 'Whether to force a complete re-sync from beginning',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceFull?: boolean;
}

@ApiTags('Admin reference sync')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({
  description: 'catalog.manage and vehicle.manage permissions are required',
})
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage', 'vehicle.manage')
@Controller('admin/reference-sync')
export class ReferenceSyncController {
  constructor(private readonly syncService: ReferenceSyncService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current Autotechdoc synchronization status and checkpoint' })
  @ApiOkResponse({ description: 'Current synchronization status report' })
  async getStatus(): Promise<SyncStatusReport> {
    return this.syncService.getStatus();
  }

  @Post('snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger full or resumed canonical snapshot synchronization' })
  @ApiOkResponse({ description: 'Snapshot synchronization execution result' })
  async triggerSnapshot(@Body() body?: TriggerSnapshotDto): Promise<SyncResult> {
    return this.syncService.executeSnapshot({ forceFull: body?.forceFull });
  }

  @Post('incremental')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger incremental synchronization from last committed cursor' })
  @ApiOkResponse({ description: 'Incremental synchronization execution result' })
  async triggerIncremental(): Promise<SyncResult> {
    return this.syncService.executeIncrementalSync();
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reconcile local reference data counts against remote canonical manifest' })
  @ApiOkResponse({ description: 'Reconciliation report' })
  async triggerReconciliation(): Promise<{
    reconciledEntities: Record<string, { remoteCount: number; localCount: number; repaired: number }>;
    durationMs: number;
  }> {
    return this.syncService.executeReconciliation();
  }
}
