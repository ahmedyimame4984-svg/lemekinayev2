import { Module } from '@nestjs/common';
import { ReferenceDataModule } from '../reference-data/reference-data.module.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { CatalogAttributeAssignmentService } from './catalog-attribute-assignment.service.js';
import { CatalogAttributeMasterV2Service } from './catalog-attribute-master-v2.service.js';
import { CatalogAttributeService } from './catalog-attribute.service.js';
import { CatalogCanonicalCriteriaLibraryService } from './catalog-canonical-criteria-library.service.js';
import { CatalogCanonicalProductLibraryService } from './catalog-canonical-product-library.service.js';
import { CatalogCriteriaTemplateService } from './catalog-criteria-template.service.js';
import { CatalogFoundationService } from './catalog-foundation.service.js';
import { CatalogProfessionalBaselineService } from './catalog-professional-baseline.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogSchemaController } from './catalog-schema.controller.js';
import { CatalogSchemaValidationService } from './catalog-schema-validation.service.js';
import { CatalogSchemaService } from './catalog-schema.service.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [ReferenceDataModule],
  controllers: [CatalogController, CatalogSchemaController, AdminCatalogController],
  providers: [
    CatalogService,
    CatalogAttributeService,
    CatalogAttributeMasterV2Service,
    CatalogCanonicalCriteriaLibraryService,
    CatalogCanonicalProductLibraryService,
    CatalogCriteriaTemplateService,
    CatalogFoundationService,
    CatalogProfessionalBaselineService,
    CatalogAttributeAssignmentService,
    CatalogSchemaService,
    CatalogSchemaValidationService,
  ],
  exports: [
    CatalogService,
    CatalogAttributeService,
    CatalogAttributeMasterV2Service,
    CatalogCanonicalCriteriaLibraryService,
    CatalogCanonicalProductLibraryService,
    CatalogCriteriaTemplateService,
    CatalogFoundationService,
    CatalogProfessionalBaselineService,
    CatalogAttributeAssignmentService,
    CatalogSchemaService,
    CatalogSchemaValidationService,
  ],
})
export class CatalogModule {}
