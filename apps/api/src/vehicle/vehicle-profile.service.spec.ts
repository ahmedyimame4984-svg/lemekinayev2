import { BadRequestException } from '@nestjs/common';
import {
  MasterDataStatus,
  VehicleIdentificationMethod,
  VehicleProductionEndStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import {
  VehicleIdentifierResolutionSource,
  VehicleIdentifierResolutionStatus,
} from './dto/vehicle-identification.dto.js';
import type { VehicleConfigurationService } from './vehicle-configuration.service.js';
import type { VehicleIdentificationService } from './vehicle-identification.service.js';
import { VehicleProfileService } from './vehicle-profile.service.js';

describe('VehicleProfileService', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');
  const userId = '00000000-0000-4000-8000-000000000001';
  const configurationId = '00000000-0000-4000-8000-000000000010';

  const configuration = {
    id: configurationId,
    code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_CVT_2010',
    modelYear: 2010,
    productionStartYear: 2009,
    productionStartMonth: null,
    productionEndYear: 2011,
    productionEndMonth: null,
    productionEndStatus: VehicleProductionEndStatus.ENDED,
    steeringSide: null,
    make: { id: 'm1', code: 'TOYOTA', name: 'Toyota' },
    model: { id: 'm2', code: 'COROLLA', name: 'Corolla' },
    generation: { id: 'g1', code: 'E140', name: 'E140' },
    trim: { id: 't1', code: 'GLI', name: 'GLI', equipmentLevel: null },
    engine: {
      id: 'e1',
      code: '2ZR-FE',
      name: '2ZR-FE',
      family: null,
      displacementCc: 1798,
      fuelType: 'PETROL',
      cylinderCount: 4,
      aspiration: null,
      powerKw: null,
      torqueNm: null,
    },
    transmission: {
      id: 'tr1',
      code: 'CVT',
      transmissionType: 'CVT',
      gearCount: null,
      driveType: 'FWD',
    },
    bodyType: { id: 'b1', code: 'SEDAN', name: 'Sedan' },
    market: { id: 'mk1', code: 'ETHIOPIA', name: 'Ethiopia' },
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const profile = {
    id: '00000000-0000-4000-8000-000000000100',
    userId,
    vehicleConfigurationId: configurationId,
    identificationMethod: VehicleIdentificationMethod.VIN,
    identifierValue: 'JTDBU4EE9B9123456',
    identifierProvider: 'nhtsa-vpic',
    vin: 'JTDBU4EE9B9123456',
    vinProvider: 'nhtsa-vpic',
    manufactureYear: 2010,
    modelYear: 2010,
    registrationNumber: '3-A12345',
    displayName: 'My Corolla',
    isDefault: true,
    version: 1,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const vehicleProfile = {
    count: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const transaction = { vehicleProfile, auditLog };
  const database = {
    vehicleProfile,
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    ),
  } as unknown as DatabaseService;
  const configurations = {
    getPublishedConfiguration: vi.fn(),
    getConfigurationDetail: vi.fn(),
  };
  const identification = {
    validate: vi.fn(),
    resolve: vi.fn(),
  };

  const service = new VehicleProfileService(
    database,
    configurations as unknown as VehicleConfigurationService,
    identification as unknown as VehicleIdentificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    configurations.getPublishedConfiguration.mockResolvedValue(configuration);
    configurations.getConfigurationDetail.mockResolvedValue(configuration);
    identification.resolve.mockResolvedValue({
      status: VehicleIdentifierResolutionStatus.EXACT_MATCH,
      identifierType: VehicleIdentificationMethod.VIN,
      normalizedIdentifier: profile.identifierValue,
      provider: profile.identifierProvider,
      resolutionSource: VehicleIdentifierResolutionSource.VIN_PROVIDER,
      candidateCount: 1,
      matchedFields: ['make', 'model'],
      missingForExactMatch: [],
      candidates: [configuration],
    });
  });

  it('makes the first saved vehicle default and stores a resolved VIN', async () => {
    vehicleProfile.count.mockResolvedValue(0);
    vehicleProfile.updateMany.mockResolvedValue({ count: 0 });
    vehicleProfile.create.mockResolvedValue(profile);
    auditLog.create.mockResolvedValue({});

    const result = await service.create(
      {
        vehicleConfigurationId: configurationId,
        vin: ' jtdbu4ee9b9123456 ',
        vinProvider: 'nhtsa-vpic',
        manufactureYear: 2010,
        modelYear: 2010,
        registrationNumber: ' 3-a12345 ',
        displayName: ' My Corolla ',
        isDefault: false,
      },
      userId,
    );

    expect(identification.resolve).toHaveBeenCalledWith({
      identifier: 'jtdbu4ee9b9123456',
      identifierType: VehicleIdentificationMethod.VIN,
      provider: 'nhtsa-vpic',
      modelYear: 2010,
    });
    expect(vehicleProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          vehicleConfigurationId: configurationId,
          identificationMethod: VehicleIdentificationMethod.VIN,
          identifierValue: profile.identifierValue,
          identifierProvider: 'nhtsa-vpic',
          vin: profile.vin,
          vinProvider: 'nhtsa-vpic',
          manufactureYear: 2010,
          modelYear: 2010,
          registrationNumber: '3-A12345',
          displayName: 'My Corolla',
          isDefault: true,
        }),
      }),
    );
    expect(result.configuration).toBe(configuration);
  });

  it('stores a confirmed chassis identifier without pretending it is a VIN', async () => {
    const chassisProfile = {
      ...profile,
      identificationMethod: VehicleIdentificationMethod.CHASSIS,
      identifierValue: 'NZE1210123456',
      identifierProvider: 'approved-jdm-source',
      vin: null,
      vinProvider: null,
    };
    identification.resolve.mockResolvedValue({
      status: VehicleIdentifierResolutionStatus.EXACT_MATCH,
      identifierType: VehicleIdentificationMethod.CHASSIS,
      normalizedIdentifier: 'NZE1210123456',
      provider: 'approved-jdm-source',
      resolutionSource: VehicleIdentifierResolutionSource.VERIFIED_MAPPING,
      candidateCount: 1,
      matchedFields: ['verifiedIdentifierMapping'],
      missingForExactMatch: [],
      candidates: [configuration],
    });
    vehicleProfile.count.mockResolvedValue(0);
    vehicleProfile.updateMany.mockResolvedValue({ count: 0 });
    vehicleProfile.create.mockResolvedValue(chassisProfile);
    auditLog.create.mockResolvedValue({});

    await service.create(
      {
        vehicleConfigurationId: configurationId,
        identifierType: VehicleIdentificationMethod.CHASSIS,
        identifier: 'NZE121-0123456',
        identifierProvider: 'approved-jdm-source',
      },
      userId,
    );

    expect(vehicleProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identificationMethod: VehicleIdentificationMethod.CHASSIS,
          identifierValue: 'NZE1210123456',
          identifierProvider: 'approved-jdm-source',
          vin: null,
          vinProvider: null,
        }),
      }),
    );
  });

  it('rejects an invalid typed identifier before writing a garage record', async () => {
    identification.resolve.mockResolvedValue({
      status: VehicleIdentifierResolutionStatus.INVALID_IDENTIFIER,
      identifierType: VehicleIdentificationMethod.VIN,
      normalizedIdentifier: 'BADVIN',
      provider: null,
      resolutionSource: VehicleIdentifierResolutionSource.NONE,
      candidateCount: 0,
      matchedFields: [],
      missingForExactMatch: [],
      candidates: [],
    });

    await expect(
      service.create(
        {
          vehicleConfigurationId: configurationId,
          vin: 'BADVIN',
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an identifier that resolves to a different vehicle', async () => {
    identification.resolve.mockResolvedValue({
      status: VehicleIdentifierResolutionStatus.MULTIPLE_MATCHES,
      identifierType: VehicleIdentificationMethod.VIN,
      normalizedIdentifier: profile.identifierValue,
      provider: 'nhtsa-vpic',
      resolutionSource: VehicleIdentifierResolutionSource.VIN_PROVIDER,
      candidateCount: 1,
      matchedFields: ['make', 'model'],
      missingForExactMatch: ['engine'],
      candidates: [{ ...configuration, id: 'different-configuration' }],
    });

    await expect(
      service.create(
        {
          vehicleConfigurationId: configurationId,
          vin: profile.vin,
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'GARAGE_IDENTIFIER_CONFIGURATION_MISMATCH' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('allows a manual saved vehicle without identifier metadata', async () => {
    const manualProfile = {
      ...profile,
      identificationMethod: VehicleIdentificationMethod.MANUAL,
      identifierValue: null,
      identifierProvider: null,
      vin: null,
      vinProvider: null,
    };
    vehicleProfile.count.mockResolvedValue(0);
    vehicleProfile.updateMany.mockResolvedValue({ count: 0 });
    vehicleProfile.create.mockResolvedValue(manualProfile);
    auditLog.create.mockResolvedValue({});

    await service.create(
      {
        vehicleConfigurationId: configurationId,
        manufactureYear: 2010,
      },
      userId,
    );

    expect(identification.resolve).not.toHaveBeenCalled();
    expect(vehicleProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identificationMethod: VehicleIdentificationMethod.MANUAL,
          identifierValue: null,
          vin: null,
        }),
      }),
    );
  });

  it('rejects a Garage manufacture year outside the canonical configuration period', async () => {
    await expect(
      service.create(
        {
          vehicleConfigurationId: configurationId,
          manufactureYear: 2012,
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'GARAGE_VEHICLE_YEAR_OUTSIDE_CONFIGURATION' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('returns saved vehicles with canonical configuration and identifier details', async () => {
    vehicleProfile.findMany.mockResolvedValue([profile]);

    await expect(service.list(userId)).resolves.toEqual([
      {
        id: profile.id,
        vehicleConfigurationId: configurationId,
        identificationMethod: VehicleIdentificationMethod.VIN,
        identifierValue: profile.identifierValue,
        identifierProvider: profile.identifierProvider,
        vin: profile.vin,
        vinProvider: profile.vinProvider,
        manufactureYear: profile.manufactureYear,
        modelYear: profile.modelYear,
        registrationNumber: profile.registrationNumber,
        displayName: profile.displayName,
        isDefault: true,
        version: 1,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
        configuration,
      },
    ]);
  });

  it('promotes another vehicle when the default saved vehicle is removed', async () => {
    vehicleProfile.findFirst
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({
        id: '00000000-0000-4000-8000-000000000101',
      });
    vehicleProfile.delete.mockResolvedValue(profile);
    vehicleProfile.update.mockResolvedValue({});
    auditLog.create.mockResolvedValue({});

    await service.remove(profile.id, userId);

    expect(vehicleProfile.update).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000101' },
      data: { isDefault: true, version: { increment: 1 } },
    });
  });
});
