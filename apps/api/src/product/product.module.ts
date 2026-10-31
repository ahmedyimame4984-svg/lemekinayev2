import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminProductIdentityController } from './admin-product-identity.controller.js';
import { AdminArticleRelationGovernanceController } from './admin-article-relation-governance.controller.js';
import { AdminOeReferenceReviewController } from './admin-oe-reference-review.controller.js';
import { AdminArticleReviewService } from './admin-article-review.service.js';
import { AdminArticleRelationGovernanceService } from './admin-article-relation-governance.service.js';
import { AdminArticleInspectorService } from './admin-article-inspector.service.js';
import { AdminOeReferenceReviewService } from './admin-oe-reference-review.service.js';
import { AdminProductController } from './admin-product.controller.js';
import { ArticleIdentifierService } from './article-identifier.service.js';
import { ArticleRelationService } from './article-relation.service.js';
import { ArticleValidationService } from './article-validation.service.js';
import { BrandController } from './brand.controller.js';
import { ProductController } from './product.controller.js';
import { ProductAssetService } from './product-asset.service.js';
import { ProductIdentityService } from './product-identity.service.js';
import { ProductService } from './product.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [
    ProductController,
    BrandController,
    AdminProductController,
    AdminProductIdentityController,
    AdminOeReferenceReviewController,
    AdminArticleRelationGovernanceController,
  ],
  providers: [
    ProductService,
    AdminArticleReviewService,
    AdminArticleRelationGovernanceService,
    AdminArticleInspectorService,
    AdminOeReferenceReviewService,
    ProductIdentityService,
    ArticleIdentifierService,
    ProductAssetService,
    ArticleRelationService,
    ArticleValidationService,
  ],
  exports: [
    ProductService,
    AdminArticleReviewService,
    ProductIdentityService,
    ArticleIdentifierService,
    ProductAssetService,
    ArticleRelationService,
    ArticleValidationService,
  ],
})
export class ProductModule {}
