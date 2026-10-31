import { MasterDataStatus, VehicleProductionEndStatus } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { VehicleConfigurationDetailResponseDto } from './dto/vehicle-configuration-detail.dto.js';
import { VinResolutionStatus } from './dto/vin.dto.js';
import type { VehicleConfigurationService } from './vehicle-configuration.service.js';
import type { NhtsaVinDecoderProvider } from './nhtsa-vin-decoder.provider.js';
import { VinService } from './vin.service.js';

describe('VinService', () => {
  const vehicleConfiguration = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const configurations = {
    getPublishedConfiguration: vi.fn(),
  };

  const database = {
    vehicleConfiguration,
  } as unknown as DatabaseService;

  const nhtsa = {
    name: 'nhtsa-vpic',
    decode: vi.fn(),
  };

  const service = new VinService(
    database,
    configurations as unknown as VehicleConfigurationService,
    nhtsa as unknown as NhtsaVinDecoderProvider,
  );

  const resolvedVehicle = {
    id: '00000000-0000-4000-8000-000000000010',
    code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_CVT_2010',
    modelYear: 2010,
    productionStartYear: 2009,
    productionEndYear: 2011,
    steeringSide: null,
    make: { id: 'm1', code: 'TOYOTA', name: 'Toyota' },
    model: { id: 'm2', code: 'COROLLA', name: 'Corolla' },
    derivative: { id: 'd1', code: 'SALOON', name: 'Saloon' },
    generation: { id: 'g1', code: 'E140', name: 'E140' },
    trim: { id: 't1', code: 'GLI', name: 'GLI', equipmentLevel: null },
    engine: {
      id: 'e1',
      code: '2ZR-FE',
      name: '2ZR-FE 1.8L',
      family: 'ZR',
      displacementCc: 1798,
      fuelType: 'PETROL',
      cylinderCount: 4,
      aspiration: 'NATURALLY_ASPIRATED',
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
    createdAt: new Date('2026-09-28T00:00:00.000Z'),
    updatedAt: new Date('2026-09-28T00:00:00.000Z'),
  } as unknown as VehicleConfigurationDetailResponseDto;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates and segments a standard VIN', () => {
    expect(service.validate(' jtdbu4ee9b9123456 ')).toEqual({
      valid: true,
      normalizedVin: 'JTDBU4EE9B9123456',
      errors: [],
      wmi: 'JTD',
      vds: 'BU4EE9',
      vis: 'B9123456',
    });
  });

  it('decodes through the configured provider and normalizes the response', async () => {
    nhtsa.decode.mockResolvedValue({
      provider: 'nhtsa-vpic',
      decoded: {
        make: ' TOYOTA ',
        model: ' Corolla ',
        modelYear: 2010,
        engine: ' 2ZR-FE ',
        transmission: ' CVT ',
      },
    });

    await expect(
      service.decode({ vin: 'JTDBU4EE9B9123456', modelYear: 2010 }),
    ).resolves.toEqual({
      provider: 'nhtsa-vpic',
      decoded: {
        make: 'TOYOTA',
        model: 'Corolla',
        derivative: undefined,
        generation: undefined,
        series: undefined,
        trim: undefined,
        modelYear: 2010,
        engine: '2ZR-FE',
        transmission: 'CVT',
        bodyType: undefined,
        market: undefined,
        steeringSide: undefined,
      },
      warnings: [],
    });
  });

  it('rejects invalid VIN characters before vehicle matching', async () => {
    const result = await service.resolve({
      vin: 'JTDBU4EE9I9123456',
      decoded: { make: 'Toyota', model: 'Corolla' },
    });

    expect(result.status).toBe(VinResolutionStatus.INVALID_VIN);
    expect(vehicleConfiguration.count).not.toHaveBeenCalled();
    expect(vehicleConfiguration.findMany).not.toHaveBeenCalled();
  });

  it('returns exact match only for a sufficiently specific single configuration', async () => {
    vehicleConfiguration.count.mockResolvedValue(1);
    vehicleConfiguration.findMany.mockResolvedValue([
      { id: resolvedVehicle.id },
    ]);
    configurations.getPublishedConfiguration.mockResolvedValue(resolvedVehicle);

    const result = await service.resolve({
      vin: 'JTDBU4EE9B9123456',
      provider: 'normalized-test-provider',
      decoded: {
        make: 'Toyota',
        model: 'Corolla',
        modelYear: 2010,
        engine: '2ZR-FE',
        transmission: 'CVT',
      },
    });

    expect(result.status).toBe(VinResolutionStatus.EXACT_MATCH);
    expect(result.candidateCount).toBe(1);
    expect(result.missingForExactMatch).toEqual([]);
    expect(result.candidates).toEqual([resolvedVehicle]);
    expect(vehicleConfiguration.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: MasterDataStatus.ACTIVE,
        OR: [
          { modelYear: 2010 },
          {
            modelYear: null,
            productionStartYear: { lte: 2010 },
            OR: [
              { productionEndYear: { gte: 2010 } },
              {
                productionEndYear: null,
                productionEndStatus: VehicleProductionEndStatus.CURRENT,
              },
            ],
          },
        ],
      }),
    });
  });

  it('uses an optional derivative to narrow Corolla VIN candidates', async () => {
    vehicleConfiguration.count.mockResolvedValue(1);
    vehicleConfiguration.findMany.mockResolvedValue([
      { id: resolvedVehicle.id },
    ]);
    configurations.getPublishedConfiguration.mockResolvedValue(resolvedVehicle);

    const result = await service.resolve({
      vin: 'JTDBU4EE9B9123456',
      decoded: {
        make: 'Toyota',
        model: 'Corolla',
        derivative: 'Saloon',
        generation: 'E140',
        modelYear: 2010,
        engine: '2ZR-FE',
        transmission: 'CVT',
      },
    });

    expect(result.status).toBe(VinResolutionStatus.EXACT_MATCH);
    expect(result.matchedFields).toContain('derivative');

    const countCall = vehicleConfiguration.count.mock.calls[0]?.[0] as {
      where?: {
        generation?: {
          derivative?: {
            OR?: unknown[];
          };
        };
      };
    };
    expect(countCall.where?.generation?.derivative?.OR).toEqual([
      {
        code: {
          equals: 'Saloon',
          mode: 'insensitive',
        },
      },
      {
        name: {
          equals: 'Saloon',
          mode: 'insensitive',
        },
      },
    ]);
  });

  it('does not require a derivative for a bZ4X-style direct generation', async () => {
    const bz4xVehicle = {
      ...resolvedVehicle,
      code: 'TOYOTA_BZ4X_GEN1_AWD_2023',
      modelYear: 2023,
      model: { id: 'm3', code: 'BZ4X', name: 'bZ4X' },
      derivative: null,
      generation: { id: 'g2', code: 'GEN1', name: 'Generation 1' },
      trim: { id: 't2', code: 'AWD', name: 'AWD', equipmentLevel: null },
      engine: {
        ...resolvedVehicle.engine,
        id: 'e2',
        code: 'EV',
        name: 'Electric motor',
      },
      transmission: {
        ...resolvedVehicle.transmission,
        id: 'tr2',
        code: 'EV_DRIVE',
        transmissionType: 'Single-speed',
      },
    } satisfies VehicleConfigurationDetailResponseDto;

    vehicleConfiguration.count.mockResolvedValue(1);
    vehicleConfiguration.findMany.mockResolvedValue([{ id: bz4xVehicle.id }]);
    configurations.getPublishedConfiguration.mockResolvedValue(bz4xVehicle);

    const result = await service.resolve({
      vin: 'JTDBU4EE9B9123456',
      decoded: {
        make: 'Toyota',
        model: 'bZ4X',
        generation: 'GEN1',
        modelYear: 2023,
        engine: 'EV',
        transmission: 'EV_DRIVE',
      },
    });

    expect(result.status).toBe(VinResolutionStatus.EXACT_MATCH);
    expect(result.missingForExactMatch).toEqual([]);
    expect(result.candidates[0]?.derivative).toBeNull();

    const countCall = vehicleConfiguration.count.mock.calls[0]?.[0] as {
      where?: {
        generation?: {
          derivative?: unknown;
        };
      };
    };
    expect(countCall.where?.generation?.derivative).toBeUndefined();
  });

  it('keeps a unique but underspecified result partial', async () => {
    vehicleConfiguration.count.mockResolvedValue(1);
    vehicleConfiguration.findMany.mockResolvedValue([
      { id: resolvedVehicle.id },
    ]);
    configurations.getPublishedConfiguration.mockResolvedValue(resolvedVehicle);

    const result = await service.resolve({
      vin: 'JTDBU4EE9B9123456',
      decoded: {
        make: 'Toyota',
        model: 'Corolla',
        modelYear: 2010,
      },
    });

    expect(result.status).toBe(VinResolutionStatus.PARTIAL_MATCH);
    expect(result.missingForExactMatch).toEqual(['engine', 'transmission']);
  });

  it('never auto-selects when multiple configured vehicles match', async () => {
    vehicleConfiguration.count.mockResolvedValue(2);
    vehicleConfiguration.findMany.mockResolvedValue([
      { id: resolvedVehicle.id },
      { id: '00000000-0000-4000-8000-000000000011' },
    ]);
    configurations.getPublishedConfiguration
      .mockResolvedValueOnce(resolvedVehicle)
      .mockResolvedValueOnce({
        ...resolvedVehicle,
        id: '00000000-0000-4000-8000-000000000011',
        code: 'TOYOTA_COROLLA_E140_GLI_2ZRFE_CVT_2010_ALT',
      });

    const result = await service.resolve({
      vin: 'JTDBU4EE9B9123456',
      decoded: {
        make: 'Toyota',
        model: 'Corolla',
        modelYear: 2010,
        engine: '2ZR-FE',
        transmission: 'CVT',
      },
    });

    expect(result.status).toBe(VinResolutionStatus.MULTIPLE_MATCHES);
    expect(result.candidateCount).toBe(2);
  });

  it('returns decoded evidence when no active library configuration matches', async () => {
    nhtsa.decode.mockResolvedValue({
      provider: 'nhtsa-vpic',
      decoded: { make: 'Toyota', model: 'Corolla', modelYear: 2010 },
    });
    vehicleConfiguration.count.mockResolvedValue(0);
    vehicleConfiguration.findMany.mockResolvedValue([]);
    const result = await service.resolve({ vin: 'JTDBU4EE9B9123456' });

    expect(result.status).toBe(VinResolutionStatus.NO_MATCH);
    expect(result.decoded).toMatchObject({
      make: 'Toyota',
      model: 'Corolla',
      modelYear: 2010,
    });
    expect(result.candidates).toEqual([]);
  });

  it('retains partial decoder output without fabricating missing fields or matching series as generation', async () => {
    nhtsa.decode.mockResolvedValue({
      provider: 'nhtsa-vpic',
      decoded: { make: 'Toyota', series: 'LE' },
      warnings: ['Verify decoder evidence.'],
    });
    const result = await service.resolve({ vin: 'JTDBU4EE9B9123456' });

    expect(result.status).toBe(VinResolutionStatus.PARTIAL_MATCH);
    expect(result.decoded).toMatchObject({ make: 'Toyota', series: 'LE' });
    expect(result.decoded?.generation).toBeUndefined();
    expect(result.matchedFields).toEqual(['make']);
    expect(result.warnings).toEqual(['Verify decoder evidence.']);
    expect(vehicleConfiguration.count).not.toHaveBeenCalled();
  });

  it('does not report an exact match when the provider reports uncertain data', async () => {
    nhtsa.decode.mockResolvedValue({
      provider: 'nhtsa-vpic',
      decoded: {
        make: 'Toyota',
        model: 'Corolla',
        modelYear: 2010,
        engine: '2ZR-FE',
        transmission: 'CVT',
      },
      warnings: ['Verify decoder evidence.'],
    });
    vehicleConfiguration.count.mockResolvedValue(1);
    vehicleConfiguration.findMany.mockResolvedValue([
      { id: resolvedVehicle.id },
    ]);
    configurations.getPublishedConfiguration.mockResolvedValue(resolvedVehicle);

    const result = await service.resolve({ vin: 'JTDBU4EE9B9123456' });
    expect(result.status).toBe(VinResolutionStatus.PARTIAL_MATCH);
    expect(result.missingForExactMatch).toEqual([]);
    expect(result.warnings).toEqual(['Verify decoder evidence.']);
  });

  it('names the attempted provider on a decode failure without returning made-up details', async () => {
    nhtsa.decode.mockRejectedValue(new Error('provider unreachable'));
    const result = await service.resolve({ vin: 'JTDBU4EE9B9123456' });
    expect(result.status).toBe(VinResolutionStatus.DECODE_FAILED);
    expect(result.provider).toBe('nhtsa-vpic');
    expect(result.decoded).toBeUndefined();
    expect(vehicleConfiguration.count).not.toHaveBeenCalled();
  });

  it('preserves warnings when resolving the output of a separate decode call', async () => {
    nhtsa.decode.mockResolvedValue({
      provider: 'nhtsa-vpic',
      decoded: {
        make: 'Toyota',
        model: 'Corolla',
        modelYear: 2010,
        engine: '2ZR-FE',
        transmission: 'CVT',
      },
      warnings: ['Verify decoder evidence.'],
    });
    vehicleConfiguration.count.mockResolvedValue(1);
    vehicleConfiguration.findMany.mockResolvedValue([
      { id: resolvedVehicle.id },
    ]);
    configurations.getPublishedConfiguration.mockResolvedValue(resolvedVehicle);

    const vin = 'JTDBU4EE9B9123456';
    const decoded = await service.decode({ vin });
    const result = await service.resolve({
      vin,
      provider: decoded.provider,
      decoded: decoded.decoded,
      warnings: decoded.warnings,
    });

    expect(result.status).toBe(VinResolutionStatus.PARTIAL_MATCH);
    expect(result.missingForExactMatch).toEqual([]);
    expect(result.warnings).toEqual(decoded.warnings);
    expect(result.candidates).toEqual([resolvedVehicle]);
    expect(nhtsa.decode).toHaveBeenCalledTimes(1);
  });
});
