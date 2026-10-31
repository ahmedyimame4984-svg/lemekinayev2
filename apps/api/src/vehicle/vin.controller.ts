import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import {
  DecodeVinDto,
  ResolveVinDto,
  VinDecodeResponseDto,
  VinResolutionResponseDto,
  VinValidationResponseDto,
  ValidateVinDto,
} from './dto/vin.dto.js';
import { VinService } from './vin.service.js';

@ApiTags('VIN')
@Public()
@Controller('vin')
export class VinController {
  constructor(private readonly vin: VinService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate and normalize a standard 17-character VIN' })
  @ApiOkResponse({ type: VinValidationResponseDto })
  validate(@Body() input: ValidateVinDto): VinValidationResponseDto {
    return this.vin.validate(input.vin);
  }

  @Post('decode')
  @ApiOperation({
    summary: 'Decode a VIN through the configured provider and normalize the result',
  })
  @ApiOkResponse({ type: VinDecodeResponseDto })
  decode(@Body() input: DecodeVinDto): Promise<VinDecodeResponseDto> {
    return this.vin.decode(input);
  }

  @Post('resolve')
  @ApiOperation({
    summary:
      'Resolve normalized VIN-decoder output to canonical configured vehicles',
  })
  @ApiOkResponse({ type: VinResolutionResponseDto })
  resolve(@Body() input: ResolveVinDto): Promise<VinResolutionResponseDto> {
    return this.vin.resolve(input);
  }
}
