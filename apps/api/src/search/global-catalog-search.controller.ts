import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import {
  GlobalCatalogSearchQueryDto,
  GlobalCatalogSearchResponseDto,
} from './dto/global-catalog-search.dto.js';
import { GlobalCatalogSearchService } from './global-catalog-search.service.js';

@ApiTags('Search')
@Public()
@Controller('search')
export class GlobalCatalogSearchController {
  constructor(
    private readonly searchService: GlobalCatalogSearchService,
  ) {}

  @Get('catalog')
  @ApiOperation({
    summary:
      'Search the public canonical catalog across Articles, references, Brands, Product Types, vehicles and searchable criteria',
  })
  @ApiOkResponse({ type: GlobalCatalogSearchResponseDto })
  search(
    @Query() query: GlobalCatalogSearchQueryDto,
  ): Promise<GlobalCatalogSearchResponseDto> {
    return this.searchService.search(query);
  }
}
