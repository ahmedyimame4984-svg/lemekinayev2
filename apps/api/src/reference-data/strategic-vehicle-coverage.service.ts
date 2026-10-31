import { ConflictException, Injectable } from '@nestjs/common';

/** Kept for API compatibility; the legacy whole-Make installer is retired. */
export interface StrategicVehicleCoverageReconcileResult {
  createdMakes: number;
  createdModels: number;
  createdDerivatives: number;
  createdGenerations: number;
  createdTrims: number;
  createdEngines: number;
  createdTransmissions: number;
  createdConfigurations: number;
  skippedExistingMakes: string[];
}

@Injectable()
export class StrategicVehicleCoverageService {
  async reconcile(
    _actorId: string,
  ): Promise<StrategicVehicleCoverageReconcileResult> {
    throw new ConflictException({
      code: 'LEGACY_VEHICLE_LIBRARY_RETIRED',
      message:
        'Automated Vehicle library installation is retired. Create and maintain reference records manually through Admin Pro.',
    });
  }
}
