import { describe, expect, it } from 'vitest';
import { StrategicVehicleCoverageService } from './strategic-vehicle-coverage.service.js';

describe('retired strategic vehicle installer', () => {
  it('rejects legacy whole-Make installation without opening a database connection', async () => {
    const service = new StrategicVehicleCoverageService();
    await expect(service.reconcile('admin')).rejects.toMatchObject({
      response: { code: 'LEGACY_VEHICLE_LIBRARY_RETIRED' },
    });
  });
});
