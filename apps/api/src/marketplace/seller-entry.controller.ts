import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { SaveSellerEntryDto } from './dto/seller-entry.dto.js';
import { SellerEntryService } from './seller-entry.service.js';
import { SellerVehicleConfigurationService } from './seller-vehicle-configuration.service.js';

@ApiTags('Seller one-save Inventory / Listing')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/entry')
export class SellerEntryController {
  constructor(
    private readonly entries: SellerEntryService,
    private readonly vehicles: SellerVehicleConfigurationService,
  ) {}

  @Get('vehicle-configurations')
  @ApiOkResponse({ description: 'Active configured vehicles with fully resolved Seller display labels' })
  listConfiguredVehicles(@Query('modelId', ParseUUIDPipe) modelId: string) {
    return this.vehicles.listByModel(modelId);
  }

  @Get('offer-requirements/:articleId')
  @ApiOkResponse({ description: 'Published, Article-bound Seller Offer field requirements' })
  getOfferRequirements(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.entries.offerRequirementsForSellerArticle(articleId, principal.userId);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Atomic Article resolution and Seller Inventory or Draft Listing creation' })
  save(@Body() input: SaveSellerEntryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.entries.save(input, principal.userId);
  }
}
