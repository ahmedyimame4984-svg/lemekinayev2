import { UseGuards } from '@nestjs/common';
import { CanonicalReferenceReadOnlyGuard } from '../reference-sync/canonical-reference-readonly.guard.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
  CreateVehicleIdentifierMappingDto,
  ResolveVehicleIdentifierDto,
  UpdateVehicleIdentifierMappingDto,
  VehicleIdentifierMappingQueryDto,
  VehicleIdentifierMappingResponseDto,
  VehicleIdentifierResolutionResponseDto,
} from './dto/vehicle-identification.dto.js';
import { VehicleIdentificationService } from './vehicle-identification.service.js';

@ApiTags('Admin vehicle identifiers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'vehicle.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('vehicle.manage')
@UseGuards(CanonicalReferenceReadOnlyGuard)
@Controller('admin/vehicles/identifiers')
export class AdminVehicleIdentificationController {
  constructor(
    private readonly identification: VehicleIdentificationService,
  ) {}

  @Post('resolve')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Resolve a VIN, chassis, frame, or approved vehicle identifier to canonical configured vehicles for Admin operations',
  })
  @ApiOkResponse({ type: VehicleIdentifierResolutionResponseDto })
  resolve(
    @Body() input: ResolveVehicleIdentifierDto,
  ): Promise<VehicleIdentifierResolutionResponseDto> {
    return this.identification.resolve(input);
  }

  @Get()
  @ApiOperation({
    summary:
      'List canonical VIN/chassis/frame identifier mappings for administration',
  })
  @ApiOkResponse({ type: VehicleIdentifierMappingResponseDto, isArray: true })
  list(@Query() query: VehicleIdentifierMappingQueryDto) {
    return this.identification.listAdminMappings(query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a canonical vehicle identifier mapping without activating unverified data',
  })
  @ApiCreatedResponse({ type: VehicleIdentifierMappingResponseDto })
  @ApiConflictResponse({
    description: 'Duplicate identity or invalid activation state',
  })
  create(
    @Body() input: CreateVehicleIdentifierMappingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.identification.createMapping(input, principal.userId);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Correct mapping target/provenance or lifecycle with optimistic versioning',
  })
  @ApiOkResponse({ type: VehicleIdentifierMappingResponseDto })
  @ApiConflictResponse({
    description: 'Version or lifecycle conflict',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleIdentifierMappingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.identification.updateMapping(
      id,
      input,
      principal.userId,
    );
  }
}
