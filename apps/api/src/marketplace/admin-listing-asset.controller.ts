import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { RequireAccountTypes, RequirePermissions } from '../auth/auth.decorators.js';
import { SellerListingAssetService } from './seller-listing-asset.service.js';

@ApiTags('Admin seller listing review media')
@ApiBearerAuth()
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('listing.manage')
@Controller('admin/listings/:listingId/assets')
export class AdminListingAssetController {
  constructor(private readonly assets: SellerListingAssetService) {}

  @Get()
  list(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.assets.listForAdmin(listingId);
  }

  @Get(':assetId/preview')
  preview(@Param('listingId', ParseUUIDPipe) listingId: string,
          @Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.assets.preview(listingId, assetId);
  }
}
