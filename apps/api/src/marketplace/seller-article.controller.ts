import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  CurrentPrincipal,
  RequireAccountTypes,
} from '../auth/auth.decorators.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { ProductTypeSchemaVersionResponseDto } from '../catalog/dto/product-type-schema.dto.js';
import { VehicleCompatibilityResponseDto } from '../compatibility/dto/compatibility.dto.js';
import { ArticleIdentifierResponseDto } from '../product/dto/article-identifier.dto.js';
import { ArticleRelationResponseDto } from '../product/dto/article-relation.dto.js';
import { ProductAssetResponseDto } from '../product/dto/product-asset.dto.js';
import { PartNumberResponseDto } from '../product/dto/product-identity.dto.js';
import {
  AddSellerArticleAssetDto,
  AddSellerArticleDirectIdentifierDto,
  AddSellerArticleExactFitmentDto,
  AddSellerArticleIdentifierDto,
  AddSellerArticleRelationDto,
  ResolveSellerArticleIdentityDto,
  SellerArticleProductTypeResponseDto,
  SellerArticleClassificationResponseDto,
  SellerArticleReviewReadinessDto,
  SellerArticleReviewSubmissionResultDto,
  SellerArticleSubmissionResultDto,
  SellerArticleSubmissionSummaryDto,
  SubmitSellerArticleDto,
  UpdateSellerArticleDraftDto,
} from './dto/seller-article.dto.js';
import { SellerArticleService } from './seller-article.service.js';

@ApiTags('Seller catalog submissions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({
  description: 'An operational Seller account is required',
})
@RequireAccountTypes(AccountType.SELLER)
@Controller('seller/catalog')
export class SellerArticleController {
  constructor(private readonly articles: SellerArticleService) {}

  @Get('classification')
  @ApiOkResponse({ type: SellerArticleClassificationResponseDto })
  listClassification(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleClassificationResponseDto> {
    return this.articles.listClassification(principal.userId);
  }

  @Get('product-types')
  @ApiOkResponse({ type: SellerArticleProductTypeResponseDto, isArray: true })
  listProductTypes(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleProductTypeResponseDto[]> {
    return this.articles.listProductTypes(principal.userId);
  }

  @Get('product-types/:id/schema')
  @ApiOkResponse({ type: ProductTypeSchemaVersionResponseDto })
  getProductTypeSchema(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductTypeSchemaVersionResponseDto> {
    return this.articles.getProductTypeSchema(id, principal.userId);
  }

  @Get('products/:id/preview')
  @ApiOkResponse({ description: 'Approved catalog product identity, attributes and configured vehicle fitments' })
  previewCatalogProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.articles.previewCatalogProduct(id, principal.userId);
  }

  @Get('articles')
  @ApiOkResponse({ type: SellerArticleSubmissionSummaryDto, isArray: true })
  listOwnSubmissions(
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleSubmissionSummaryDto[]> {
    return this.articles.listOwnSubmissions(principal.userId);
  }

  @Post('articles/resolve-identity')
  @ApiOkResponse({ type: SellerArticleSubmissionResultDto })
  resolveIdentity(
    @Body() input: ResolveSellerArticleIdentityDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleSubmissionResultDto | null> {
    return this.articles.resolveIdentity(input, principal.userId);
  }

  @Post('articles/duplicate-preflight')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Probable technical matches; only approved Articles and the Seller’s drafts are exposed.' })
  previewDuplicates(@Body() input: SubmitSellerArticleDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.articles.previewDuplicates(input, principal.userId);
  }

  @Post('articles/submit')
  @ApiCreatedResponse({ type: SellerArticleSubmissionResultDto })
  submit(
    @Body() input: SubmitSellerArticleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleSubmissionResultDto> {
    return this.articles.submit(input, principal.userId);
  }

  @Get('articles/:id/draft')
  @ApiOkResponse({ description: 'Seller-owned editable Article Draft and its bound schema attributes' })
  getOwnDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.articles.getOwnDraftDetails(id, principal.userId);
  }

  @Patch('articles/:id/draft')
  @ApiOkResponse({ description: 'Update Seller-editable Draft technical values using optimistic locking' })
  updateOwnDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSellerArticleDraftDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.articles.updateOwnDraft(id, input, principal.userId);
  }

  @Post('articles/:id/direct-identifiers')
  @ApiCreatedResponse({ type: ArticleIdentifierResponseDto })
  addDirectIdentifier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddSellerArticleDirectIdentifierDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ArticleIdentifierResponseDto> {
    return this.articles.addDirectIdentifier(id, input, principal.userId);
  }

  @Post('articles/:id/identifiers')
  @ApiCreatedResponse({ type: PartNumberResponseDto })
  addIdentifier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddSellerArticleIdentifierDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<PartNumberResponseDto> {
    return this.articles.addIdentifier(id, input, principal.userId);
  }

  @Post('articles/:id/relations')
  @ApiCreatedResponse({ type: ArticleRelationResponseDto })
  addRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddSellerArticleRelationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ArticleRelationResponseDto> {
    return this.articles.addRelation(id, input, principal.userId);
  }

  @Post('articles/:id/fitments/exact')
  @ApiCreatedResponse({ type: VehicleCompatibilityResponseDto })
  addExactFitment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddSellerArticleExactFitmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<VehicleCompatibilityResponseDto> {
    return this.articles.addExactFitment(id, input, principal.userId);
  }

  @Post('articles/:id/assets')
  @ApiCreatedResponse({ type: ProductAssetResponseDto })
  addAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddSellerArticleAssetDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<ProductAssetResponseDto> {
    return this.articles.addAsset(id, input, principal.userId);
  }

  @Get('articles/:id/validation')
  @ApiOkResponse({ type: SellerArticleReviewReadinessDto })
  validateSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleReviewReadinessDto> {
    return this.articles.validateSubmission(id, principal.userId);
  }

  @Post('articles/:id/submit-for-review')
  @ApiOkResponse({ type: SellerArticleReviewSubmissionResultDto })
  submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<SellerArticleReviewSubmissionResultDto> {
    return this.articles.submitForReview(id, principal.userId);
  }
}
