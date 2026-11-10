import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { ReferenceDataUpserter } from './reference-data-upserter.js';
import { SYNCHRONIZATION_ORDER } from './reference-sync.types.js';

const ids = {
  config: '00000000-0000-4000-8000-000000000001',
  battery: '00000000-0000-4000-8000-000000000002',
  charger: '00000000-0000-4000-8000-000000000003',
  motor: '00000000-0000-4000-8000-000000000004',
  drive: '00000000-0000-4000-8000-000000000005',
  motorLink: '00000000-0000-4000-8000-000000000007',
  driveLink: '00000000-0000-4000-8000-000000000008',
};

function fixture() {
  const upsert = vi.fn().mockResolvedValue({ id: ids.config });
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const delegate = () => ({ upsert: vi.fn().mockResolvedValue({}), updateMany });
  const tx = {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000006' }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    vehicleBatteryPack: delegate(),
    vehicleChargingSystem: delegate(),
    vehicleElectricMotor: delegate(),
    vehicleDriveUnit: delegate(),
    vehicleConfiguration: { upsert, updateMany },
  };
  return { tx, upsert, updateMany, upserter: new ReferenceDataUpserter() };
}

describe('AutotechDoc EV v1.1 reference import', () => {
  it('orders EV component masters before referenced configurations', () => {
    const configIndex = SYNCHRONIZATION_ORDER.indexOf('VehicleConfiguration');
    for (const kind of ['VehicleBatteryPack', 'VehicleChargingSystem',
      'VehicleElectricMotor', 'VehicleDriveUnit'] as const) {
      expect(SYNCHRONIZATION_ORDER.indexOf(kind)).toBeLessThan(configIndex);
    }
  });

  it('imports approved battery, charger, motor and drive-unit hardware with original IDs', async () => {
    const { tx, upserter } = fixture();
    const values = [
      ['VehicleBatteryPack', ids.battery, {
        storageKind: 'BATTERY', grossCapacityKwh: 80, usableCapacityKwh: 76,
      }, tx.vehicleBatteryPack],
      ['VehicleChargingSystem', ids.charger, {
        dcConnector: 'CCS2', maxDcPowerKw: 150,
      }, tx.vehicleChargingSystem],
      ['VehicleElectricMotor', ids.motor, {
        technology: 'PMSM', peakPowerKw: 180,
      }, tx.vehicleElectricMotor],
      ['VehicleDriveUnit', ids.drive, {
        integrationKind: 'INTEGRATED_E_DRIVE', reductionRatio: 9.6,
      }, tx.vehicleDriveUnit],
    ] as const;
    for (const [type, id, details, delegate] of values) {
      const row = { id, code: type, name: type, status: 'ACTIVE', version: 3, ...details };
      await expect(upserter.upsertRecord(tx as unknown as Prisma.TransactionClient,
        type, row)).resolves.toBe('APPLIED');
      expect(delegate.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { id },
        create: expect.objectContaining({ id, version: 3, status: 'ACTIVE' }),
        update: expect.objectContaining({ version: 3, status: 'ACTIVE' }),
      }));
    }
  });

  it('applies a BEV correction with atomic motor and drive-unit replacement', async () => {
    const { tx, upserter } = fixture();
    const row = {
      id: ids.config, identityCode: 'VC-BEV', code: 'BEV',
      makeId: ids.battery, modelId: ids.charger,
      powertrainType: 'BEV', engineId: null, transmissionId: null,
      batteryPackId: ids.battery, chargingSystemId: ids.charger,
      engineRole: null, status: 'ACTIVE', version: 5,
      electricMotors: [{
        id: ids.motorLink, electricMotorId: ids.motor, position: 'REAR_AXLE',
        quantity: 2, functionRoles: ['TRACTION'],
      }],
      driveUnits: [{
        id: ids.driveLink, driveUnitId: ids.drive, position: 'FRONT_AXLE',
        quantity: 1, functionRoles: ['TRACTION'],
      }],
    };
    await upserter.upsertRecord(tx as unknown as Prisma.TransactionClient,
      'VehicleConfiguration', row);
    expect(tx.vehicleConfiguration.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        powertrainType: 'BEV', engineId: null, transmissionId: null,
        batteryPackId: ids.battery, chargingSystemId: ids.charger,
        electricMotors: { create: [{
          id: ids.motorLink, electricMotorId: ids.motor, position: 'REAR_AXLE',
          quantity: 2, functionRoles: ['TRACTION'],
        }] },
      }),
      update: expect.objectContaining({
        batteryPackId: ids.battery,
        electricMotors: {
          deleteMany: { id: { notIn: [ids.motorLink] } },
          upsert: [{
            where: { id: ids.motorLink },
            create: { id: ids.motorLink, electricMotorId: ids.motor,
              position: 'REAR_AXLE', quantity: 2, functionRoles: ['TRACTION'] },
            update: { electricMotorId: ids.motor,
              position: 'REAR_AXLE', quantity: 2, functionRoles: ['TRACTION'] },
          }],
        },
        driveUnits: {
          deleteMany: { id: { notIn: [ids.driveLink] } },
          upsert: [{
            where: { id: ids.driveLink },
            create: { id: ids.driveLink, driveUnitId: ids.drive,
              position: 'FRONT_AXLE', quantity: 1, functionRoles: ['TRACTION'] },
            update: { driveUnitId: ids.drive,
              position: 'FRONT_AXLE', quantity: 1, functionRoles: ['TRACTION'] },
          }],
        },
      }),
    }));
  });

  it('rejects EV links without canonical UUIDs instead of fabricating consumer IDs', async () => {
    const { tx, upserter } = fixture();
    await expect(upserter.upsertRecord(tx as unknown as Prisma.TransactionClient,
      'VehicleConfiguration', {
        id: ids.config, identityCode: 'VC-BEV-MISSING-LINK-ID',
        makeId: ids.battery, modelId: ids.charger, status: 'ACTIVE',
        electricMotors: [{ electricMotorId: ids.motor, position: 'REAR_AXLE' }],
      })).rejects.toThrow(/canonical UUID/u);
    expect(tx.vehicleConfiguration.upsert).not.toHaveBeenCalled();
  });

  it('does not clear local hardware associations for an older publisher response', async () => {
    const { tx, upserter } = fixture();
    await upserter.upsertRecord(tx as unknown as Prisma.TransactionClient,
      'VehicleConfiguration', {
        id: ids.config, identityCode: 'VC-HISTORICAL',
        makeId: ids.battery, modelId: ids.charger,
        status: 'ACTIVE', version: 1,
      });
    const call = tx.vehicleConfiguration.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('electricMotors');
    expect(call.update).not.toHaveProperty('driveUnits');
    expect(call.update).not.toHaveProperty('batteryPackId');
    expect(call.update).not.toHaveProperty('chargingSystemId');
  });

  it('archives EV masters with retained referenced identities', async () => {
    const { tx, upserter, updateMany } = fixture();
    for (const type of ['VehicleBatteryPack', 'VehicleChargingSystem',
      'VehicleElectricMotor', 'VehicleDriveUnit'] as const) {
      await upserter.archiveRecord(tx as unknown as Prisma.TransactionClient,
        type, ids.battery);
    }
    expect(updateMany).toHaveBeenCalledTimes(4);
    for (const call of updateMany.mock.calls) {
      expect(call[0]).toMatchObject({
        where: { id: ids.battery },
        data: { status: 'ARCHIVED' },
      });
    }
  });
});
