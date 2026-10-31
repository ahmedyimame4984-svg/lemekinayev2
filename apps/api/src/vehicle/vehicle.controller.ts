import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import {
  VehicleMakeResponseDto,
  VehicleModelQueryDto,
  VehicleModelResponseDto,
} from './dto/vehicle.dto.js';
import { VehicleService } from './vehicle.service.js';

@ApiTags('Vehicles')
@Public()
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get('makes')
  @ApiOperation({ summary: 'List active canonical vehicle makes' })
  @ApiOkResponse({ type: VehicleMakeResponseDto, isArray: true })
  listMakes(): Promise<VehicleMakeResponseDto[]> {
    return this.vehicles.listPublishedMakes();
  }

  @Get('models')
  @ApiOperation({ summary: 'List active canonical models for an active make' })
  @ApiOkResponse({ type: VehicleModelResponseDto, isArray: true })
  listModels(
    @Query() query: VehicleModelQueryDto,
  ): Promise<VehicleModelResponseDto[]> {
    return this.vehicles.listPublishedModels(query.makeId);
  }
}
