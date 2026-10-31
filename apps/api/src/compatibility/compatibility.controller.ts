import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import {
  CompatibilityEvaluationContextDto,
  CompatibilityEvaluationResponseDto,
  VehicleCompatibilityResponseDto,
} from './dto/compatibility.dto.js';
import { CompatibilityService } from './compatibility.service.js';

@ApiTags('Compatibility')
@Public()
@Controller('compatibility')
export class CompatibilityController {
  constructor(private readonly compatibility: CompatibilityService) {}

  @Get('products/:productId')
  @ApiOperation({
    summary: 'List verified ACTIVE fitment records for an ACTIVE Manufacturer Article',
  })
  @ApiOkResponse({ type: VehicleCompatibilityResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Active Manufacturer Article not found' })
  listProductFitment(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<VehicleCompatibilityResponseDto[]> {
    return this.compatibility.listPublishedByProduct(productId);
  }

  @Get('products/:productId/vehicles/:vehicleConfigurationId')
  @ApiOperation({
    summary:
      'Evaluate an ACTIVE Manufacturer Article against a canonical ACTIVE Vehicle Configuration',
  })
  @ApiOkResponse({ type: CompatibilityEvaluationResponseDto })
  @ApiNotFoundResponse({
    description: 'Active Manufacturer Article or Vehicle Configuration not found',
  })
  evaluate(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('vehicleConfigurationId', ParseUUIDPipe)
    vehicleConfigurationId: string,
  ): Promise<CompatibilityEvaluationResponseDto> {
    return this.compatibility.evaluate(productId, vehicleConfigurationId);
  }

  @Post('products/:productId/vehicles/:vehicleConfigurationId/evaluate')
  @ApiOperation({
    summary:
      'Evaluate fitment with structured production, axle/position, VIN or chassis context supplied in the request body',
  })
  @ApiOkResponse({ type: CompatibilityEvaluationResponseDto })
  @ApiNotFoundResponse({
    description: 'Active Manufacturer Article or Vehicle Configuration not found',
  })
  evaluateWithContext(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('vehicleConfigurationId', ParseUUIDPipe)
    vehicleConfigurationId: string,
    @Body() context: CompatibilityEvaluationContextDto,
  ): Promise<CompatibilityEvaluationResponseDto> {
    return this.compatibility.evaluate(
      productId,
      vehicleConfigurationId,
      context,
    );
  }
}
