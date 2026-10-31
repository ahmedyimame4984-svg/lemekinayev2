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
  CreateMasterDataProvenanceDto,
  MasterDataProvenanceResponseDto,
  UpdateMasterDataProvenanceDto,
} from '../common/master-data-provenance.dto.js';
import {
  CreateVehicleConfigurationDto,
  CreateVehicleEngineDto,
  CreateVehicleGenerationDto,
  CreateVehicleNamedMasterDto,
  CreateVehicleModelDerivativeDto,
  CreateVehicleTransmissionDto,
  CreateVehicleTrimDto,
  UpdateVehicleConfigurationDto,
  UpdateVehicleEngineDto,
  UpdateVehicleGenerationDto,
  UpdateVehicleNamedMasterDto,
  UpdateVehicleModelDerivativeDto,
  UpdateVehicleTransmissionDto,
  UpdateVehicleTrimDto,
  VehicleConfigurationActivationValidationResponseDto,
  VehicleConfigurationAdminPageQueryDto,
  VehicleConfigurationAdminQueryDto,
  VehicleConfigurationAdminSummaryResponseDto,
  VehicleConfigurationResponseDto,
  VehicleEngineAdminQueryDto,
  VehicleEnginePageResponseDto,
  VehicleEngineResponseDto,
  VehicleGenerationAdminPageQueryDto,
  VehicleGenerationAdminQueryDto,
  VehicleGenerationPageResponseDto,
  VehicleGenerationResponseDto,
  VehicleNamedMasterAdminQueryDto,
  VehicleNamedMasterPageResponseDto,
  VehicleNamedMasterResponseDto,
  VehicleModelDerivativeAdminPageQueryDto,
  VehicleModelDerivativeAdminQueryDto,
  VehicleModelDerivativePageResponseDto,
  VehicleModelDerivativeResponseDto,
  VehicleTechnicalMasterAdminPageQueryDto,
  VehicleTransmissionAdminQueryDto,
  VehicleTransmissionPageResponseDto,
  VehicleTransmissionResponseDto,
  VehicleTrimAdminPageQueryDto,
  VehicleTrimAdminQueryDto,
  VehicleTrimPageResponseDto,
  VehicleTrimResponseDto,
} from './dto/vehicle-configuration.dto.js';
import {
  VehicleConfigurationAdminLibraryPageDto,
} from './dto/vehicle-configuration-detail.dto.js';
import {
  VehicleConfigurationCsvExportResponseDto,
} from './dto/vehicle-configuration-import-export.dto.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';

@ApiTags('Admin vehicle configuration')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'vehicle.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('vehicle.manage')
@Controller('admin/vehicles')
export class AdminVehicleConfigurationController {
  constructor(private readonly vehicles: VehicleConfigurationService) {}

  @Get('derivatives')
  @ApiOperation({ summary: 'List model derivatives/body lines for administration' })
  @ApiOkResponse({ type: VehicleModelDerivativeResponseDto, isArray: true })
  listDerivatives(@Query() query: VehicleModelDerivativeAdminQueryDto) {
    return this.vehicles.listAdminDerivatives(query);
  }

  @Get('derivatives/page')
  @ApiOperation({ summary: 'Search and page model derivatives/body lines' })
  @ApiOkResponse({ type: VehicleModelDerivativePageResponseDto })
  listDerivativesPage(
    @Query() query: VehicleModelDerivativeAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminDerivativesPage(query);
  }

  @Get('derivatives/:id')
  @ApiOperation({ summary: 'Get one model derivative/body line for administration' })
  @ApiOkResponse({ type: VehicleModelDerivativeResponseDto })
  getDerivative(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminDerivative(id);
  }

  @Post('derivatives')
  @ApiOperation({ summary: 'Create a model derivative/body line' })
  @ApiCreatedResponse({ type: VehicleModelDerivativeResponseDto })
  createDerivative(
    @Body() input: CreateVehicleModelDerivativeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createDerivative(input, principal.userId);
  }

  @Patch('derivatives/:id')
  @ApiOperation({ summary: 'Update a model derivative/body line' })
  @ApiOkResponse({ type: VehicleModelDerivativeResponseDto })
  @ApiConflictResponse({ description: 'Version, lifecycle, or dependency conflict' })
  updateDerivative(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleModelDerivativeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateDerivative(id, input, principal.userId);
  }

  @Get('generations')
  @ApiOperation({ summary: 'List vehicle generations for administration' })
  @ApiOkResponse({ type: VehicleGenerationResponseDto, isArray: true })
  listGenerations(@Query() query: VehicleGenerationAdminQueryDto) {
    return this.vehicles.listAdminGenerations(query);
  }

  @Get('generations/page')
  @ApiOperation({ summary: 'Search and page vehicle generations' })
  @ApiOkResponse({ type: VehicleGenerationPageResponseDto })
  listGenerationsPage(
    @Query() query: VehicleGenerationAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminGenerationsPage(query);
  }

  @Get('generations/:id')
  @ApiOperation({ summary: 'Get one vehicle generation for administration' })
  @ApiOkResponse({ type: VehicleGenerationResponseDto })
  getGeneration(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminGeneration(id);
  }

  @Post('generations')
  @ApiOperation({ summary: 'Create a vehicle generation' })
  @ApiCreatedResponse({ type: VehicleGenerationResponseDto })
  createGeneration(
    @Body() input: CreateVehicleGenerationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createGeneration(input, principal.userId);
  }

  @Patch('generations/:id')
  @ApiOperation({ summary: 'Update a vehicle generation' })
  @ApiOkResponse({ type: VehicleGenerationResponseDto })
  @ApiConflictResponse({ description: 'Version, lifecycle, or dependency conflict' })
  updateGeneration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleGenerationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateGeneration(id, input, principal.userId);
  }

  @Get('trims')
  @ApiOperation({ summary: 'List vehicle trims for administration' })
  @ApiOkResponse({ type: VehicleTrimResponseDto, isArray: true })
  listTrims(@Query() query: VehicleTrimAdminQueryDto) {
    return this.vehicles.listAdminTrims(query);
  }

  @Get('trims/page')
  @ApiOperation({ summary: 'Search and page vehicle trims' })
  @ApiOkResponse({ type: VehicleTrimPageResponseDto })
  listTrimsPage(
    @Query() query: VehicleTrimAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminTrimsPage(query);
  }

  @Get('trims/:id')
  @ApiOperation({ summary: 'Get one vehicle trim for administration' })
  @ApiOkResponse({ type: VehicleTrimResponseDto })
  getTrim(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminTrim(id);
  }

  @Post('trims')
  @ApiOperation({ summary: 'Create a vehicle trim/variant' })
  @ApiCreatedResponse({ type: VehicleTrimResponseDto })
  createTrim(
    @Body() input: CreateVehicleTrimDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createTrim(input, principal.userId);
  }

  @Patch('trims/:id')
  @ApiOperation({ summary: 'Update a vehicle trim/variant' })
  @ApiOkResponse({ type: VehicleTrimResponseDto })
  @ApiConflictResponse({ description: 'Version, lifecycle, or dependency conflict' })
  updateTrim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleTrimDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateTrim(id, input, principal.userId);
  }

  @Get('engines')
  @ApiOperation({ summary: 'List vehicle engines for administration' })
  @ApiOkResponse({ type: VehicleEngineResponseDto, isArray: true })
  listEngines(@Query() query: VehicleEngineAdminQueryDto) {
    return this.vehicles.listAdminEngines(query);
  }

  @Get('engines/page')
  @ApiOperation({ summary: 'Search and page engine master records' })
  @ApiOkResponse({ type: VehicleEnginePageResponseDto })
  listEnginesPage(
    @Query() query: VehicleTechnicalMasterAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminEnginesPage(query);
  }

  @Get('engines/:id')
  @ApiOperation({ summary: 'Get one engine master record' })
  @ApiOkResponse({ type: VehicleEngineResponseDto })
  getEngine(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminEngine(id);
  }

  @Post('engines')
  @ApiOperation({ summary: 'Create a canonical engine master record' })
  @ApiCreatedResponse({ type: VehicleEngineResponseDto })
  createEngine(
    @Body() input: CreateVehicleEngineDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createEngine(input, principal.userId);
  }

  @Patch('engines/:id')
  @ApiOperation({ summary: 'Update a canonical engine master record' })
  @ApiOkResponse({ type: VehicleEngineResponseDto })
  updateEngine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleEngineDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateEngine(id, input, principal.userId);
  }

  @Get('transmissions')
  @ApiOperation({ summary: 'List vehicle transmissions for administration' })
  @ApiOkResponse({ type: VehicleTransmissionResponseDto, isArray: true })
  listTransmissions(@Query() query: VehicleTransmissionAdminQueryDto) {
    return this.vehicles.listAdminTransmissions(query);
  }

  @Get('transmissions/page')
  @ApiOperation({ summary: 'Search and page transmission master records' })
  @ApiOkResponse({ type: VehicleTransmissionPageResponseDto })
  listTransmissionsPage(
    @Query() query: VehicleTechnicalMasterAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminTransmissionsPage(query);
  }

  @Get('transmissions/:id')
  @ApiOperation({ summary: 'Get one transmission master record' })
  @ApiOkResponse({ type: VehicleTransmissionResponseDto })
  getTransmission(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminTransmission(id);
  }

  @Post('transmissions')
  @ApiOperation({ summary: 'Create a canonical transmission master record' })
  @ApiCreatedResponse({ type: VehicleTransmissionResponseDto })
  createTransmission(
    @Body() input: CreateVehicleTransmissionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createTransmission(input, principal.userId);
  }

  @Patch('transmissions/:id')
  @ApiOperation({ summary: 'Update a canonical transmission master record' })
  @ApiOkResponse({ type: VehicleTransmissionResponseDto })
  updateTransmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleTransmissionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateTransmission(id, input, principal.userId);
  }

  @Get('body-types')
  @ApiOperation({ summary: 'List vehicle body types for administration' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto, isArray: true })
  listBodyTypes(@Query() query: VehicleNamedMasterAdminQueryDto) {
    return this.vehicles.listAdminBodyTypes(query);
  }

  @Get('body-types/page')
  @ApiOperation({ summary: 'Search and page vehicle body types' })
  @ApiOkResponse({ type: VehicleNamedMasterPageResponseDto })
  listBodyTypesPage(
    @Query() query: VehicleTechnicalMasterAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminBodyTypesPage(query);
  }

  @Get('body-types/:id')
  @ApiOperation({ summary: 'Get one vehicle body type' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto })
  getBodyType(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminBodyType(id);
  }

  @Post('body-types')
  @ApiOperation({ summary: 'Create a vehicle body type' })
  @ApiCreatedResponse({ type: VehicleNamedMasterResponseDto })
  createBodyType(
    @Body() input: CreateVehicleNamedMasterDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createBodyType(input, principal.userId);
  }

  @Patch('body-types/:id')
  @ApiOperation({ summary: 'Update a vehicle body type' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto })
  updateBodyType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleNamedMasterDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateBodyType(id, input, principal.userId);
  }

  @Get('markets')
  @ApiOperation({ summary: 'List vehicle markets for administration' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto, isArray: true })
  listMarkets(@Query() query: VehicleNamedMasterAdminQueryDto) {
    return this.vehicles.listAdminMarkets(query);
  }

  @Get('markets/page')
  @ApiOperation({ summary: 'Search and page vehicle markets' })
  @ApiOkResponse({ type: VehicleNamedMasterPageResponseDto })
  listMarketsPage(
    @Query() query: VehicleTechnicalMasterAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminMarketsPage(query);
  }

  @Get('markets/:id')
  @ApiOperation({ summary: 'Get one vehicle market' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto })
  getMarket(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminMarket(id);
  }

  @Post('markets')
  @ApiOperation({ summary: 'Create a vehicle market' })
  @ApiCreatedResponse({ type: VehicleNamedMasterResponseDto })
  createMarket(
    @Body() input: CreateVehicleNamedMasterDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createMarket(input, principal.userId);
  }

  @Patch('markets/:id')
  @ApiOperation({ summary: 'Update a vehicle market' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto })
  updateMarket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleNamedMasterDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateMarket(id, input, principal.userId);
  }

  @Get('configurations/summary')
  @ApiOperation({ summary: 'Summarize configured vehicles for the Admin overview' })
  @ApiOkResponse({ type: VehicleConfigurationAdminSummaryResponseDto })
  getConfigurationSummary() {
    return this.vehicles.getAdminConfigurationSummary();
  }

  @Get('configurations')
  @ApiOperation({ summary: 'List canonical vehicle configurations for administration' })
  @ApiOkResponse({ type: VehicleConfigurationResponseDto, isArray: true })
  listConfigurations(@Query() query: VehicleConfigurationAdminQueryDto) {
    return this.vehicles.listAdminConfigurations(query);
  }

  @Get('configurations/library')
  @ApiOperation({
    summary: 'Search and page resolved configured vehicles for the Admin library',
  })
  @ApiOkResponse({ type: VehicleConfigurationAdminLibraryPageDto })
  listConfigurationLibrary(
    @Query() query: VehicleConfigurationAdminPageQueryDto,
  ) {
    return this.vehicles.listAdminConfigurationLibraryPage(query);
  }

  @Get('configurations/export')
  @ApiOperation({
    summary: 'Export the current filtered Configured Vehicle library as CSV',
  })
  @ApiOkResponse({ type: VehicleConfigurationCsvExportResponseDto })
  exportConfigurations(@Query() query: VehicleConfigurationAdminPageQueryDto) {
    return this.vehicles.exportConfigurationCsv(query);
  }

  @Get('configurations/:id')
  @ApiOperation({ summary: 'Get one vehicle configuration for administration' })
  @ApiOkResponse({ type: VehicleConfigurationResponseDto })
  getConfiguration(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getAdminConfiguration(id);
  }

  @Get('configurations/:id/provenance')
  @ApiOperation({ summary: 'List source provenance for one configured vehicle' })
  @ApiOkResponse({ type: MasterDataProvenanceResponseDto, isArray: true })
  listConfigurationProvenance(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MasterDataProvenanceResponseDto[]> {
    return this.vehicles.listConfigurationProvenance(id);
  }

  @Post('configurations/:id/provenance')
  @ApiOperation({ summary: 'Add source provenance to one configured vehicle' })
  @ApiCreatedResponse({ type: MasterDataProvenanceResponseDto })
  createConfigurationProvenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateMasterDataProvenanceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<MasterDataProvenanceResponseDto> {
    return this.vehicles.createConfigurationProvenance(
      id,
      input,
      principal.userId,
    );
  }

  @Patch('configurations/:id/provenance/:provenanceId')
  @ApiOperation({ summary: 'Update configured-vehicle source provenance' })
  @ApiOkResponse({ type: MasterDataProvenanceResponseDto })
  @ApiConflictResponse({ description: 'Provenance version conflict' })
  updateConfigurationProvenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('provenanceId', ParseUUIDPipe) provenanceId: string,
    @Body() input: UpdateMasterDataProvenanceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<MasterDataProvenanceResponseDto> {
    return this.vehicles.updateConfigurationProvenance(
      id,
      provenanceId,
      input,
      principal.userId,
    );
  }

  @Get('configurations/:id/validate-activation')
  @ApiOperation({
    summary: 'Validate a configured vehicle against all activation rules',
  })
  @ApiOkResponse({ type: VehicleConfigurationActivationValidationResponseDto })
  @ApiConflictResponse({
    description: 'Hierarchy, lifecycle, year-range, or reference validation failed',
  })
  validateConfigurationActivation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleConfigurationActivationValidationResponseDto> {
    return this.vehicles.validateConfigurationActivation(id);
  }

  @Post('configurations')
  @ApiOperation({ summary: 'Create a canonical vehicle configuration' })
  @ApiCreatedResponse({ type: VehicleConfigurationResponseDto })
  @ApiConflictResponse({ description: 'Hierarchy, lifecycle, year-range, or duplicate conflict' })
  createConfiguration(
    @Body() input: CreateVehicleConfigurationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.createConfiguration(input, principal.userId);
  }

  @Patch('configurations/:id')
  @ApiOperation({ summary: 'Update a canonical vehicle configuration' })
  @ApiOkResponse({ type: VehicleConfigurationResponseDto })
  @ApiConflictResponse({ description: 'Version, hierarchy, lifecycle, or year-range conflict' })
  updateConfiguration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleConfigurationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicles.updateConfiguration(id, input, principal.userId);
  }
}
