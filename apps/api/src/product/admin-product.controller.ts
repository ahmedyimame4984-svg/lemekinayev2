import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
  CatalogArticleImportCommitResponseDto,
  CatalogArticleImportJobResponseDto,
  CatalogArticleImportPreviewResponseDto,
  CatalogArticleImportRequestDto,
  ProfessionalCatalogArticleImportCommitRequestDto,
  ProfessionalCatalogArticleImportCommitResponseDto,
  ProfessionalCatalogArticleImportInspectRequestDto,
  ProfessionalCatalogArticleImportInspectResponseDto,
  ProfessionalCatalogArticleImportPreviewResponseDto,
  ProfessionalCatalogArticleImportRequestDto,
} from './dto/catalog-article-import.dto.js';
import {
  ArticleRelationAdminQueryDto,
  ArticleRelationResponseDto,
} from './dto/article-relation.dto.js';
import { ArticleValidationResponseDto } from './dto/article-validation.dto.js';
import {
  ProductAssetAdminQueryDto,
  ProductAssetResponseDto,
} from './dto/product-asset.dto.js';
import {
  ProductAdminQueryDto,
  ProductResponseDto,
} from './dto/product.dto.js';
import { ArticleRelationService } from './article-relation.service.js';
import { ArticleValidationService } from './article-validation.service.js';
import { AdminArticleReviewService } from './admin-article-review.service.js';
import { AdminArticleInspectorService } from './admin-article-inspector.service.js';
import {
  AdminArticleInspectorDto,
  AdminArticleInspectorQueryDto,
} from './dto/admin-article-inspector.dto.js';
import {
  AdminArticleReviewApproveDto,
  AdminArticleReviewDecisionResultDto,
  AdminArticleReviewPageDto,
  AdminArticleReviewPageQueryDto,
  AdminArticleReviewReturnDto,
} from './dto/admin-article-review.dto.js';
import { ProductAssetService } from './product-asset.service.js';
import { ProductService } from './product.service.js';

@ApiTags('Admin products')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'catalog.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage')
@Controller('admin/products')
export class AdminProductController {
  constructor(
    private readonly products: ProductService,
    private readonly assets: ProductAssetService,
    private readonly articleRelations: ArticleRelationService,
    private readonly articleValidation: ArticleValidationService,
    private readonly articleReview: AdminArticleReviewService,
    private readonly articleInspector: AdminArticleInspectorService,
  ) {}

  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Preview a normalized approved-catalog Manufacturer Article import with zero writes',
  })
  @ApiOkResponse({ type: CatalogArticleImportPreviewResponseDto })
  previewImport(
    @Body() input: CatalogArticleImportRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CatalogArticleImportPreviewResponseDto> {
    return this.products.previewApprovedCatalogImport(
      input,
      principal.userId,
    );
  }

  @Post('import/commit')
  @ApiOperation({
    summary:
      'Revalidate and atomically commit a clean normalized approved-catalog Manufacturer Article import',
  })
  @ApiCreatedResponse({ type: CatalogArticleImportCommitResponseDto })
  commitImport(
    @Body() input: CatalogArticleImportRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<CatalogArticleImportCommitResponseDto> {
    return this.products.commitApprovedCatalogImport(
      input,
      principal.userId,
    );
  }

  @Post('import/file/inspect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inspect CSV/XLSX Article source headers before configuring column mapping',
  })
  @ApiOkResponse({ type: ProfessionalCatalogArticleImportInspectResponseDto })
  inspectProfessionalImport(
    @Body() input: ProfessionalCatalogArticleImportInspectRequestDto,
  ): ProfessionalCatalogArticleImportInspectResponseDto {
    return this.products.inspectProfessionalCatalogImport(input);
  }

  @Post('import/file/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Parse, map and validate CSV/XLSX Manufacturer Article import files with zero writes',
  })
  @ApiOkResponse({ type: ProfessionalCatalogArticleImportPreviewResponseDto })
  previewProfessionalImport(
    @Body() input: ProfessionalCatalogArticleImportRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProfessionalCatalogArticleImportPreviewResponseDto> {
    return this.products.previewProfessionalCatalogImport(
      input,
      principal.userId,
    );
  }

  @Post('import/file/commit')
  @ApiOperation({
    summary:
      'Re-parse, fingerprint-check and atomically commit a reviewed CSV/XLSX Manufacturer Article import',
  })
  @ApiCreatedResponse({
    type: ProfessionalCatalogArticleImportCommitResponseDto,
  })
  commitProfessionalImport(
    @Body() input: ProfessionalCatalogArticleImportCommitRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProfessionalCatalogArticleImportCommitResponseDto> {
    return this.products.commitProfessionalCatalogImport(
      input,
      principal.userId,
    );
  }

  @Get('import/jobs')
  @ApiOperation({
    summary:
      'List recent committed professional Manufacturer Article import jobs',
  })
  @ApiOkResponse({ type: CatalogArticleImportJobResponseDto, isArray: true })
  listProfessionalImportJobs(): Promise<CatalogArticleImportJobResponseDto[]> {
    return this.products.listProfessionalCatalogImportJobs();
  }

  @Get(':id/inspector')
  @RequirePermissions('catalog.manage', 'seller.manage')
  @ApiOperation({
    summary:
      'Inspect one canonical Manufacturer Article across identity, technical values, evidence, fitment, relations and readiness',
  })
  @ApiOkResponse({ type: AdminArticleInspectorDto })
  inspectArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AdminArticleInspectorQueryDto,
  ): Promise<AdminArticleInspectorDto> {
    return this.articleInspector.get(id, query);
  }

  @Get('article-review')
  @RequirePermissions('catalog.manage', 'seller.manage')
  @ApiOperation({
    summary:
      'Page Manufacturer Articles for Admin catalog governance and Seller-submission review',
  })
  @ApiOkResponse({ type: AdminArticleReviewPageDto })
  listArticleReview(
    @Query() query: AdminArticleReviewPageQueryDto,
  ): Promise<AdminArticleReviewPageDto> {
    return this.articleReview.list(query);
  }

  @Post(':id/article-review/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('catalog.manage', 'seller.manage')
  @ApiOperation({
    summary:
      'Approve a submitted Seller Manufacturer Article after strict activation validation',
  })
  @ApiOkResponse({ type: AdminArticleReviewDecisionResultDto })
  approveArticleReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdminArticleReviewApproveDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminArticleReviewDecisionResultDto> {
    return this.articleReview.approve(id, input, principal.userId);
  }

  @Post(':id/article-review/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('catalog.manage', 'seller.manage')
  @ApiOperation({
    summary:
      'Return a submitted Seller Manufacturer Article for Seller corrections',
  })
  @ApiOkResponse({ type: AdminArticleReviewDecisionResultDto })
  returnArticleReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdminArticleReviewReturnDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AdminArticleReviewDecisionResultDto> {
    return this.articleReview.returnToSeller(id, input, principal.userId);
  }

  @Get()
  @ApiOperation({
    summary:
      'List Manufacturer Article records for read-only administration and future moderation',
  })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  list(@Query() query: ProductAdminQueryDto): Promise<ProductResponseDto[]> {
    return this.products.listAdmin(query);
  }

  @Get(':id/relations')
  @ApiOperation({
    summary:
      'List Manufacturer Article relations for read-only administration',
  })
  @ApiOkResponse({ type: ArticleRelationResponseDto, isArray: true })
  listRelations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ArticleRelationAdminQueryDto,
  ): Promise<ArticleRelationResponseDto[]> {
    return this.articleRelations.listAdmin(id, query);
  }

  @Get(':id/validation')
  @ApiOperation({
    summary:
      'Validate Manufacturer Article readiness against its immutable Product Type schema',
  })
  @ApiOkResponse({ type: ArticleValidationResponseDto })
  validateArticle(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ArticleValidationResponseDto> {
    return this.articleValidation.validate(id);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Retrieve a Manufacturer Article record for read-only administration',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.products.getAdmin(id);
  }

  @Get(':id/assets')
  @ApiOperation({
    summary: 'List assets on a Manufacturer Article for read-only administration',
  })
  @ApiOkResponse({ type: ProductAssetResponseDto, isArray: true })
  listAssets(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProductAssetAdminQueryDto,
  ): Promise<ProductAssetResponseDto[]> {
    return this.assets.list(id, query);
  }
}
