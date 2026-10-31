import type { MasterDataStatus } from './catalog-contracts';
import type { VehicleMakeRecord, VehicleModelRecord } from './vehicle-contracts';

export type VehicleStatusFilter = 'ALL' | MasterDataStatus;

export function hasVehicleManagePermission(permissions: string[]): boolean {
  return permissions.includes('vehicle.manage');
}

export function createVehicleCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 50);
}

export function filterVehicleMakes(
  makes: VehicleMakeRecord[],
  status: VehicleStatusFilter,
): VehicleMakeRecord[] {
  return [...makes]
    .filter((make) => status === 'ALL' || make.status === status)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterVehicleModels(
  models: VehicleModelRecord[],
  status: VehicleStatusFilter,
  makeId: string,
): VehicleModelRecord[] {
  return [...models]
    .filter((model) => status === 'ALL' || model.status === status)
    .filter((model) => makeId === 'ALL' || model.makeId === makeId)
    .sort((a, b) => a.name.localeCompare(b.name));
}
