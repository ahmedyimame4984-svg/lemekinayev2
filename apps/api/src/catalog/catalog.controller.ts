import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { CatalogService } from './catalog.service.js';
import { CategoryResponseDto } from './dto/category.dto.js';

@ApiTags('Catalog')
@Public()
@Controller('catalog/categories')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List active catalog categories' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  listCategories(): Promise<CategoryResponseDto[]> {
    return this.catalog.listPublishedCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an active catalog category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Active category not found' })
  getCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.catalog.getPublishedCategory(id);
  }
}
