import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AdminPreferencesModule } from './admin-preferences/admin-preferences.module.js';
import { AdminImportsModule } from './admin-imports/admin-imports.module.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CatalogHealthModule } from './catalog-health/catalog-health.module.js';
import { CompatibilityModule } from './compatibility/compatibility.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { MasterDataLifecycleModule } from './master-data-lifecycle/master-data-lifecycle.module.js';
import { ProductModule } from './product/product.module.js';
import { ReferenceDataModule } from './reference-data/reference-data.module.js';
import { SearchModule } from './search/search.module.js';
import { SourcingModule } from './sourcing/sourcing.module.js';
import { VehicleModule } from './vehicle/vehicle.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AdminPreferencesModule,
    AdminImportsModule,
    AuditModule,
    HealthModule,
    MarketplaceModule,
    MasterDataLifecycleModule,
    CatalogModule,
    CatalogHealthModule,
    ProductModule,
    ReferenceDataModule,
    SearchModule,
    SourcingModule,
    CompatibilityModule,
    VehicleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
