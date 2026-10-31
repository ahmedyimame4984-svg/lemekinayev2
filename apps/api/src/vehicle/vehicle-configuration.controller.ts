import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import {
  VehicleConfigurationPublicResponseDto,
  VehicleConfigurationQueryDto,
  VehicleEngineResponseDto,
  VehicleGenerationQueryDto,
  VehicleGenerationResponseDto,
  VehicleNamedMasterResponseDto,
  VehicleSelectorResponseDto,
  VehicleModelDerivativeQueryDto,
  VehicleModelDerivativeResponseDto,
  VehicleTransmissionResponseDto,
  VehicleTrimQueryDto,
  VehicleTrimResponseDto,
} from './dto/vehicle-configuration.dto.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';
import { VehicleConfigurationDetailResponseDto } from './dto/vehicle-configuration-detail.dto.js';

@ApiTags('Vehicle configuration')
@Public()
@Controller('vehicles')
export class VehicleConfigurationController {
  constructor(private readonly vehicles: VehicleConfigurationService) {}

  @Get('derivatives')
  @ApiOperation({ summary: 'List active derivatives/body lines for an active model' })
  @ApiOkResponse({ type: VehicleModelDerivativeResponseDto, isArray: true })
  listDerivatives(@Query() query: VehicleModelDerivativeQueryDto) {
    return this.vehicles.listPublishedDerivatives(query.modelId);
  }

  @Get('generations')
  @ApiOperation({ summary: 'List active generations for an active model' })
  @ApiOkResponse({ type: VehicleGenerationResponseDto, isArray: true })
  listGenerations(@Query() query: VehicleGenerationQueryDto) {
    return this.vehicles.listPublishedGenerations(
      query.modelId,
      query.derivativeId,
    );
  }

  @Get('trims')
  @ApiOperation({ summary: 'List active trims for an active generation' })
  @ApiOkResponse({ type: VehicleTrimResponseDto, isArray: true })
  listTrims(@Query() query: VehicleTrimQueryDto) {
    return this.vehicles.listPublishedTrims(query.generationId);
  }

  @Get('engines')
  @ApiOperation({ summary: 'List active canonical engine master records' })
  @ApiOkResponse({ type: VehicleEngineResponseDto, isArray: true })
  listEngines() {
    return this.vehicles.listPublishedEngines();
  }

  @Get('transmissions')
  @ApiOperation({ summary: 'List active canonical transmission master records' })
  @ApiOkResponse({ type: VehicleTransmissionResponseDto, isArray: true })
  listTransmissions() {
    return this.vehicles.listPublishedTransmissions();
  }

  @Get('body-types')
  @ApiOperation({ summary: 'List active vehicle body types' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto, isArray: true })
  listBodyTypes() {
    return this.vehicles.listPublishedBodyTypes();
  }

  @Get('markets')
  @ApiOperation({ summary: 'List active vehicle markets' })
  @ApiOkResponse({ type: VehicleNamedMasterResponseDto, isArray: true })
  listMarkets() {
    return this.vehicles.listPublishedMarkets();
  }

  @Get('selector')
  @ApiOperation({
    summary:
      'Adaptively narrow active canonical configurations for Garage vehicle identification',
  })
  @ApiOkResponse({ type: VehicleSelectorResponseDto })
  resolveSelector(@Query() query: VehicleConfigurationQueryDto) {
    return this.vehicles.resolveSelector(query);
  }

  @Get('configurations/:id')
  @ApiOperation({
    summary: 'Get the fully resolved technical identity of a configured vehicle',
  })
  @ApiOkResponse({ type: VehicleConfigurationDetailResponseDto })
  getConfiguration(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.getPublishedConfiguration(id);
  }

  @Get('configurations')
  @ApiOperation({
    summary:
      'Resolve active canonical vehicle configurations by model and optional precision filters',
  })
  @ApiOkResponse({ type: VehicleConfigurationPublicResponseDto, isArray: true })
  listConfigurations(@Query() query: VehicleConfigurationQueryDto) {
    return this.vehicles.listPublishedConfigurations(query);
  }
}
