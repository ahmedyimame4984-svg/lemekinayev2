import { Module } from '@nestjs/common';
import { GlobalCatalogSearchController } from './global-catalog-search.controller.js';
import { GlobalCatalogSearchService } from './global-catalog-search.service.js';

@Module({
  controllers: [GlobalCatalogSearchController],
  providers: [GlobalCatalogSearchService],
  exports: [GlobalCatalogSearchService],
})
export class SearchModule {}
