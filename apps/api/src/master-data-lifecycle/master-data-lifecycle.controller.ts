import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  DeleteMasterDataRecordDto,
  DeleteMasterDataRecordResponseDto,
  MasterDataLifecycleEntityType,
  MasterDataLifecycleStateResponseDto,
  MasterDataRemovalPreflightResponseDto,
  RestoreMasterDataLifecycleDto,
  TransitionMasterDataLifecycleDto,
} from './dto/master-data-lifecycle.dto.js';
import { MasterDataLifecycleService } from './master-data-lifecycle.service.js';

@ApiTags('Admin catalog lifecycle')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'catalog.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage')
@Controller('admin/catalog/lifecycle')
export class AdminCatalogLifecycleController {
  constructor(private readonly lifecycle: MasterDataLifecycleService) {}

  @Get(':entityType/:id')
  @ApiOperation({
    summary:
      'Read governed lifecycle state and allowed next states for a catalog master record',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  getState(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.getState('CATALOG', entityType, id);
  }

  @Get(':entityType/:id/removal-preflight')
  @ApiOperation({
    summary:
      'Check whether a catalog master record is eligible for permanent deletion and explain blockers',
  })
  @ApiOkResponse({ type: MasterDataRemovalPreflightResponseDto })
  removalPreflight(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.removalPreflight('CATALOG', entityType, id);
  }

  @Post(':entityType/:id/restore')
  @ApiOperation({
    summary:
      'Restore an archived catalog master record to a non-active governed state',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  restore(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RestoreMasterDataLifecycleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.restore(
      'CATALOG',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Post(':entityType/:id/permanent-delete')
  @ApiOperation({
    summary:
      'Permanently delete an unused DRAFT catalog master record using an explicit action endpoint',
  })
  @ApiOkResponse({ type: DeleteMasterDataRecordResponseDto })
  permanentDeleteAction(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeleteMasterDataRecordDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.permanentDelete(
      'CATALOG',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Delete(':entityType/:id')
  @ApiOperation({
    summary:
      'Permanently delete an unused DRAFT catalog master record',
  })
  @ApiOkResponse({ type: DeleteMasterDataRecordResponseDto })
  permanentDelete(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeleteMasterDataRecordDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.permanentDelete(
      'CATALOG',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Patch(':entityType/:id')
  @ApiOperation({
    summary:
      'Deprecate, supersede or archive a catalog master record with audit evidence',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  @ApiConflictResponse({
    description:
      'Version conflict, invalid lifecycle transition, active dependency, or invalid supersession target',
  })
  transition(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TransitionMasterDataLifecycleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.transition(
      'CATALOG',
      entityType,
      id,
      input,
      principal.userId,
    );
  }
}

@ApiTags('Admin vehicle lifecycle')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'vehicle.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('vehicle.manage')
@Controller('admin/vehicles/lifecycle')
export class AdminVehicleLifecycleController {
  constructor(private readonly lifecycle: MasterDataLifecycleService) {}

  @Get(':entityType/:id')
  @ApiOperation({
    summary:
      'Read governed lifecycle state and allowed next states for a vehicle master record',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  getState(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.getState('VEHICLE', entityType, id);
  }

  @Get(':entityType/:id/removal-preflight')
  @ApiOperation({
    summary:
      'Check whether a vehicle master record is eligible for permanent deletion and explain blockers',
  })
  @ApiOkResponse({ type: MasterDataRemovalPreflightResponseDto })
  removalPreflight(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.removalPreflight('VEHICLE', entityType, id);
  }

  @Post(':entityType/:id/restore')
  @ApiOperation({
    summary:
      'Restore an archived vehicle master record to a non-active governed state',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  restore(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RestoreMasterDataLifecycleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.restore(
      'VEHICLE',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Post(':entityType/:id/permanent-delete')
  @ApiOperation({
    summary:
      'Permanently delete an unused DRAFT vehicle master record using an explicit action endpoint',
  })
  @ApiOkResponse({ type: DeleteMasterDataRecordResponseDto })
  permanentDeleteAction(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeleteMasterDataRecordDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.permanentDelete(
      'VEHICLE',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Delete(':entityType/:id')
  @ApiOperation({
    summary:
      'Permanently delete an unused DRAFT vehicle master record when identity retention permits it',
  })
  @ApiOkResponse({ type: DeleteMasterDataRecordResponseDto })
  permanentDelete(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeleteMasterDataRecordDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.permanentDelete(
      'VEHICLE',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Patch(':entityType/:id')
  @ApiOperation({
    summary:
      'Deprecate, supersede or archive a vehicle master record with audit evidence',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  @ApiConflictResponse({
    description:
      'Version conflict, invalid lifecycle transition, active dependency, or invalid supersession target',
  })
  transition(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TransitionMasterDataLifecycleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.transition(
      'VEHICLE',
      entityType,
      id,
      input,
      principal.userId,
    );
  }
}


@ApiTags('Admin sourcing lifecycle')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'sourcing.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('sourcing.manage')
@Controller('admin/sourcing/lifecycle')
export class AdminSourcingLifecycleController {
  constructor(private readonly lifecycle: MasterDataLifecycleService) {}

  @Get(':entityType/:id')
  @ApiOperation({
    summary:
      'Read governed lifecycle state and allowed next states for a sourcing master record',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  getState(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.getState('SOURCING', entityType, id);
  }

  @Get(':entityType/:id/removal-preflight')
  @ApiOperation({
    summary:
      'Check whether a sourcing master record is eligible for permanent deletion and explain blockers',
  })
  @ApiOkResponse({ type: MasterDataRemovalPreflightResponseDto })
  removalPreflight(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.removalPreflight('SOURCING', entityType, id);
  }

  @Post(':entityType/:id/restore')
  @ApiOperation({
    summary:
      'Restore an archived sourcing master record to a non-active governed state',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  restore(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RestoreMasterDataLifecycleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.restore(
      'SOURCING',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Post(':entityType/:id/permanent-delete')
  @ApiOperation({
    summary:
      'Permanently delete an unused DRAFT sourcing master record using an explicit action endpoint',
  })
  @ApiOkResponse({ type: DeleteMasterDataRecordResponseDto })
  permanentDeleteAction(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeleteMasterDataRecordDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.permanentDelete(
      'SOURCING',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Delete(':entityType/:id')
  @ApiOperation({
    summary:
      'Permanently delete an unused DRAFT sourcing master record',
  })
  @ApiOkResponse({ type: DeleteMasterDataRecordResponseDto })
  permanentDelete(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeleteMasterDataRecordDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.permanentDelete(
      'SOURCING',
      entityType,
      id,
      input,
      principal.userId,
    );
  }

  @Patch(':entityType/:id')
  @ApiOperation({
    summary:
      'Deprecate, supersede or archive a sourcing master record with audit evidence',
  })
  @ApiOkResponse({ type: MasterDataLifecycleStateResponseDto })
  transition(
    @Param('entityType', new ParseEnumPipe(MasterDataLifecycleEntityType))
    entityType: MasterDataLifecycleEntityType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TransitionMasterDataLifecycleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.lifecycle.transition(
      'SOURCING',
      entityType,
      id,
      input,
      principal.userId,
    );
  }
}
