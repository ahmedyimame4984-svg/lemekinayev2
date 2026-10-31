import { describe, expect, it } from 'vitest';
import type { VehicleMakeRecord, VehicleModelRecord } from './vehicle-contracts';
import {
  createVehicleCode,
  filterVehicleMakes,
  filterVehicleModels,
  hasVehicleManagePermission,
} from './vehicle-management';

const make = (
  id: string,
  name: string,
  status: VehicleMakeRecord['status'],
): VehicleMakeRecord => ({
  id,
  code: name.toUpperCase(),
  name,
  status,
  version: 1,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
});

const model = (
  id: string,
  makeId: string,
  name: string,
  status: VehicleModelRecord['status'],
): VehicleModelRecord => ({
  ...make(id, name, status),
  makeId,
});

describe('vehicle management helpers', () => {
  it('requires the stable vehicle.manage permission', () => {
    expect(hasVehicleManagePermission(['catalog.manage', 'vehicle.manage'])).toBe(
      true,
    );
    expect(hasVehicleManagePermission(['catalog.manage'])).toBe(false);
  });

  it('creates API-safe canonical codes from names', () => {
    expect(createVehicleCode(' Land Cruiser 300 ')).toBe('LAND_CRUISER_300');
    expect(createVehicleCode('C-Class')).toBe('C_CLASS');
  });

  it('filters and sorts makes without mutating the source', () => {
    const makes = [
      make('2', 'Toyota', 'ACTIVE'),
      make('1', 'BMW', 'DRAFT'),
      make('3', 'Audi', 'ACTIVE'),
    ];

    expect(filterVehicleMakes(makes, 'ACTIVE').map((item) => item.name)).toEqual(
      ['Audi', 'Toyota'],
    );
    expect(makes.map((item) => item.name)).toEqual(['Toyota', 'BMW', 'Audi']);
  });

  it('filters models by make and lifecycle status', () => {
    const models = [
      model('1', 'toyota', 'Corolla', 'ACTIVE'),
      model('2', 'toyota', 'Land Cruiser', 'DRAFT'),
      model('3', 'bmw', 'X5', 'ACTIVE'),
    ];

    expect(
      filterVehicleModels(models, 'ACTIVE', 'toyota').map((item) => item.name),
    ).toEqual(['Corolla']);
    expect(
      filterVehicleModels(models, 'ALL', 'toyota').map((item) => item.name),
    ).toEqual(['Corolla', 'Land Cruiser']);
  });
});
