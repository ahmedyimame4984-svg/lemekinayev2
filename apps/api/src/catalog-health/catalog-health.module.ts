import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module.js';
import { CatalogHealthController } from './catalog-health.controller.js';
import { CatalogHealthService } from './catalog-health.service.js';

@Module({
  imports: [ProductModule],
  controllers: [CatalogHealthController],
  providers: [CatalogHealthService],
  exports: [CatalogHealthService],
})
export class CatalogHealthModule {}
