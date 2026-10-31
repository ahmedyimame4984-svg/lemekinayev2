import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import {
  ResolveVehicleIdentifierDto,
  ValidateVehicleIdentifierDto,
  VehicleIdentifierResolutionResponseDto,
  VehicleIdentifierValidationResponseDto,
} from './dto/vehicle-identification.dto.js';
import { VehicleIdentificationService } from './vehicle-identification.service.js';

@ApiTags('Vehicle identification')
@Public()
@Controller('vehicle-identification')
export class VehicleIdentificationController {
  constructor(
    private readonly identification: VehicleIdentificationService,
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Validate and normalize a VIN, chassis number, frame number, or configured vehicle identifier',
  })
  @ApiOkResponse({ type: VehicleIdentifierValidationResponseDto })
  validate(
    @Body() input: ValidateVehicleIdentifierDto,
  ): VehicleIdentifierValidationResponseDto {
    return this.identification.validate(input);
  }

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resolve a typed vehicle identifier to canonical configured-vehicle candidates without guessing',
  })
  @ApiOkResponse({ type: VehicleIdentifierResolutionResponseDto })
  resolve(
    @Body() input: ResolveVehicleIdentifierDto,
  ): Promise<VehicleIdentifierResolutionResponseDto> {
    return this.identification.resolve(input);
  }
}
