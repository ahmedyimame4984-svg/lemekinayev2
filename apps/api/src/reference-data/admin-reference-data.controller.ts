import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsIn } from 'class-validator';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  MasterReferenceService,
  type AttributeMasterInstallResult,
  type MasterReferenceInstallResult,
  type MasterReferenceStatus,
} from './master-reference.service.js';
import {
  StrategicVehicleCoverageService,
  type StrategicVehicleCoverageReconcileResult,
} from './strategic-vehicle-coverage.service.js';

class ReplaceMasterReferenceDataDto {
  @ApiProperty({
    example: 'REPLACE',
    description: 'Explicit confirmation required for destructive replacement',
  })
  @IsIn(['REPLACE'])
  confirmation!: 'REPLACE';
}

@ApiTags('Admin reference data')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({
  description: 'catalog.manage and vehicle.manage are required',
})
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage', 'vehicle.manage')
@Controller('admin/reference-data')
export class AdminReferenceDataController {
  constructor(
    private readonly referenceData: MasterReferenceService,
    private readonly strategicVehicleCoverage: StrategicVehicleCoverageService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Read canonical catalog and vehicle master-data status',
  })
  @ApiOkResponse({
    description:
      'Returns current Admin-managed counts, Attribute baseline targets, and linked record totals',
  })
  status(): Promise<MasterReferenceStatus> {
    return this.referenceData.status();
  }

  @Post('attributes/reconcile')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('catalog.manage')
  @ApiOperation({
    summary:
      'Reconcile the canonical Master Attribute Library in place without replacing vehicle or catalog identities',
  })
  @ApiOkResponse({
    description:
      'Missing and changed canonical Attribute master records were reconciled while existing identities and dependent records were preserved',
  })
  reconcileAttributes(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeMasterInstallResult> {
    return this.referenceData.reconcileAttributes(principal.userId);
  }

  @Post('vehicles/strategic-coverage/reconcile')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('vehicle.manage')
  @ApiOperation({
    summary:
      'Retired legacy vehicle installer; returns LEGACY_VEHICLE_LIBRARY_RETIRED',
  })
  @ApiOkResponse({
    description:
      'Legacy installation is disabled; audit and validate an Ethiopia LHD reconstruction plan',
  })
  reconcileStrategicVehicleCoverage(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<StrategicVehicleCoverageReconcileResult> {
    return this.strategicVehicleCoverage.reconcile(principal.userId);
  }

  @Post('replace')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Retired full master replacement; use audited reconstruction',
  })
  @ApiOkResponse({
    description:
      'Full replacement is disabled; vehicle identities are preserved',
  })
  replace(
    @Body() _input: ReplaceMasterReferenceDataDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<MasterReferenceInstallResult> {
    return this.referenceData.replace(principal.userId);
  }
}
