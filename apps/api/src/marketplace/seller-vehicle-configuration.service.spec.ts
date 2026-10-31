import { MasterDataStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { SellerVehicleConfigurationService } from './seller-vehicle-configuration.service.js';

const modelId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const configurationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function setup() {
  const findMany = vi.fn();
  const database = { vehicleConfiguration: { findMany } };
  const service = new SellerVehicleConfigurationService(
    database as unknown as DatabaseService,
  );
  return { findMany, service };
}

describe('Seller configured-vehicle fitment labels', () => {
  it('uses only existing active configuration IDs and includes the full identity', async () => {
    const { findMany, service } = setup();
    findMany.mockResolvedValue([{
      id: configurationId,
      code: 'COROLLA-REF',
      make: { name: 'Toyota' },
      model: { name: 'Corolla' },
      generation: { name: 'E140', derivative: { name: 'Saloon' } },
      trim: { name: 'GLi' },
      engine: { name: '2ZR-FE 1.8L', code: '2ZR-FE', displacementCc: 1798, fuelType: 'PETROL' },
      transmission: { code: 'C50', transmissionType: 'MANUAL', gearCount: 5, driveType: 'FWD' },
      bodyType: { name: 'Sedan' },
      steeringSide: 'LHD',
      market: { name: 'GCC' },
      modelYear: 2010,
      productionStartYear: 2009,
      productionEndYear: 2011,
      productionEndStatus: 'ENDED',
    }]);

    const records = await service.listByModel(modelId);
    expect(records).toHaveLength(1);
    expect(records[0]?.value).toBe(configurationId);
    for (const expected of [
      'Toyota', 'Corolla', 'Saloon', 'E140', 'GLi', '2ZR-FE',
      '1798cc', 'PETROL', 'C50', 'MANUAL', '5-speed',
      'FWD', 'Sedan', 'LHD', 'GCC', 'MY 2010', 'Built 2009–2011',
      'COROLLA-REF',
    ]) {
      expect(records[0]?.label).toContain(expected);
    }
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        modelId,
        status: MasterDataStatus.ACTIVE,
        model: { status: MasterDataStatus.ACTIVE },
        make: { status: MasterDataStatus.ACTIVE },
      },
      select: expect.objectContaining({
        id: true,
        generation: expect.any(Object),
        engine: expect.any(Object),
        transmission: expect.any(Object),
      }),
    }));
  });

  it('handles missing optional ICE data for valid configured EV or hybrid vehicles', async () => {
    const { findMany, service } = setup();
    findMany.mockResolvedValue([{
      id: configurationId,
      code: null,
      make: { name: 'BYD' },
      model: { name: 'Atto 3' },
      generation: null,
      trim: null,
      engine: null,
      transmission: null,
      bodyType: null,
      steeringSide: null,
      market: null,
      modelYear: null,
      productionStartYear: 2025,
      productionEndYear: null,
      productionEndStatus: 'CURRENT',
    }]);

    expect(await service.listByModel(modelId)).toEqual([{
      value: configurationId,
      label: 'BYD · Atto 3 · Built 2025–present',
    }]);
  });

  it('returns no free-text or made-up configuration options when none is active', async () => {
    const { findMany, service } = setup();
    findMany.mockResolvedValue([]);
    expect(await service.listByModel(modelId)).toEqual([]);
  });
});
