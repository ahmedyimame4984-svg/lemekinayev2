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
  ArticleIdentifierAdminQueryDto,
  ArticleIdentifierResponseDto,
} from './dto/article-identifier.dto.js';
import {
  BrandAdminPageQueryDto,
  BrandAdminQueryDto,
  BrandBulkStatusResponseDto,
  BrandPageResponseDto,
  BrandResponseDto,
  BulkUpdateBrandStatusDto,
  CreateBrandDto,
  PartNumberAdminQueryDto,
  PartNumberResponseDto,
  UpdateBrandDto,
} from './dto/product-identity.dto.js';
import { ArticleIdentifierService } from './article-identifier.service.js';
import { ProductIdentityService } from './product-identity.service.js';

@ApiTags('Admin product identity')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({ description: 'catalog.manage is required' })
@RequireAccountTypes(AccountType.ADMIN)
@RequirePermissions('catalog.manage')
@Controller('admin')
export class AdminProductIdentityController {
  constructor(
    private readonly identity: ProductIdentityService,
    private readonly articleIdentifiers: ArticleIdentifierService,
  ) {}

  @Get('brands')
  @ApiOperation({ summary: 'List centrally governed Brand Master records' })
  @ApiOkResponse({ type: BrandResponseDto, isArray: true })
  listBrands(@Query() query: BrandAdminQueryDto): Promise<BrandResponseDto[]> {
    return this.identity.listAdminBrands(query);
  }

  @Get('brands/page')
  @ApiOperation({
    summary: 'Search and page centrally governed Brand Master records',
  })
  @ApiOkResponse({ type: BrandPageResponseDto })
  listBrandsPage(
    @Query() query: BrandAdminPageQueryDto,
  ): Promise<BrandPageResponseDto> {
    return this.identity.listAdminBrandsPage(query);
  }

  @Post('brands')
  @ApiOperation({
    summary:
      'Create a Brand Master reference that sellers can select when creating products',
  })
  @ApiCreatedResponse({ type: BrandResponseDto })
  createBrand(
    @Body() input: CreateBrandDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<BrandResponseDto> {
    return this.identity.createBrand(input, principal.userId);
  }

  @Patch('brands/bulk-status')
  @ApiOperation({ summary: 'Change Brand lifecycle status in bulk' })
  @ApiOkResponse({ type: BrandBulkStatusResponseDto })
  @ApiConflictResponse({ description: 'Version or lifecycle conflict' })
  bulkUpdateBrandStatus(
    @Body() input: BulkUpdateBrandStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<BrandBulkStatusResponseDto> {
    return this.identity.bulkUpdateBrandStatus(input, principal.userId);
  }

  @Patch('brands/:id')
  @ApiOperation({ summary: 'Update a Brand Master reference record' })
  @ApiOkResponse({ type: BrandResponseDto })
  @ApiConflictResponse({ description: 'Version or lifecycle conflict' })
  updateBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateBrandDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<BrandResponseDto> {
    return this.identity.updateBrand(id, input, principal.userId);
  }

  @Get('products/:productId/article-identifiers')
  @ApiOperation({
    summary:
      'List GTIN and trade-number identifiers on a Manufacturer Article for read-only administration',
  })
  @ApiOkResponse({ type: ArticleIdentifierResponseDto, isArray: true })
  listArticleIdentifiers(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ArticleIdentifierAdminQueryDto,
  ): Promise<ArticleIdentifierResponseDto[]> {
    return this.articleIdentifiers.list(productId, query);
  }

  @Get('products/:productId/part-numbers')
  @ApiOperation({
    summary:
      'List OE and reference identifiers on a Manufacturer Article for read-only administration',
  })
  @ApiOkResponse({ type: PartNumberResponseDto, isArray: true })
  listPartNumbers(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: PartNumberAdminQueryDto,
  ): Promise<PartNumberResponseDto[]> {
    return this.identity.listPartNumbers(productId, query);
  }
}
