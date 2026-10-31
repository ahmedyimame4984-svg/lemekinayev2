import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { CurrentPrincipal, RequireAccountTypes } from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { OrderSellerListingAssetsDto, PresignSellerListingAssetDto } from './dto/seller-listing-asset.dto.js';
import { SellerListingAssetService } from './seller-listing-asset.service.js';

@ApiTags('Seller listing images and documents')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/listings/:listingId/assets')
export class SellerListingAssetController {
  constructor(private readonly assets: SellerListingAssetService) {}

  @Get()
  list(@Param('listingId', ParseUUIDPipe) listingId: string,
       @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.listForSeller(listingId, principal.userId);
  }

  @Get('requirements')
  requirements(@Param('listingId', ParseUUIDPipe) listingId: string,
               @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.requirements(listingId, principal.userId);
  }

  @Post('presign')
  presign(@Param('listingId', ParseUUIDPipe) listingId: string,
          @Body() body: PresignSellerListingAssetDto,
          @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.begin(listingId, principal.userId, body);
  }

  @Post(':assetId/complete')
  complete(@Param('listingId', ParseUUIDPipe) listingId: string,
           @Param('assetId', ParseUUIDPipe) assetId: string,
           @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.complete(listingId, assetId, principal.userId);
  }

  @Get(':assetId/preview')
  preview(@Param('listingId', ParseUUIDPipe) listingId: string,
          @Param('assetId', ParseUUIDPipe) assetId: string,
          @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.preview(listingId, assetId, principal.userId);
  }

  @Patch('order')
  order(@Param('listingId', ParseUUIDPipe) listingId: string,
        @Body() body: OrderSellerListingAssetsDto,
        @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.order(listingId, principal.userId, body.assetIds, body.primaryId);
  }

  @Post(':assetId/remove')
  remove(@Param('listingId', ParseUUIDPipe) listingId: string,
         @Param('assetId', ParseUUIDPipe) assetId: string,
         @CurrentPrincipal() principal: AuthPrincipal) {
    return this.assets.remove(listingId, assetId, principal.userId);
  }
}
