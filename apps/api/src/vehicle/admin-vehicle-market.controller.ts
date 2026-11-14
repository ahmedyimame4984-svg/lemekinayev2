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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  ClassifyVehicleMarketDto,
  StageVehicleMarketMembershipDto,
  VehicleStructuredMarketQueryDto,
} from './dto/vehicle-market.dto.js';
import { VehicleMarketService } from './vehicle-market.service.js';

@ApiTags('Admin Vehicle Markets')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('vehicle.manage')
@UseGuards(CanonicalReferenceReadOnlyGuard)
@Controller('admin/vehicles')
export class AdminVehicleMarketController {
  constructor(private readonly markets: VehicleMarketService) {}
  @Get('structured-markets/page')
  @ApiOperation({
    summary: 'Search structured and unclassified vehicle markets',
  })
  list(@Query() query: VehicleStructuredMarketQueryDto) {
    return this.markets.list(query);
  }
  @Patch('structured-markets/:id/classification')
  @ApiOperation({
    summary:
      'Classify an unused Draft market; legacy used markets require reconciliation',
  })
  classify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ClassifyVehicleMarketDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.markets.classify(id, input, principal.userId);
  }
  @Get('configurations/:id/market-memberships')
  @ApiOperation({
    summary: 'Read role-specific memberships separately from legacy marketId',
  })
  memberships(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VehicleStructuredMarketQueryDto,
  ) {
    return this.markets.listMemberships(id, query);
  }
  @Post('configurations/:id/market-memberships')
  @ApiOperation({
    summary:
      'Stage an idempotent Draft membership; production activation is disabled',
  })
  stage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: StageVehicleMarketMembershipDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.markets.stage(id, input, principal.userId);
  }
}
