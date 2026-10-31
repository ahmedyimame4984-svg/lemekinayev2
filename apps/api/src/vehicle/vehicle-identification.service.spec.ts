import {
  MasterDataStatus,
  ProvenanceVerificationState,
  VehicleIdentificationMethod,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import {
  VehicleIdentifierResolutionSource,
  VehicleIdentifierResolutionStatus,
} from './dto/vehicle-identification.dto.js';
import { VinResolutionStatus } from './dto/vin.dto.js';
import type { VehicleConfigurationService } from './vehicle-configuration.service.js';
import { VehicleIdentificationService } from './vehicle-identification.service.js';
import type { VinService } from './vin.service.js';

describe('VehicleIdentificationService', () => {
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const configurationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const mappingId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const now = new Date('2026-10-06T18:00:00.000Z');

  const vehicleIdentifierMapping = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleConfiguration = {
    findUnique: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const transaction = {
    vehicleIdentifierMapping,
    vehicleConfiguration,
    auditLog,
  };
  const database = {
    vehicleIdentifierMapping,
    auditLog,
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  } as unknown as DatabaseService;

  const configuration = {
    id: configurationId,
    code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_CVT_2010',
    modelYear: 2010,
    productionStartYear: 2009,
    productionStartMonth: null,
    productionEndYear: 2011,
    productionEndMonth: null,
    steeringSide: null,
    make: { id: 'm1', code: 'TOYOTA', name: 'Toyota' },
    model: { id: 'm2', code: 'COROLLA', name: 'Corolla' },
    derivative: null,
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

  const configurations = {
    getPublishedConfiguration: vi.fn(),
    getAdminConfiguration: vi.fn(),
  };

  const vin = {
    validate: vi.fn(),
    resolve: vi.fn(),
  };

  const service = new VehicleIdentificationService(
    database,
    configurations as unknown as VehicleConfigurationService,
    vin as unknown as VinService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vehicleIdentifierMapping.findFirst.mockResolvedValue(null);
    vehicleIdentifierMapping.findMany.mockResolvedValue([]);
    auditLog.create.mockResolvedValue({});
    configurations.getPublishedConfiguration.mockResolvedValue(configuration);
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      status: MasterDataStatus.ACTIVE,
    });
    vin.validate.mockImplementation((value: string) => ({
      valid: value.trim().toUpperCase() === 'JTDBU4EE9B9123456',
      normalizedVin: value.trim().toUpperCase(),
      errors:
        value.trim().toUpperCase() === 'JTDBU4EE9B9123456'
          ? []
          : ['Standard VIN must contain exactly 17 characters.'],
      wmi: value.trim().toUpperCase() === 'JTDBU4EE9B9123456' ? 'JTD' : null,
      vds: value.trim().toUpperCase() === 'JTDBU4EE9B9123456' ? 'BU4EE9' : null,
      vis:
        value.trim().toUpperCase() === 'JTDBU4EE9B9123456' ? 'B9123456' : null,
    }));
  });

  it('auto-detects only a structurally valid standard VIN', () => {
    expect(service.validate({ identifier: ' jtdbu4ee9b9123456 ' })).toEqual({
      valid: true,
      identifierType: VehicleIdentificationMethod.VIN,
      normalizedIdentifier: 'JTDBU4EE9B9123456',
      errors: [],
      wmi: 'JTD',
      vds: 'BU4EE9',
      vis: 'B9123456',
    });
  });

  it('requires an explicit type for a non-standard identifier instead of guessing', () => {
    const result = service.validate({ identifier: 'NZE121-0123456' });

    expect(result.valid).toBe(false);
    expect(result.identifierType).toBeNull();
    expect(result.normalizedIdentifier).toBe('NZE1210123456');
    expect(result.errors.join(' ')).toContain('Identifier type is required');
  });

  it('normalizes configured chassis identifiers without replacing characters silently', () => {
    expect(
      service.validate({
        identifier: ' nze121-0123456 ',
        identifierType: VehicleIdentificationMethod.CHASSIS,
      }),
    ).toMatchObject({
      valid: true,
      identifierType: VehicleIdentificationMethod.CHASSIS,
      normalizedIdentifier: 'NZE1210123456',
      errors: [],
    });
  });

  it('resolves a verified chassis mapping directly to one Active canonical configuration', async () => {
    vehicleIdentifierMapping.findFirst.mockResolvedValue({
      vehicleConfigurationId: configurationId,
      provider: 'approved-jdm-source',
    });

    const result = await service.resolve({
      identifier: 'NZE121-0123456',
      identifierType: VehicleIdentificationMethod.CHASSIS,
    });

    expect(result).toMatchObject({
      status: VehicleIdentifierResolutionStatus.EXACT_MATCH,
      identifierType: VehicleIdentificationMethod.CHASSIS,
      normalizedIdentifier: 'NZE1210123456',
      provider: 'approved-jdm-source',
      resolutionSource: VehicleIdentifierResolutionSource.VERIFIED_MAPPING,
      candidateCount: 1,
      candidates: [configuration],
    });
    expect(vin.resolve).not.toHaveBeenCalled();
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VEHICLE_IDENTIFIER_RESOLVED',
          entityType: 'VehicleIdentificationRequest',
          entityId: null,
          metadata: expect.objectContaining({
            identifierType: VehicleIdentificationMethod.CHASSIS,
            maskedIdentifier: expect.stringMatching(/\*+3456$/u),
            identifierFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
            status: VehicleIdentifierResolutionStatus.EXACT_MATCH,
          }),
        }),
      }),
    );
    const auditMetadata = auditLog.create.mock.calls[0]?.[0]?.data
      ?.metadata as Record<string, unknown>;
    expect(JSON.stringify(auditMetadata)).not.toContain('NZE1210123456');
  });

  it('returns NO_MATCH for an unmapped chassis instead of calling the VIN decoder', async () => {
    const result = await service.resolve({
      identifier: 'NZE121-0123456',
      identifierType: VehicleIdentificationMethod.CHASSIS,
    });

    expect(result.status).toBe(VehicleIdentifierResolutionStatus.NO_MATCH);
    expect(result.candidateCount).toBe(0);
    expect(vin.resolve).not.toHaveBeenCalled();
  });

  it('falls back to the provider-neutral VIN resolver when no verified VIN mapping exists', async () => {
    vin.resolve.mockResolvedValue({
      status: VinResolutionStatus.MULTIPLE_MATCHES,
      normalizedVin: 'JTDBU4EE9B9123456',
      provider: 'nhtsa-vpic',
      decoded: { make: 'Toyota', model: 'Corolla', modelYear: 2010 },
      warnings: ['Verify decoder evidence.'],
      candidateCount: 2,
      matchedFields: ['make', 'model', 'modelYear'],
      missingForExactMatch: ['engine', 'transmission'],
      candidates: [configuration, { ...configuration, id: 'other-id' }],
    });

    const result = await service.resolve({
      identifier: 'JTDBU4EE9B9123456',
      identifierType: VehicleIdentificationMethod.VIN,
    });

    expect(result.status).toBe(
      VehicleIdentifierResolutionStatus.MULTIPLE_MATCHES,
    );
    expect(result.resolutionSource).toBe(
      VehicleIdentifierResolutionSource.VIN_PROVIDER,
    );
    expect(result.candidateCount).toBe(2);
    expect(result.decoded).toEqual({
      make: 'Toyota',
      model: 'Corolla',
      modelYear: 2010,
    });
    expect(result.warnings).toEqual(['Verify decoder evidence.']);
    const auditMetadata = auditLog.create.mock.calls[0]?.[0]?.data?.metadata;
    expect(auditMetadata).not.toHaveProperty('decoded');
    expect(auditMetadata).not.toHaveProperty('warnings');
  });

  it('uses a verified VIN mapping before the external decoder', async () => {
    vehicleIdentifierMapping.findFirst.mockResolvedValue({
      vehicleConfigurationId: configurationId,
      provider: 'verified-source',
    });
    const result = await service.resolve({ identifier: 'JTDBU4EE9B9123456' });

    expect(result.status).toBe(VehicleIdentifierResolutionStatus.EXACT_MATCH);
    expect(result.resolutionSource).toBe(
      VehicleIdentifierResolutionSource.VERIFIED_MAPPING,
    );
    expect(result.decoded).toBeUndefined();
    expect(vin.resolve).not.toHaveBeenCalled();
  });

  it('forwards warnings together with supplied VIN decoder output', async () => {
    const decoded = { make: 'Toyota', model: 'Corolla', modelYear: 2010 };
    const warnings = ['Verify decoder evidence.'];
    vin.resolve.mockResolvedValue({
      status: VinResolutionStatus.PARTIAL_MATCH,
      normalizedVin: 'JTDBU4EE9B9123456',
      provider: 'nhtsa-vpic',
      decoded,
      warnings,
      candidateCount: 1,
      matchedFields: ['make', 'model', 'modelYear'],
      missingForExactMatch: ['engine', 'transmission'],
      candidates: [configuration],
    });

    const result = await service.resolve({
      identifier: 'JTDBU4EE9B9123456',
      provider: 'nhtsa-vpic',
      decoded,
      warnings,
    });

    expect(vin.resolve).toHaveBeenCalledWith({
      vin: 'JTDBU4EE9B9123456',
      provider: 'nhtsa-vpic',
      decoded,
      warnings,
    });
    expect(result.status).toBe(VehicleIdentifierResolutionStatus.PARTIAL_MATCH);
    expect(result.warnings).toEqual(warnings);
  });

  it('creates a normalized Draft mapping and records immutable audit evidence', async () => {
    const record = {
      id: mappingId,
      identifierType: VehicleIdentificationMethod.CHASSIS,
      rawIdentifier: 'NZE121-0123456',
      normalizedIdentifier: 'NZE1210123456',
      vehicleConfigurationId: configurationId,
      provider: 'approved-jdm-source',
      sourceReference: 'catalog-row-42',
      verificationState: ProvenanceVerificationState.UNVERIFIED,
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    vehicleIdentifierMapping.create.mockResolvedValue(record);

    const result = await service.createMapping(
      {
        identifierType: VehicleIdentificationMethod.CHASSIS,
        rawIdentifier: 'NZE121-0123456',
        vehicleConfigurationId: configurationId,
        provider: 'approved-jdm-source',
        sourceReference: 'catalog-row-42',
      },
      actorId,
    );

    expect(vehicleIdentifierMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identifierType: VehicleIdentificationMethod.CHASSIS,
          normalizedIdentifier: 'NZE1210123456',
          vehicleConfigurationId: configurationId,
          verificationState: ProvenanceVerificationState.UNVERIFIED,
          status: MasterDataStatus.DRAFT,
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VEHICLE_IDENTIFIER_MAPPING_CREATED',
          entityType: 'VehicleIdentifierMapping',
          entityId: mappingId,
        }),
      }),
    );
    expect(result).toEqual(record);
  });

  it('does not allow an unverified mapping to become Active', async () => {
    await expect(
      service.createMapping(
        {
          identifierType: VehicleIdentificationMethod.FRAME,
          rawIdentifier: 'KDH200-0012345',
          vehicleConfigurationId: configurationId,
          verificationState: ProvenanceVerificationState.REVIEWED,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_IDENTIFIER_MAPPING_NOT_VERIFIED' },
    });

    expect(vehicleIdentifierMapping.create).not.toHaveBeenCalled();
  });
});
