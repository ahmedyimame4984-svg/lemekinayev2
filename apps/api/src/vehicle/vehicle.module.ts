import { CanonicalReferenceReadOnlyGuard } from '../reference-sync/canonical-reference-readonly.guard.js';
import { AdminGenerationFamilyController } from './admin-generation-family.controller.js';
import { GenerationFamilyService } from './generation-family.service.js';
import { AdminVehicleMarketController } from './admin-vehicle-market.controller.js';
import { VehicleMarketService } from './vehicle-market.service.js';
import { Module } from '@nestjs/common';
import { AdminVehicleConfigurationController } from './admin-vehicle-configuration.controller.js';
import { AdminVehicleIdentificationController } from './admin-vehicle-identification.controller.js';
import { AdminVehicleController } from './admin-vehicle.controller.js';
import { VehicleConfigurationController } from './vehicle-configuration.controller.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';
import { VehicleController } from './vehicle.controller.js';
import { VehicleIdentificationController } from './vehicle-identification.controller.js';
import { VehicleIdentificationService } from './vehicle-identification.service.js';
import { VehicleProfileController } from './vehicle-profile.controller.js';
import { VehicleProfileService } from './vehicle-profile.service.js';
import { VehicleService } from './vehicle.service.js';
import { NhtsaVinDecoderProvider } from './nhtsa-vin-decoder.provider.js';
import { VinController } from './vin.controller.js';
import { VinService } from './vin.service.js';

@Module({
  controllers: [
    AdminGenerationFamilyController,
    AdminVehicleMarketController,
    VehicleController,
    VehicleConfigurationController,
    AdminVehicleController,
    AdminVehicleConfigurationController,
    AdminVehicleIdentificationController,
    VehicleIdentificationController,
    VinController,
    VehicleProfileController,
  ],
  providers: [
    CanonicalReferenceReadOnlyGuard,
    GenerationFamilyService,
    VehicleMarketService,
    VehicleService,
    VehicleConfigurationService,
    NhtsaVinDecoderProvider,
    VinService,
    VehicleIdentificationService,
    VehicleProfileService,
  ],
  exports: [
    VehicleService,
    VehicleConfigurationService,
    VinService,
    VehicleIdentificationService,
    VehicleProfileService,
  ],
})
export class VehicleModule {}
