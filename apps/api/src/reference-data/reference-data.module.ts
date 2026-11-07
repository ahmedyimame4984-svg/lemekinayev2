import { CanonicalReferenceReadOnlyGuard } from '../reference-sync/canonical-reference-readonly.guard.js';
import { Module } from '@nestjs/common';
import { AdminReferenceDataController } from './admin-reference-data.controller.js';
import { MasterReferenceBootstrapService } from './master-reference-bootstrap.service.js';
import { MasterReferenceService } from './master-reference.service.js';
import { StrategicVehicleCoverageService } from './strategic-vehicle-coverage.service.js';

@Module({
  controllers: [AdminReferenceDataController],
  providers: [
    CanonicalReferenceReadOnlyGuard,
    MasterReferenceService,
    MasterReferenceBootstrapService,
    StrategicVehicleCoverageService,
  ],
  exports: [MasterReferenceService, StrategicVehicleCoverageService],
})
export class ReferenceDataModule {}
