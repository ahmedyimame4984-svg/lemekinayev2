import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { ArticleIdentifierPublicResponseDto } from './dto/article-identifier.dto.js';
import { ArticleRelationPublicResponseDto } from './dto/article-relation.dto.js';
import { ProductResponseDto } from './dto/product.dto.js';
import { ArticleIdentifierService } from './article-identifier.service.js';
import { ArticleRelationService } from './article-relation.service.js';
import { ProductService } from './product.service.js';

@ApiTags('Products')
@Public()
@Controller('products')
export class ProductController {
  constructor(
    private readonly products: ProductService,
    private readonly articleRelations: ArticleRelationService,
    private readonly articleIdentifiers: ArticleIdentifierService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List ACTIVE canonical Manufacturer Articles' })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  list(): Promise<ProductResponseDto[]> {
    return this.products.listPublished();
  }

  @Get(':id/identifiers')
  @ApiOperation({
    summary: 'List Active GTIN and trade-number identifiers for a Manufacturer Article',
  })
  @ApiOkResponse({ type: ArticleIdentifierPublicResponseDto, isArray: true })
  listIdentifiers(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ArticleIdentifierPublicResponseDto[]> {
    return this.articleIdentifiers.listPublished(id);
  }

  @Get(':id/relations')
  @ApiOperation({
    summary:
      'List public canonical relations for an Active or Deprecated Manufacturer Article',
  })
  @ApiOkResponse({ type: ArticleRelationPublicResponseDto, isArray: true })
  listRelations(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ArticleRelationPublicResponseDto[]> {
    return this.articleRelations.listPublished(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an ACTIVE canonical Manufacturer Article' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Active Manufacturer Article not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.products.getPublished(id);
  }
}
