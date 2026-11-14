import { UseGuards } from '@nestjs/common';
import { CanonicalReferenceReadOnlyGuard } from '../reference-sync/canonical-reference-readonly.guard.js';
import {
  Body,
  Controller,
  Get,
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
  CreateVehicleMakeDto,
  CreateVehicleModelDto,
  UpdateVehicleMakeDto,
  UpdateVehicleModelDto,
  VehicleMakeAdminPageQueryDto,
  VehicleMakeAdminQueryDto,
  VehicleMakePageResponseDto,
  VehicleMakeResponseDto,
  VehicleModelAdminPageQueryDto,
  VehicleModelAdminQueryDto,
  VehicleModelPageResponseDto,
  VehicleModelResponseDto,
  VehicleRootSummaryResponseDto,
} from './dto/vehicle.dto.js';
import { VehicleService } from './vehicle.service.js';

@ApiTags('Admin vehicles')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'vehicle.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('vehicle.manage')
@UseGuards(CanonicalReferenceReadOnlyGuard)
@Controller('admin/vehicles')
export class AdminVehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get('makes')
  @ApiOperation({ summary: 'List vehicle makes for administration' })
  @ApiOkResponse({ type: VehicleMakeResponseDto, isArray: true })
  listMakes(
    @Query() query: VehicleMakeAdminQueryDto,
  ): Promise<VehicleMakeResponseDto[]> {
    return this.vehicles.listAdminMakes(query);
  }

  @Get('makes/page')
  @ApiOperation({ summary: 'Search and page vehicle makes for administration' })
  @ApiOkResponse({ type: VehicleMakePageResponseDto })
  listMakesPage(
    @Query() query: VehicleMakeAdminPageQueryDto,
  ): Promise<VehicleMakePageResponseDto> {
    return this.vehicles.listAdminMakesPage(query);
  }

  @Get('makes/:id')
  @ApiOperation({ summary: 'Get one vehicle make for administration' })
  @ApiOkResponse({ type: VehicleMakeResponseDto })
  getMake(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleMakeResponseDto> {
    return this.vehicles.getAdminMake(id);
  }

  @Post('makes')
  @ApiOperation({ summary: 'Create a canonical vehicle make' })
  @ApiCreatedResponse({ type: VehicleMakeResponseDto })
  @ApiConflictResponse({ description: 'Duplicate vehicle make' })
  createMake(
    @Body() input: CreateVehicleMakeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<VehicleMakeResponseDto> {
    return this.vehicles.createMake(input, principal.userId);
  }

  @Patch('makes/:id')
  @ApiOperation({ summary: 'Update a make with optimistic versioning' })
  @ApiOkResponse({ type: VehicleMakeResponseDto })
  @ApiConflictResponse({ description: 'Version or active-child conflict' })
  updateMake(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleMakeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<VehicleMakeResponseDto> {
    return this.vehicles.updateMake(id, input, principal.userId);
  }

  @Get('models')
  @ApiOperation({ summary: 'List vehicle models for administration' })
  @ApiOkResponse({ type: VehicleModelResponseDto, isArray: true })
  listModels(
    @Query() query: VehicleModelAdminQueryDto,
  ): Promise<VehicleModelResponseDto[]> {
    return this.vehicles.listAdminModels(query);
  }

  @Get('models/page')
  @ApiOperation({ summary: 'Search and page vehicle models for administration' })
  @ApiOkResponse({ type: VehicleModelPageResponseDto })
  listModelsPage(
    @Query() query: VehicleModelAdminPageQueryDto,
  ): Promise<VehicleModelPageResponseDto> {
    return this.vehicles.listAdminModelsPage(query);
  }

  @Get('models/:id')
  @ApiOperation({ summary: 'Get one vehicle model for administration' })
  @ApiOkResponse({ type: VehicleModelResponseDto })
  getModel(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleModelResponseDto> {
    return this.vehicles.getAdminModel(id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Summarize vehicle Make and Model master data' })
  @ApiOkResponse({ type: VehicleRootSummaryResponseDto })
  getRootSummary(): Promise<VehicleRootSummaryResponseDto> {
    return this.vehicles.getAdminVehicleRootSummary();
  }

  @Post('models')
  @ApiOperation({ summary: 'Create a canonical vehicle model' })
  @ApiCreatedResponse({ type: VehicleModelResponseDto })
  @ApiConflictResponse({ description: 'Duplicate model or inactive make' })
  createModel(
    @Body() input: CreateVehicleModelDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<VehicleModelResponseDto> {
    return this.vehicles.createModel(input, principal.userId);
  }

  @Patch('models/:id')
  @ApiOperation({ summary: 'Update a model with optimistic versioning' })
  @ApiOkResponse({ type: VehicleModelResponseDto })
  @ApiConflictResponse({ description: 'Version or inactive-make conflict' })
  updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleModelDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<VehicleModelResponseDto> {
    return this.vehicles.updateModel(id, input, principal.userId);
  }
}
