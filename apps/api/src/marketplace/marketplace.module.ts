import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../common/email/email.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CompatibilityModule } from '../compatibility/compatibility.module.js';
import { ProductModule } from '../product/product.module.js';
import { AdminListingController } from './admin-listing.controller.js';
import { AdminSellerController } from './admin-seller.controller.js';
import { AdminSellerApplicationController } from './admin-seller-application.controller.js';
import { InventoryService } from './inventory.service.js';
import { ListingService } from './listing.service.js';
import { AdminListingReviewService } from './admin-listing-review.service.js';
import { SellerListingEditService } from './seller-listing-edit.service.js';
import { SellerArticleIdentityResolver } from './seller-article-identity-resolver.service.js';
import { SellerArticleController } from './seller-article.controller.js';
import { SellerArticleBrowseController } from './seller-article-browse.controller.js';
import { SellerArticleService } from './seller-article.service.js';
import { SellerProductVehicleArticleController } from './seller-product-vehicle-article.controller.js';
import { SellerProductVehicleArticleService } from './seller-product-vehicle-article.service.js';
import { SellerInventoryController } from './seller-inventory.controller.js';
import { SellerListingController } from './seller-listing.controller.js';
import { SellerRegistrationController } from './seller-registration.controller.js';
import { SellerApplicationWorkspaceController } from './seller-application-workspace.controller.js';
import { SellerApplicationDraftService } from './seller-application-draft.service.js';
import { SellerRegistrationDocumentStorage } from './seller-registration-document-storage.service.js';
import { SellerRegistrationService } from './seller-registration.service.js';
import { SellerApplicationMailService } from './seller-application-mail.service.js';
import { SellerApplicationReviewService } from './seller-application-review.service.js';
import { SellerApplicationAccessController } from './seller-application-access.controller.js';
import { SellerApplicationAccessService } from './seller-application-access.service.js';
import { SellerApplicationEditService } from './seller-application-edit.service.js';
import { SellerService } from './seller.service.js';
import { SellerProductService } from './seller-product.service.js';
import { SellerProductController } from './seller-product.controller.js';
import { SellerEntryController } from './seller-entry.controller.js';
import { SellerEntryService } from './seller-entry.service.js';
import { SellerR2StorageService } from './seller-r2-storage.service.js';
import { SellerListingAssetService } from './seller-listing-asset.service.js';
import { SellerListingAssetController } from './seller-listing-asset.controller.js';
import { AdminListingAssetController } from './admin-listing-asset.controller.js';
import { SellerVehicleConfigurationService } from './seller-vehicle-configuration.service.js';
import { SellerStockTransferService } from './seller-stock-transfer.service.js';
import { SellerStockTransferController } from './seller-stock-transfer.controller.js';

@Module({
  imports: [AuthModule, CatalogModule, ProductModule, CompatibilityModule, EmailModule],
  controllers: [
    AdminSellerController,
    AdminSellerApplicationController,
    AdminListingController,
    AdminListingAssetController,
    SellerListingAssetController,
    SellerListingController,
    SellerInventoryController,
    SellerArticleController,
    SellerProductVehicleArticleController,
    SellerArticleBrowseController,
    SellerProductController,
    SellerEntryController,
    SellerStockTransferController,
    SellerRegistrationController,
    SellerApplicationWorkspaceController,
    SellerApplicationAccessController,
  ],
  providers: [
    SellerService,
    SellerProductService,
    SellerEntryService,
    SellerR2StorageService,
    SellerListingAssetService,
    SellerVehicleConfigurationService,
    SellerStockTransferService,
    ListingService,
    AdminListingReviewService,
    SellerListingEditService,
    SellerArticleIdentityResolver,
    InventoryService,
    SellerArticleService,
    SellerProductVehicleArticleService,
    SellerRegistrationService,
    SellerApplicationDraftService,
    SellerApplicationMailService,
    SellerApplicationReviewService,
    SellerApplicationAccessService,
    SellerApplicationEditService,
    SellerRegistrationDocumentStorage,
  ],
  exports: [
    SellerService,
    ListingService,
    InventoryService,
    SellerArticleService,
  ],
})
export class MarketplaceModule {}
