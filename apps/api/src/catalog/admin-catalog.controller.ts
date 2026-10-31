import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
  RequirePermissions,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateMasterDataLocalizationDto,
  DeleteMasterDataLocalizationDto,
  MasterDataLocalizationResponseDto,
  UpdateMasterDataLocalizationDto,
} from '../common/master-data-localization.dto.js';
import {
  CreateExternalStandardMappingDto,
  DeleteExternalStandardMappingDto,
  ExternalStandardMappingResponseDto,
  UpdateExternalStandardMappingDto,
} from '../common/external-standard-mapping.dto.js';
import { CatalogAttributeAssignmentService } from './catalog-attribute-assignment.service.js';
import { CatalogAttributeMasterV2Service } from './catalog-attribute-master-v2.service.js';
import { CatalogAttributeService } from './catalog-attribute.service.js';
import {
  CatalogCanonicalCriteriaLibraryService,
  type CanonicalCriteriaLibraryInstallResult,
  type CanonicalCriteriaLibraryStatus,
} from './catalog-canonical-criteria-library.service.js';
import {
  CatalogCanonicalProductLibraryService,
  type CanonicalProductCatalogInstallResult,
  type CanonicalProductCatalogStatus,
} from './catalog-canonical-product-library.service.js';
import { CatalogCriteriaTemplateService } from './catalog-criteria-template.service.js';
import { CatalogFoundationService } from './catalog-foundation.service.js';
import {
  CatalogProfessionalBaselineService,
  type ProfessionalCatalogBaselineReconcileResult,
  type ProfessionalCatalogBaselineStatus,
} from './catalog-professional-baseline.service.js';
import { CatalogSchemaService } from './catalog-schema.service.js';
import { CatalogService } from './catalog.service.js';
import {
  AttributeAdminPageQueryDto,
  AttributeAdminQueryDto,
  AttributeAllowedValueAdminQueryDto,
  AttributeAllowedValueResponseDto,
  AttributeDefinitionPageResponseDto,
  AttributeDefinitionResponseDto,
  AttributeDefinitionSummaryResponseDto,
  CreateAttributeAllowedValueDto,
  CreateAttributeDefinitionDto,
  UpdateAttributeAllowedValueDto,
  UpdateAttributeDefinitionDto,
} from './dto/attribute.dto.js';
import {
  AttributeCsvExportQueryDto,
  AttributeCsvExportResponseDto,
  AttributeCsvImportCommitResponseDto,
  AttributeCsvImportPreviewResponseDto,
  AttributeCsvImportRequestDto,
} from './dto/attribute-import-export.dto.js';
import {
  AttributeAliasResponseDto,
  AttributeGroupResponseDto,
  AttributeOptionSetResponseDto,
  AttributeOptionValueResponseDto,
  AttributeUnitResponseDto,
  CreateAttributeAliasDto,
  CreateAttributeGroupDto,
  CreateAttributeOptionSetDto,
  CreateAttributeOptionValueDto,
  CreateAttributeUnitDto,
  CreateUnitDimensionDto,
  MasterStatusQueryDto,
  UnitDimensionResponseDto,
  UpdateAttributeAliasDto,
  UpdateAttributeGroupDto,
  UpdateAttributeOptionSetDto,
  UpdateAttributeOptionValueDto,
  UpdateAttributeUnitDto,
  UpdateUnitDimensionDto,
} from './dto/attribute-master-v2.dto.js';
import {
  CategoryAdminPageQueryDto,
  CategoryAdminQueryDto,
  CategoryPageResponseDto,
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto.js';
import {
  ApplyCriteriaTemplateDto,
  AvailableCriteriaTemplateAttributePageQueryDto,
  BulkCreateCriteriaTemplateItemsDto,
  CreateCriteriaTemplateDto,
  CreateCriteriaTemplateItemDto,
  CriteriaTemplateAdminPageQueryDto,
  CriteriaTemplateAdminQueryDto,
  CriteriaTemplateApplyResponseDto,
  CriteriaTemplatePageResponseDto,
  CriteriaTemplateItemResponseDto,
  CriteriaTemplateResponseDto,
  UpdateCriteriaTemplateDto,
  UpdateCriteriaTemplateItemDto,
} from './dto/criteria-template.dto.js';
import {
  CreateProductFamilyDto,
  CreateUnitOfMeasureDto,
  ProductFamilyAdminPageQueryDto,
  ProductFamilyAdminQueryDto,
  ProductFamilyPageResponseDto,
  ProductFamilyResponseDto,
  UnitOfMeasureAdminQueryDto,
  UnitOfMeasureResponseDto,
  UpdateProductFamilyDto,
  UpdateUnitOfMeasureDto,
} from './dto/product-foundation.dto.js';
import {
  ProductTypeCsvExportQueryDto,
  ProductTypeCsvExportResponseDto,
  ProductTypeCsvImportCommitResponseDto,
  ProductTypeCsvImportPreviewResponseDto,
  ProductTypeCsvImportRequestDto,
} from './dto/product-type-import-export.dto.js';
import {
  CreateProductTypeDto,
  ProductTypeAdminPageQueryDto,
  ProductTypeAdminQueryDto,
  ProductTypeAdminSummaryDto,
  ProductTypePageResponseDto,
  ProductTypeResponseDto,
  UpdateProductTypeDto,
} from './dto/product-type.dto.js';
import {
  AvailableProductTypeAttributePageQueryDto,
  BulkCreateProductTypeAttributeAssignmentsDto,
  BulkDeleteProductTypeAttributeAssignmentsDto,
  BulkUpdateProductTypeAttributeAssignmentsDto,
  CreateProductTypeAttributeAssignmentDto,
  ProductTypeAttributeAssignmentAdminQueryDto,
  ProductTypeAttributeAssignmentResponseDto,
  UpdateProductTypeAttributeAssignmentDto,
} from './dto/product-type-attribute.dto.js';
import {
  ProductTypeSchemaVersionResponseDto,
  PublishProductTypeSchemaDto,
} from './dto/product-type-schema.dto.js';

@ApiTags('Admin catalog')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'catalog.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage')
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly foundations: CatalogFoundationService,
    private readonly attributes: CatalogAttributeService,
    private readonly attributeMasters: CatalogAttributeMasterV2Service,
    private readonly assignments: CatalogAttributeAssignmentService,
    private readonly canonicalCriteria: CatalogCanonicalCriteriaLibraryService,
    private readonly canonicalProducts: CatalogCanonicalProductLibraryService,
    private readonly professionalBaseline: CatalogProfessionalBaselineService,
    private readonly criteriaTemplates: CatalogCriteriaTemplateService,
    private readonly schemas: CatalogSchemaService,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'List categories for administration' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  listCategories(
    @Query() query: CategoryAdminQueryDto,
  ): Promise<CategoryResponseDto[]> {
    return this.catalog.listAdminCategories(query);
  }

  @Get('categories/page')
  @ApiOperation({ summary: 'Search and page Categories for administration' })
  @ApiOkResponse({ type: CategoryPageResponseDto })
  listCategoriesPage(
    @Query() query: CategoryAdminPageQueryDto,
  ): Promise<CategoryPageResponseDto> {
    return this.catalog.listAdminCategoriesPage(query);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get one Category for administration' })
  @ApiOkResponse({ type: CategoryResponseDto })
  getCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.catalog.getAdminCategory(id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or invalid hierarchy state' })
  createCategory(
    @Body() input: CreateCategoryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CategoryResponseDto> {
    return this.catalog.createCategory(input, principal.userId);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category with optimistic versioning' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ description: 'Version or hierarchy conflict' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CategoryResponseDto> {
    return this.catalog.updateCategory(id, input, principal.userId);
  }

  @Get('product-families')
  @ApiOperation({ summary: 'List centrally governed Product Families' })
  @ApiOkResponse({ type: ProductFamilyResponseDto, isArray: true })
  listProductFamilies(
    @Query() query: ProductFamilyAdminQueryDto,
  ): Promise<ProductFamilyResponseDto[]> {
    return this.foundations.listProductFamilies(query);
  }

  @Get('product-families/page')
  @ApiOperation({ summary: 'Search and page Part Groups for administration' })
  @ApiOkResponse({ type: ProductFamilyPageResponseDto })
  listProductFamiliesPage(
    @Query() query: ProductFamilyAdminPageQueryDto,
  ): Promise<ProductFamilyPageResponseDto> {
    return this.foundations.listProductFamiliesPage(query);
  }

  @Post('product-families')
  @ApiOperation({ summary: 'Create a Product Family' })
  @ApiCreatedResponse({ type: ProductFamilyResponseDto })
  createProductFamily(
    @Body() input: CreateProductFamilyDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductFamilyResponseDto> {
    return this.foundations.createProductFamily(input, principal.userId);
  }

  @Patch('product-families/:id')
  @ApiOperation({ summary: 'Update a Product Family with optimistic versioning' })
  @ApiOkResponse({ type: ProductFamilyResponseDto })
  updateProductFamily(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductFamilyDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductFamilyResponseDto> {
    return this.foundations.updateProductFamily(id, input, principal.userId);
  }

  @Get('units-of-measure')
  @ApiOperation({ summary: 'List controlled Units of Measure' })
  @ApiOkResponse({ type: UnitOfMeasureResponseDto, isArray: true })
  listUnits(
    @Query() query: UnitOfMeasureAdminQueryDto,
  ): Promise<UnitOfMeasureResponseDto[]> {
    return this.foundations.listUnits(query);
  }

  @Post('units-of-measure')
  @ApiOperation({ summary: 'Create a controlled Unit of Measure' })
  @ApiCreatedResponse({ type: UnitOfMeasureResponseDto })
  createUnit(
    @Body() input: CreateUnitOfMeasureDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<UnitOfMeasureResponseDto> {
    return this.foundations.createUnit(input, principal.userId);
  }

  @Patch('units-of-measure/:id')
  @ApiOperation({ summary: 'Update a Unit of Measure with optimistic versioning' })
  @ApiOkResponse({ type: UnitOfMeasureResponseDto })
  updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUnitOfMeasureDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<UnitOfMeasureResponseDto> {
    return this.foundations.updateUnit(id, input, principal.userId);
  }

  @Get('product-types')
  @ApiOperation({ summary: 'List product types for administration' })
  @ApiOkResponse({ type: ProductTypeResponseDto, isArray: true })
  listProductTypes(@Query() query: ProductTypeAdminQueryDto): Promise<ProductTypeResponseDto[]> {
    return this.catalog.listAdminProductTypes(query);
  }

  @Get('product-types/page')
  @ApiOperation({ summary: 'Search and page product types for large Admin libraries' })
  @ApiOkResponse({ type: ProductTypePageResponseDto })
  listProductTypesPage(
    @Query() query: ProductTypeAdminPageQueryDto,
  ): Promise<ProductTypePageResponseDto> {
    return this.catalog.listAdminProductTypesPage(query);
  }

  @Get('product-types/summary')
  @ApiOperation({ summary: 'Summarize Product Type operational readiness' })
  @ApiOkResponse({ type: ProductTypeAdminSummaryDto })
  getProductTypeSummary(): Promise<ProductTypeAdminSummaryDto> {
    return this.catalog.getAdminProductTypeSummary();
  }

  @Get('product-types/export')
  @ApiOperation({ summary: 'Export the filtered Product Type Library as CSV' })
  @ApiOkResponse({ type: ProductTypeCsvExportResponseDto })
  exportProductTypes(
    @Query() query: ProductTypeCsvExportQueryDto,
  ): Promise<ProductTypeCsvExportResponseDto> {
    return this.catalog.exportProductTypesCsv(query);
  }

  @Post('product-types/import/preview')
  @ApiOperation({
    summary: 'Preview and validate a Product Type CSV import without writing data',
  })
  @ApiOkResponse({ type: ProductTypeCsvImportPreviewResponseDto })
  previewProductTypeImport(
    @Body() input: ProductTypeCsvImportRequestDto,
  ): Promise<ProductTypeCsvImportPreviewResponseDto> {
    return this.catalog.previewProductTypeCsvImport(input);
  }

  @Post('product-types/import/commit')
  @ApiOperation({ summary: 'Atomically commit a validated Product Type CSV import' })
  @ApiCreatedResponse({ type: ProductTypeCsvImportCommitResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or hierarchy lifecycle conflict' })
  commitProductTypeImport(
    @Body() input: ProductTypeCsvImportRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeCsvImportCommitResponseDto> {
    return this.catalog.commitProductTypeCsvImport(input, principal.userId);
  }

  @Get('product-types/:id/localizations')
  @ApiOperation({ summary: 'List localized names/descriptions for a Product Type' })
  @ApiOkResponse({ type: MasterDataLocalizationResponseDto, isArray: true })
  listProductTypeLocalizations(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MasterDataLocalizationResponseDto[]> {
    return this.catalog.listProductTypeLocalizations(id);
  }

  @Post('product-types/:id/localizations')
  @ApiOperation({ summary: 'Add localized Product Type reference data' })
  @ApiCreatedResponse({ type: MasterDataLocalizationResponseDto })
  @ApiConflictResponse({ description: 'Locale already exists' })
  createProductTypeLocalization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateMasterDataLocalizationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<MasterDataLocalizationResponseDto> {
    return this.catalog.createProductTypeLocalization(id, input, principal.userId);
  }

  @Patch('product-types/:id/localizations/:localizationId')
  @ApiOperation({ summary: 'Update localized Product Type reference data' })
  @ApiOkResponse({ type: MasterDataLocalizationResponseDto })
  updateProductTypeLocalization(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('localizationId', ParseUUIDPipe) localizationId: string,
    @Body() input: UpdateMasterDataLocalizationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<MasterDataLocalizationResponseDto> {
    return this.catalog.updateProductTypeLocalization(
      id,
      localizationId,
      input,
      principal.userId,
    );
  }

  @Delete('product-types/:id/localizations/:localizationId')
  @ApiOperation({ summary: 'Remove localized Product Type reference data' })
  @ApiOkResponse({ type: MasterDataLocalizationResponseDto })
  deleteProductTypeLocalization(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('localizationId', ParseUUIDPipe) localizationId: string,
    @Body() input: DeleteMasterDataLocalizationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<MasterDataLocalizationResponseDto> {
    return this.catalog.deleteProductTypeLocalization(
      id,
      localizationId,
      input.version,
      principal.userId,
    );
  }

  @Get('product-types/:id/external-mappings')
  @ApiOperation({ summary: 'List external-standard mappings for a Product Type' })
  @ApiOkResponse({ type: ExternalStandardMappingResponseDto, isArray: true })
  listProductTypeExternalMappings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExternalStandardMappingResponseDto[]> {
    return this.catalog.listProductTypeExternalMappings(id);
  }

  @Post('product-types/:id/external-mappings')
  @ApiOperation({ summary: 'Map a Product Type to an external standard identifier' })
  @ApiCreatedResponse({ type: ExternalStandardMappingResponseDto })
  @ApiConflictResponse({ description: 'Duplicate external mapping' })
  createProductTypeExternalMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateExternalStandardMappingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ExternalStandardMappingResponseDto> {
    return this.catalog.createProductTypeExternalMapping(
      id,
      input,
      principal.userId,
    );
  }

  @Patch('product-types/:id/external-mappings/:mappingId')
  @ApiOperation({ summary: 'Update a Product Type external-standard mapping' })
  @ApiOkResponse({ type: ExternalStandardMappingResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or version conflict' })
  updateProductTypeExternalMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @Body() input: UpdateExternalStandardMappingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ExternalStandardMappingResponseDto> {
    return this.catalog.updateProductTypeExternalMapping(
      id,
      mappingId,
      input,
      principal.userId,
    );
  }

  @Delete('product-types/:id/external-mappings/:mappingId')
  @ApiOperation({ summary: 'Remove a Product Type external-standard mapping' })
  @ApiOkResponse({ type: ExternalStandardMappingResponseDto })
  @ApiConflictResponse({ description: 'Mapping version conflict' })
  deleteProductTypeExternalMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @Body() input: DeleteExternalStandardMappingDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ExternalStandardMappingResponseDto> {
    return this.catalog.deleteProductTypeExternalMapping(
      id,
      mappingId,
      input.version,
      principal.userId,
    );
  }

  @Get('product-types/:id')
  @ApiOperation({ summary: 'Get one product type for administration' })
  @ApiOkResponse({ type: ProductTypeResponseDto })
  getProductType(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductTypeResponseDto> {
    return this.catalog.getAdminProductType(id);
  }

  @Post('product-types')
  @ApiOperation({ summary: 'Create a product type' })
  @ApiCreatedResponse({ type: ProductTypeResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or invalid category state' })
  createProductType(
    @Body() input: CreateProductTypeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeResponseDto> {
    return this.catalog.createProductType(input, principal.userId);
  }

  @Patch('product-types/:id')
  @ApiOperation({ summary: 'Update a product type with optimistic versioning' })
  @ApiOkResponse({ type: ProductTypeResponseDto })
  @ApiConflictResponse({ description: 'Version or category lifecycle conflict' })
  updateProductType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductTypeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeResponseDto> {
    return this.catalog.updateProductType(id, input, principal.userId);
  }

  @Get('professional-baseline')
  @ApiOperation({
    summary: 'Inspect the complete professional automotive Catalog Baseline status',
  })
  @ApiOkResponse({ description: 'Professional Catalog Baseline readiness' })
  professionalBaselineStatus(): Promise<ProfessionalCatalogBaselineStatus> {
    return this.professionalBaseline.status();
  }

  @Post('professional-baseline/reconcile')
  @ApiOperation({
    summary:
      'Reconcile canonical Attributes, automotive taxonomy, Criteria Templates and Product Type assignments in dependency order',
  })
  @ApiCreatedResponse({
    description: 'Professional Catalog Baseline reconciliation result',
  })
  reconcileProfessionalBaseline(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProfessionalCatalogBaselineReconcileResult> {
    return this.professionalBaseline.reconcile(principal.userId);
  }

  @Get('canonical-product-catalog')
  @ApiOperation({ summary: 'Inspect canonical automotive Product Catalog status' })
  @ApiOkResponse({ description: 'Canonical Product Catalog status' })
  canonicalProductCatalogStatus(): Promise<CanonicalProductCatalogStatus> {
    return this.canonicalProducts.status();
  }

  @Post('canonical-product-catalog/install')
  @ApiOperation({
    summary:
      'Install or reconcile the canonical automotive Category → Part Group → Product Type library',
  })
  @ApiCreatedResponse({ description: 'Canonical Product Catalog install result' })
  installCanonicalProductCatalog(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CanonicalProductCatalogInstallResult> {
    return this.canonicalProducts.install(principal.userId);
  }

  @Get('criteria-templates/canonical-library')
  @ApiOperation({ summary: 'Inspect canonical automotive Criteria Template library status' })
  @ApiOkResponse({ description: 'Canonical Criteria Template library status' })
  canonicalCriteriaLibraryStatus(): Promise<CanonicalCriteriaLibraryStatus> {
    return this.canonicalCriteria.status();
  }

  @Post('criteria-templates/canonical-library/install')
  @ApiOperation({
    summary:
      'Install or reconcile canonical automotive Criteria Templates against real Product Types',
  })
  @ApiCreatedResponse({ description: 'Canonical Criteria Template library install result' })
  installCanonicalCriteriaLibrary(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CanonicalCriteriaLibraryInstallResult> {
    return this.canonicalCriteria.install(principal.userId);
  }

  @Get('criteria-templates')
  @ApiOperation({ summary: 'List reusable Product Type Criteria Templates' })
  @ApiOkResponse({ type: CriteriaTemplateResponseDto, isArray: true })
  listCriteriaTemplates(
    @Query() query: CriteriaTemplateAdminQueryDto,
  ): Promise<CriteriaTemplateResponseDto[]> {
    return this.criteriaTemplates.listTemplates(query);
  }

  @Get('criteria-templates/page')
  @ApiOperation({ summary: 'Search and page the Criteria Template library' })
  @ApiOkResponse({ type: CriteriaTemplatePageResponseDto })
  listCriteriaTemplatesPage(
    @Query() query: CriteriaTemplateAdminPageQueryDto,
  ): Promise<CriteriaTemplatePageResponseDto> {
    return this.criteriaTemplates.listTemplatesPage(query);
  }

  @Post('criteria-templates')
  @ApiOperation({ summary: 'Create a reusable Product Type Criteria Template' })
  @ApiCreatedResponse({ type: CriteriaTemplateResponseDto })
  createCriteriaTemplate(
    @Body() input: CreateCriteriaTemplateDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CriteriaTemplateResponseDto> {
    return this.criteriaTemplates.createTemplate(input, principal.userId);
  }

  @Patch('criteria-templates/:templateId')
  @ApiOperation({ summary: 'Update a Criteria Template with optimistic versioning' })
  @ApiOkResponse({ type: CriteriaTemplateResponseDto })
  updateCriteriaTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() input: UpdateCriteriaTemplateDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CriteriaTemplateResponseDto> {
    return this.criteriaTemplates.updateTemplate(
      templateId,
      input,
      principal.userId,
    );
  }

  @Get('criteria-templates/:templateId/items')
  @ApiOperation({ summary: 'List criteria in a reusable Product Type Template' })
  @ApiOkResponse({ type: CriteriaTemplateItemResponseDto, isArray: true })
  listCriteriaTemplateItems(
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ): Promise<CriteriaTemplateItemResponseDto[]> {
    return this.criteriaTemplates.listItems(templateId);
  }

  @Get('criteria-templates/:templateId/available-attributes/page')
  @ApiOperation({
    summary: 'Search and page Attributes not yet included in a Criteria Template',
  })
  @ApiOkResponse({ type: AttributeDefinitionPageResponseDto })
  listAvailableCriteriaTemplateAttributesPage(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Query() query: AvailableCriteriaTemplateAttributePageQueryDto,
  ): Promise<AttributeDefinitionPageResponseDto> {
    return this.criteriaTemplates.listAvailableAttributesPage(
      templateId,
      query,
    );
  }

  @Get('criteria-templates/:templateId/available-attributes/summary')
  @ApiOperation({
    summary: 'Summarize Attributes not yet included in a Criteria Template',
  })
  @ApiOkResponse({ type: AttributeDefinitionSummaryResponseDto })
  getAvailableCriteriaTemplateAttributeSummary(
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ): Promise<AttributeDefinitionSummaryResponseDto> {
    return this.criteriaTemplates.getAvailableAttributeSummary(templateId);
  }

  @Post('criteria-templates/:templateId/items')
  @ApiOperation({ summary: 'Add an Attribute criterion to a reusable Template' })
  @ApiCreatedResponse({ type: CriteriaTemplateItemResponseDto })
  createCriteriaTemplateItem(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() input: CreateCriteriaTemplateItemDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CriteriaTemplateItemResponseDto> {
    return this.criteriaTemplates.createItem(
      templateId,
      input,
      principal.userId,
    );
  }

  @Post('criteria-templates/:templateId/items/bulk')
  @ApiOperation({
    summary: 'Add multiple canonical Attributes to a Criteria Template atomically',
  })
  @ApiCreatedResponse({
    type: CriteriaTemplateItemResponseDto,
    isArray: true,
  })
  createCriteriaTemplateItemsBulk(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() input: BulkCreateCriteriaTemplateItemsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CriteriaTemplateItemResponseDto[]> {
    return this.criteriaTemplates.createItemsBulk(
      templateId,
      input,
      principal.userId,
    );
  }

  @Patch('criteria-templates/:templateId/items/:itemId')
  @ApiOperation({ summary: 'Update a reusable Template criterion' })
  @ApiOkResponse({ type: CriteriaTemplateItemResponseDto })
  updateCriteriaTemplateItem(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: UpdateCriteriaTemplateItemDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CriteriaTemplateItemResponseDto> {
    return this.criteriaTemplates.updateItem(
      templateId,
      itemId,
      input,
      principal.userId,
    );
  }

  @Post('product-types/:productTypeId/criteria-templates/:templateId/apply')
  @ApiOperation({
    summary:
      'Apply an active Criteria Template to a Product Type without overwriting existing assignments',
  })
  @ApiCreatedResponse({ type: CriteriaTemplateApplyResponseDto })
  @ApiConflictResponse({
    description: 'Template lifecycle, family, or criteria conflict',
  })
  applyCriteriaTemplate(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() input: ApplyCriteriaTemplateDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CriteriaTemplateApplyResponseDto> {
    return this.criteriaTemplates.applyTemplate(
      productTypeId,
      templateId,
      input,
      principal.userId,
    );
  }

  @Get('product-types/:productTypeId/schemas')
  @ApiOperation({ summary: 'List published Product Type schema versions' })
  @ApiOkResponse({ type: ProductTypeSchemaVersionResponseDto, isArray: true })
  listProductTypeSchemas(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
  ): Promise<ProductTypeSchemaVersionResponseDto[]> {
    return this.schemas.listAdminVersions(productTypeId);
  }

  @Post('product-types/:productTypeId/schemas/publish')
  @ApiOperation({ summary: 'Publish an immutable Product Type listing schema snapshot' })
  @ApiCreatedResponse({ type: ProductTypeSchemaVersionResponseDto })
  @ApiConflictResponse({ description: 'Version, lifecycle, or unchanged-schema conflict' })
  publishProductTypeSchema(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Body() input: PublishProductTypeSchemaDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    return this.schemas.publish(productTypeId, input, principal.userId);
  }

  @Get('product-types/:productTypeId/attributes')
  @ApiOperation({ summary: 'List attributes assigned to a product type' })
  @ApiOkResponse({
    type: ProductTypeAttributeAssignmentResponseDto,
    isArray: true,
  })
  listProductTypeAttributes(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Query() query: ProductTypeAttributeAssignmentAdminQueryDto,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    return this.assignments.listAdminAssignments(productTypeId, query);
  }

  @Get('product-types/:productTypeId/available-attributes/page')
  @ApiOperation({
    summary: 'Search and page master Attributes not yet assigned to a Product Type',
  })
  @ApiOkResponse({ type: AttributeDefinitionPageResponseDto })
  listAvailableProductTypeAttributesPage(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Query() query: AvailableProductTypeAttributePageQueryDto,
  ): Promise<AttributeDefinitionPageResponseDto> {
    return this.assignments.listAvailableAttributesPage(productTypeId, query);
  }

  @Get('product-types/:productTypeId/available-attributes/summary')
  @ApiOperation({
    summary: 'Summarize unassigned Product Type Attributes by group',
  })
  @ApiOkResponse({ type: AttributeDefinitionSummaryResponseDto })
  getAvailableProductTypeAttributeSummary(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
  ): Promise<AttributeDefinitionSummaryResponseDto> {
    return this.assignments.getAvailableAttributeSummary(productTypeId);
  }

  @Get('product-types/:productTypeId/available-attributes')
  @ApiOperation({
    summary: 'List master Attributes not yet assigned to a Product Type',
  })
  @ApiOkResponse({ type: AttributeDefinitionResponseDto, isArray: true })
  listAvailableProductTypeAttributes(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
  ): Promise<AttributeDefinitionResponseDto[]> {
    return this.assignments.listAvailableAttributes(productTypeId);
  }

  @Post('product-types/:productTypeId/attributes')
  @ApiOperation({ summary: 'Assign an approved attribute to a product type' })
  @ApiCreatedResponse({ type: ProductTypeAttributeAssignmentResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or invalid assignment state' })
  createProductTypeAttribute(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Body() input: CreateProductTypeAttributeAssignmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    return this.assignments.createAssignment(
      productTypeId,
      input,
      principal.userId,
    );
  }

  @Post('product-types/:productTypeId/attributes/bulk')
  @ApiOperation({
    summary: 'Assign multiple approved Attributes to a Product Type atomically',
  })
  @ApiCreatedResponse({
    type: ProductTypeAttributeAssignmentResponseDto,
    isArray: true,
  })
  @ApiConflictResponse({
    description: 'Duplicate, lifecycle, or default-unit conflict',
  })
  createProductTypeAttributesBulk(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Body() input: BulkCreateProductTypeAttributeAssignmentsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    return this.assignments.createAssignmentsBulk(
      productTypeId,
      input,
      principal.userId,
    );
  }

  @Patch('product-types/:productTypeId/attributes/bulk')
  @ApiOperation({ summary: 'Update selected Product Type Attributes atomically' })
  @ApiOkResponse({
    type: ProductTypeAttributeAssignmentResponseDto,
    isArray: true,
  })
  @ApiConflictResponse({ description: 'Version conflict' })
  updateProductTypeAttributesBulk(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Body() input: BulkUpdateProductTypeAttributeAssignmentsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    return this.assignments.updateAssignmentsBulk(
      productTypeId,
      input,
      principal.userId,
    );
  }

  @Post('product-types/:productTypeId/attributes/bulk/remove')
  @ApiOperation({
    summary:
      'Remove selected Attribute relationships from a Product Type atomically',
  })
  @ApiOkResponse({
    type: ProductTypeAttributeAssignmentResponseDto,
    isArray: true,
  })
  @ApiConflictResponse({ description: 'Version conflict' })
  removeProductTypeAttributesBulk(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Body() input: BulkDeleteProductTypeAttributeAssignmentsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    return this.assignments.deleteAssignmentsBulk(
      productTypeId,
      input,
      principal.userId,
    );
  }

  @Delete('product-types/:productTypeId/attributes/bulk')
  @ApiOperation({ summary: 'Unassign selected Product Type Attributes atomically' })
  @ApiOkResponse({
    type: ProductTypeAttributeAssignmentResponseDto,
    isArray: true,
  })
  @ApiConflictResponse({ description: 'Version conflict' })
  deleteProductTypeAttributesBulk(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Body() input: BulkDeleteProductTypeAttributeAssignmentsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto[]> {
    return this.assignments.deleteAssignmentsBulk(
      productTypeId,
      input,
      principal.userId,
    );
  }

  @Patch('product-types/:productTypeId/attributes/:assignmentId')
  @ApiOperation({
    summary: 'Update a Product Type attribute assignment with optimistic versioning',
  })
  @ApiOkResponse({ type: ProductTypeAttributeAssignmentResponseDto })
  @ApiConflictResponse({ description: 'Version or lifecycle conflict' })
  updateProductTypeAttribute(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: UpdateProductTypeAttributeAssignmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    return this.assignments.updateAssignment(
      productTypeId,
      assignmentId,
      input,
      principal.userId,
    );
  }

  @Post('product-types/:productTypeId/attributes/:assignmentId/remove')
  @ApiOperation({
    summary: 'Remove an Attribute relationship from a Product Type',
  })
  @ApiOkResponse({ type: ProductTypeAttributeAssignmentResponseDto })
  @ApiConflictResponse({ description: 'Version conflict' })
  removeProductTypeAttribute(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: UpdateProductTypeAttributeAssignmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    return this.assignments.deleteAssignment(
      productTypeId,
      assignmentId,
      input.version,
      principal.userId,
    );
  }

  @Delete('product-types/:productTypeId/attributes/:assignmentId')
  @ApiOperation({ summary: 'Unassign an Attribute from a Product Type' })
  @ApiOkResponse({ type: ProductTypeAttributeAssignmentResponseDto })
  @ApiConflictResponse({ description: 'Version conflict' })
  deleteProductTypeAttribute(
    @Param('productTypeId', ParseUUIDPipe) productTypeId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: UpdateProductTypeAttributeAssignmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeAttributeAssignmentResponseDto> {
    return this.assignments.deleteAssignment(
      productTypeId,
      assignmentId,
      input.version,
      principal.userId,
    );
  }

  @Get('attribute-groups')
  @ApiOperation({ summary: 'List Attribute Groups' })
  @ApiOkResponse({ type: AttributeGroupResponseDto, isArray: true })
  listAttributeGroups(
    @Query() query: MasterStatusQueryDto,
  ): Promise<AttributeGroupResponseDto[]> {
    return this.attributeMasters.listGroups(query);
  }

  @Post('attribute-groups')
  @ApiOperation({ summary: 'Create an Attribute Group' })
  @ApiCreatedResponse({ type: AttributeGroupResponseDto })
  createAttributeGroup(
    @Body() input: CreateAttributeGroupDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeGroupResponseDto> {
    return this.attributeMasters.createGroup(input, principal.userId);
  }

  @Patch('attribute-groups/:id')
  @ApiOperation({ summary: 'Update an Attribute Group with optimistic versioning' })
  @ApiOkResponse({ type: AttributeGroupResponseDto })
  updateAttributeGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeGroupDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeGroupResponseDto> {
    return this.attributeMasters.updateGroup(id, input, principal.userId);
  }

  @Get('attribute-option-sets')
  @ApiOperation({ summary: 'List reusable Attribute Option Sets' })
  @ApiOkResponse({ type: AttributeOptionSetResponseDto, isArray: true })
  listAttributeOptionSets(
    @Query() query: MasterStatusQueryDto,
  ): Promise<AttributeOptionSetResponseDto[]> {
    return this.attributeMasters.listOptionSets(query);
  }

  @Post('attribute-option-sets')
  @ApiOperation({ summary: 'Create a reusable Attribute Option Set' })
  @ApiCreatedResponse({ type: AttributeOptionSetResponseDto })
  createAttributeOptionSet(
    @Body() input: CreateAttributeOptionSetDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeOptionSetResponseDto> {
    return this.attributeMasters.createOptionSet(input, principal.userId);
  }

  @Patch('attribute-option-sets/:id')
  @ApiOperation({ summary: 'Update an Attribute Option Set with optimistic versioning' })
  @ApiOkResponse({ type: AttributeOptionSetResponseDto })
  updateAttributeOptionSet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeOptionSetDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeOptionSetResponseDto> {
    return this.attributeMasters.updateOptionSet(id, input, principal.userId);
  }

  @Get('attribute-option-sets/:optionSetId/values')
  @ApiOperation({ summary: 'List values in an Attribute Option Set' })
  @ApiOkResponse({ type: AttributeOptionValueResponseDto, isArray: true })
  listAttributeOptionValues(
    @Param('optionSetId', ParseUUIDPipe) optionSetId: string,
    @Query() query: MasterStatusQueryDto,
  ): Promise<AttributeOptionValueResponseDto[]> {
    return this.attributeMasters.listOptionValues(optionSetId, query);
  }

  @Post('attribute-option-sets/:optionSetId/values')
  @ApiOperation({ summary: 'Create a value in an Attribute Option Set' })
  @ApiCreatedResponse({ type: AttributeOptionValueResponseDto })
  createAttributeOptionValue(
    @Param('optionSetId', ParseUUIDPipe) optionSetId: string,
    @Body() input: CreateAttributeOptionValueDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeOptionValueResponseDto> {
    return this.attributeMasters.createOptionValue(
      optionSetId,
      input,
      principal.userId,
    );
  }

  @Patch('attribute-option-sets/:optionSetId/values/:valueId')
  @ApiOperation({ summary: 'Update an Attribute Option Value with optimistic versioning' })
  @ApiOkResponse({ type: AttributeOptionValueResponseDto })
  updateAttributeOptionValue(
    @Param('optionSetId', ParseUUIDPipe) optionSetId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() input: UpdateAttributeOptionValueDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeOptionValueResponseDto> {
    return this.attributeMasters.updateOptionValue(
      optionSetId,
      valueId,
      input,
      principal.userId,
    );
  }

  @Get('unit-dimensions')
  @ApiOperation({ summary: 'List Attribute Unit Dimensions' })
  @ApiOkResponse({ type: UnitDimensionResponseDto, isArray: true })
  listUnitDimensions(
    @Query() query: MasterStatusQueryDto,
  ): Promise<UnitDimensionResponseDto[]> {
    return this.attributeMasters.listDimensions(query);
  }

  @Post('unit-dimensions')
  @ApiOperation({ summary: 'Create an Attribute Unit Dimension' })
  @ApiCreatedResponse({ type: UnitDimensionResponseDto })
  createUnitDimension(
    @Body() input: CreateUnitDimensionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<UnitDimensionResponseDto> {
    return this.attributeMasters.createDimension(input, principal.userId);
  }

  @Patch('unit-dimensions/:id')
  @ApiOperation({ summary: 'Update a Unit Dimension with optimistic versioning' })
  @ApiOkResponse({ type: UnitDimensionResponseDto })
  updateUnitDimension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUnitDimensionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<UnitDimensionResponseDto> {
    return this.attributeMasters.updateDimension(id, input, principal.userId);
  }

  @Get('unit-dimensions/:dimensionId/units')
  @ApiOperation({ summary: 'List Units in a Unit Dimension' })
  @ApiOkResponse({ type: AttributeUnitResponseDto, isArray: true })
  listAttributeUnits(
    @Param('dimensionId', ParseUUIDPipe) dimensionId: string,
    @Query() query: MasterStatusQueryDto,
  ): Promise<AttributeUnitResponseDto[]> {
    return this.attributeMasters.listUnits(dimensionId, query);
  }

  @Post('unit-dimensions/:dimensionId/units')
  @ApiOperation({ summary: 'Create a Unit in a Unit Dimension' })
  @ApiCreatedResponse({ type: AttributeUnitResponseDto })
  createAttributeUnit(
    @Param('dimensionId', ParseUUIDPipe) dimensionId: string,
    @Body() input: CreateAttributeUnitDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeUnitResponseDto> {
    return this.attributeMasters.createUnit(
      dimensionId,
      input,
      principal.userId,
    );
  }

  @Patch('unit-dimensions/:dimensionId/units/:unitId')
  @ApiOperation({ summary: 'Update a Unit with optimistic versioning' })
  @ApiOkResponse({ type: AttributeUnitResponseDto })
  updateAttributeUnit(
    @Param('dimensionId', ParseUUIDPipe) dimensionId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() input: UpdateAttributeUnitDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeUnitResponseDto> {
    return this.attributeMasters.updateUnit(
      dimensionId,
      unitId,
      input,
      principal.userId,
    );
  }

  @Get('attributes/:attributeId/aliases')
  @ApiOperation({ summary: 'List aliases for an Attribute Definition' })
  @ApiOkResponse({ type: AttributeAliasResponseDto, isArray: true })
  listAttributeAliases(
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Query() query: MasterStatusQueryDto,
  ): Promise<AttributeAliasResponseDto[]> {
    return this.attributeMasters.listAliases(attributeId, query);
  }

  @Post('attributes/:attributeId/aliases')
  @ApiOperation({ summary: 'Create an alias for an Attribute Definition' })
  @ApiCreatedResponse({ type: AttributeAliasResponseDto })
  createAttributeAlias(
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Body() input: CreateAttributeAliasDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeAliasResponseDto> {
    return this.attributeMasters.createAlias(
      attributeId,
      input,
      principal.userId,
    );
  }

  @Patch('attributes/:attributeId/aliases/:aliasId')
  @ApiOperation({ summary: 'Update an Attribute Alias with optimistic versioning' })
  @ApiOkResponse({ type: AttributeAliasResponseDto })
  updateAttributeAlias(
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
    @Body() input: UpdateAttributeAliasDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeAliasResponseDto> {
    return this.attributeMasters.updateAlias(
      attributeId,
      aliasId,
      input,
      principal.userId,
    );
  }

  @Get('attributes')
  @ApiOperation({ summary: 'List master attributes for administration' })
  @ApiOkResponse({ type: AttributeDefinitionResponseDto, isArray: true })
  listAttributes(
    @Query() query: AttributeAdminQueryDto,
  ): Promise<AttributeDefinitionResponseDto[]> {
    return this.attributes.listAdminAttributes(query);
  }

  @Get('attributes/page')
  @ApiOperation({ summary: 'Search and page master Attributes for large Admin libraries' })
  @ApiOkResponse({ type: AttributeDefinitionPageResponseDto })
  listAttributesPage(
    @Query() query: AttributeAdminPageQueryDto,
  ): Promise<AttributeDefinitionPageResponseDto> {
    return this.attributes.listAdminAttributesPage(query);
  }

  @Get('attributes/summary')
  @ApiOperation({ summary: 'Summarize Attribute Definitions by group' })
  @ApiOkResponse({ type: AttributeDefinitionSummaryResponseDto })
  getAttributeSummary(): Promise<AttributeDefinitionSummaryResponseDto> {
    return this.attributes.getAdminAttributeSummary();
  }

  @Get('attributes/export')
  @ApiOperation({ summary: 'Export the filtered Attribute Library as CSV' })
  @ApiOkResponse({ type: AttributeCsvExportResponseDto })
  exportAttributes(
    @Query() query: AttributeCsvExportQueryDto,
  ): Promise<AttributeCsvExportResponseDto> {
    return this.attributes.exportAttributesCsv(query);
  }

  @Post('attributes/import/preview')
  @ApiOperation({
    summary: 'Preview and validate an Attribute CSV import without writing data',
  })
  @ApiOkResponse({ type: AttributeCsvImportPreviewResponseDto })
  previewAttributeImport(
    @Body() input: AttributeCsvImportRequestDto,
  ): Promise<AttributeCsvImportPreviewResponseDto> {
    return this.attributes.previewAttributeCsvImport(input);
  }

  @Post('attributes/import/commit')
  @ApiOperation({
    summary: 'Atomically commit a validated Attribute CSV import',
  })
  @ApiCreatedResponse({ type: AttributeCsvImportCommitResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or lifecycle conflict' })
  commitAttributeImport(
    @Body() input: AttributeCsvImportRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeCsvImportCommitResponseDto> {
    return this.attributes.commitAttributeCsvImport(input, principal.userId);
  }

  @Get('attributes/:id')
  @ApiOperation({ summary: 'Get one master Attribute for administration' })
  @ApiOkResponse({ type: AttributeDefinitionResponseDto })
  getAttribute(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttributeDefinitionResponseDto> {
    return this.attributes.getAdminAttribute(id);
  }

  @Post('attributes')
  @ApiOperation({ summary: 'Create a master attribute definition' })
  @ApiCreatedResponse({ type: AttributeDefinitionResponseDto })
  @ApiConflictResponse({ description: 'Duplicate attribute definition' })
  createAttribute(
    @Body() input: CreateAttributeDefinitionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeDefinitionResponseDto> {
    return this.attributes.createAttribute(input, principal.userId);
  }

  @Patch('attributes/:id')
  @ApiOperation({ summary: 'Update a master attribute with optimistic versioning' })
  @ApiOkResponse({ type: AttributeDefinitionResponseDto })
  @ApiConflictResponse({ description: 'Version or lifecycle conflict' })
  updateAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeDefinitionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeDefinitionResponseDto> {
    return this.attributes.updateAttribute(id, input, principal.userId);
  }

  @Get('attributes/:id/values')
  @ApiOperation({ summary: 'List approved static values for an attribute' })
  @ApiOkResponse({ type: AttributeAllowedValueResponseDto, isArray: true })
  listAttributeValues(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AttributeAllowedValueAdminQueryDto,
  ): Promise<AttributeAllowedValueResponseDto[]> {
    return this.attributes.listAdminAllowedValues(id, query);
  }

  @Post('attributes/:id/values')
  @ApiOperation({ summary: 'Create a static allowed value for an attribute' })
  @ApiCreatedResponse({ type: AttributeAllowedValueResponseDto })
  @ApiConflictResponse({ description: 'Duplicate or non-static attribute state' })
  createAttributeValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateAttributeAllowedValueDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeAllowedValueResponseDto> {
    return this.attributes.createAllowedValue(id, input, principal.userId);
  }

  @Patch('attributes/:id/values/:valueId')
  @ApiOperation({ summary: 'Update a static allowed value with optimistic versioning' })
  @ApiOkResponse({ type: AttributeAllowedValueResponseDto })
  @ApiConflictResponse({ description: 'Version or lifecycle conflict' })
  updateAttributeValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() input: UpdateAttributeAllowedValueDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AttributeAllowedValueResponseDto> {
    return this.attributes.updateAllowedValue(
      id,
      valueId,
      input,
      principal.userId,
    );
  }
}
