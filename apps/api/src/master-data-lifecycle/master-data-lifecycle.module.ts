import { CanonicalReferenceReadOnlyGuard } from '../reference-sync/canonical-reference-readonly.guard.js';
import { Module } from '@nestjs/common';
import {
  AdminCatalogLifecycleController,
  AdminSourcingLifecycleController,
  AdminVehicleLifecycleController,
} from './master-data-lifecycle.controller.js';
import { MasterDataLifecycleService } from './master-data-lifecycle.service.js';

@Module({
  controllers: [
    AdminCatalogLifecycleController,
    AdminSourcingLifecycleController,
    AdminVehicleLifecycleController,
  ],
  providers: [MasterDataLifecycleService, CanonicalReferenceReadOnlyGuard],
  exports: [MasterDataLifecycleService],
})
export class MasterDataLifecycleModule {}
