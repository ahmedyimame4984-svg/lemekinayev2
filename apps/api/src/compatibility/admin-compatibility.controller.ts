import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import {
  CompatibilityAdminQueryDto,
  VehicleCompatibilityResponseDto,
} from './dto/compatibility.dto.js';
import { CompatibilityService } from './compatibility.service.js';

@ApiTags('Admin compatibility')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'catalog.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage')
@Controller('admin/compatibilities')
export class AdminCompatibilityController {
  constructor(private readonly compatibility: CompatibilityService) {}

  @Get()
  @ApiOperation({
    summary:
      'List Manufacturer Article-to-Vehicle fitment records for read-only administration',
  })
  @ApiOkResponse({ type: VehicleCompatibilityResponseDto, isArray: true })
  list(
    @Query() query: CompatibilityAdminQueryDto,
  ): Promise<VehicleCompatibilityResponseDto[]> {
    return this.compatibility.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Retrieve a Manufacturer Article fitment record for read-only administration',
  })
  @ApiOkResponse({ type: VehicleCompatibilityResponseDto })
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleCompatibilityResponseDto> {
    return this.compatibility.getAdmin(id);
  }
}
