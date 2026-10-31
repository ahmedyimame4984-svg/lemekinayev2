import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateVehicleProfileDto,
  UpdateVehicleProfileDto,
  VehicleProfileResponseDto,
} from './dto/vehicle-profile.dto.js';
import { VehicleProfileService } from './vehicle-profile.service.js';

@ApiTags('My Garage')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.CUSTOMER, AccountType.SELLER)
@Controller('garage')
export class VehicleProfileController {
  constructor(private readonly profiles: VehicleProfileService) {}

  @Get()
  @ApiOperation({ summary: 'List the current customer or seller’s saved vehicles' })
  @ApiOkResponse({ type: VehicleProfileResponseDto, isArray: true })
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.profiles.list(principal.userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Save a confirmed canonical vehicle configuration to My Garage',
  })
  @ApiCreatedResponse({ type: VehicleProfileResponseDto })
  create(
    @Body() input: CreateVehicleProfileDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.profiles.create(input, principal.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or change the default saved vehicle' })
  @ApiOkResponse({ type: VehicleProfileResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleProfileDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.profiles.update(id, input, principal.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a vehicle from My Garage' })
  @ApiNoContentResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<void> {
    await this.profiles.remove(id, principal.userId);
  }
}
