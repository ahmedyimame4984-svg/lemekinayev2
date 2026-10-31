import {
  MasterDataStatus,
  ProvenanceVerificationState,
  VehicleProductionEndStatus,
  VehicleSteeringSide,
} from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import type { DatabaseService } from '../database/database.service.js';
import {
  type CreateVehicleConfigurationDto,
  VehicleConfigurationAdminSortBy,
} from './dto/vehicle-configuration.dto.js';
import { vehicleConfigurationIdentityCode } from './vehicle-configuration-identity.js';
import { VehicleConfigurationService } from './vehicle-configuration.service.js';

describe('VehicleConfigurationService', () => {
  const vehicleMake = {
    findUnique: vi.fn(),
  };
  const vehicleModel = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const vehicleModelDerivative = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleGeneration = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleTrim = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleEngine = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleTransmission = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleBodyType = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleMarket = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleConfiguration = {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehicleIdentifierMapping = {
    findFirst: vi.fn(),
  };
  const masterDataProvenance = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const adminImportJob = { create: vi.fn() };

  const transaction = {
    vehicleMake,
    vehicleModel,
    vehicleModelDerivative,
    vehicleGeneration,
    vehicleTrim,
    vehicleEngine,
    vehicleTransmission,
    vehicleBodyType,
    vehicleMarket,
    vehicleConfiguration,
    vehicleIdentifierMapping,
    masterDataProvenance,
    auditLog,
    adminImportJob,
  };
  const database = {
    ...transaction,
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  const service = new VehicleConfigurationService(
    database as unknown as DatabaseService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const makeId = '11111111-1111-4111-8111-111111111111';
  const modelId = '22222222-2222-4222-8222-222222222222';
  const derivativeId = '2ddddddd-2222-4222-8222-222222222222';
  const generationId = '33333333-3333-4333-8333-333333333333';
  const trimId = '44444444-4444-4444-8444-444444444444';
  const engineId = '55555555-5555-4555-8555-555555555555';
  const transmissionId = '66666666-6666-4666-8666-666666666666';
  const bodyTypeId = '77777777-7777-4777-8777-777777777777';
  const marketId = '88888888-8888-4888-8888-888888888888';
  const configurationId = '99999999-9999-4999-8999-999999999999';
  const configurationIdentityCode =
    vehicleConfigurationIdentityCode(configurationId);
  const now = new Date('2026-09-27T22:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.create.mockResolvedValue({});
    adminImportJob.create.mockResolvedValue({});
    vehicleMake.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    vehicleModel.findUnique.mockResolvedValue({
      makeId,
      status: MasterDataStatus.ACTIVE,
    });
    vehicleModelDerivative.findUnique.mockResolvedValue({
      id: derivativeId,
      modelId,
      status: MasterDataStatus.ACTIVE,
    });
    vehicleGeneration.findUnique.mockResolvedValue({
      modelId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2006,
      endYear: 2013,
      endStatus: VehicleProductionEndStatus.ENDED,
    });
    vehicleTrim.findUnique.mockResolvedValue({
      generationId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2008,
      endYear: 2013,
    });
    vehicleEngine.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
      startYear: 2006,
      endYear: 2014,
    });
    vehicleTransmission.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
      startYear: 2008,
      endYear: 2014,
    });
    vehicleConfiguration.findMany.mockResolvedValue([]);
    vehicleIdentifierMapping.findFirst.mockResolvedValue(null);
    vehicleBodyType.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    vehicleMarket.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
  });

  it('summarizes configured vehicles without loading the configuration library', async () => {
    vehicleConfiguration.groupBy.mockResolvedValue([
      { status: MasterDataStatus.DRAFT, _count: { _all: 12 } },
      { status: MasterDataStatus.ACTIVE, _count: { _all: 80 } },
      { status: MasterDataStatus.INACTIVE, _count: { _all: 5 } },
      { status: MasterDataStatus.ARCHIVED, _count: { _all: 3 } },
    ]);

    await expect(service.getAdminConfigurationSummary()).resolves.toEqual({
      total: 100,
      active: 80,
      draft: 12,
    });

    expect(vehicleConfiguration.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    expect(vehicleConfiguration.findMany).not.toHaveBeenCalled();
  });

  it('pages hierarchy Vehicle masters with parent filters and search', async () => {
    const derivative = {
      id: derivativeId,
      modelId,
      code: 'SALOON',
      name: 'Saloon',
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    vehicleModelDerivative.count.mockResolvedValue(52);
    vehicleModelDerivative.findMany.mockResolvedValue([derivative]);

    await expect(
      service.listAdminDerivativesPage({
        modelId,
        status: MasterDataStatus.ACTIVE,
        search: 'sal',
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [derivative],
      total: 52,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });
    expect(vehicleModelDerivative.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          modelId,
          status: MasterDataStatus.ACTIVE,
        }),
        skip: 25,
        take: 25,
      }),
    );

    vehicleGeneration.count.mockResolvedValue(9);
    vehicleGeneration.findMany.mockResolvedValue([]);
    await service.listAdminGenerationsPage({
      modelId,
      derivativeId,
      search: 'e14',
      page: 1,
      pageSize: 50,
    });
    expect(vehicleGeneration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ modelId, derivativeId }),
        skip: 0,
        take: 50,
      }),
    );

    vehicleTrim.count.mockResolvedValue(4);
    vehicleTrim.findMany.mockResolvedValue([]);
    await service.listAdminTrimsPage({
      generationId,
      search: 'gli',
      page: 1,
      pageSize: 50,
    });
    expect(vehicleTrim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ generationId }),
        skip: 0,
        take: 50,
      }),
    );
  });

  it('pages Engine masters with server-side technical search', async () => {
    const engine = {
      id: engineId,
      code: '2ZR-FE',
      name: '2ZR-FE 1.8L',
      family: 'ZR',
      displacementCc: 1798,
      fuelType: 'PETROL',
      cylinderCount: 4,
      aspiration: 'NATURALLY_ASPIRATED',
      powerKw: 100,
      torqueNm: 175,
      startYear: 2006,
      endYear: 2019,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    vehicleEngine.count.mockResolvedValue(73);
    vehicleEngine.findMany.mockResolvedValue([engine]);

    await expect(
      service.listAdminEnginesPage({
        status: MasterDataStatus.ACTIVE,
        search: '2zr',
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      total: 73,
      page: 2,
      pageSize: 25,
      pageCount: 3,
      items: [engine],
    });

    expect(vehicleEngine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('pages Transmission masters and loads technical masters directly', async () => {
    const transmission = {
      id: transmissionId,
      code: 'U341E',
      transmissionType: 'AUTOMATIC',
      gearCount: 4,
      driveType: 'FWD',
      startYear: 2006,
      endYear: 2013,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    vehicleTransmission.count.mockResolvedValue(18);
    vehicleTransmission.findMany.mockResolvedValue([transmission]);
    vehicleTransmission.findUnique.mockResolvedValueOnce(transmission);

    await expect(
      service.listAdminTransmissionsPage({
        search: 'auto',
        page: 1,
        pageSize: 50,
      }),
    ).resolves.toMatchObject({
      total: 18,
      page: 1,
      pageSize: 50,
      pageCount: 1,
      items: [transmission],
    });
    await expect(
      service.getAdminTransmission(transmissionId),
    ).resolves.toEqual(transmission);
  });

  it('pages named technical masters without loading entire libraries', async () => {
    const body = {
      id: bodyTypeId,
      code: 'SEDAN',
      name: 'Sedan',
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    vehicleBodyType.count.mockResolvedValue(12);
    vehicleBodyType.findMany.mockResolvedValue([body]);

    await expect(
      service.listAdminBodyTypesPage({
        search: 'sed',
        page: 1,
        pageSize: 50,
      }),
    ).resolves.toEqual({
      items: [body],
      total: 12,
      page: 1,
      pageSize: 50,
      pageCount: 1,
    });
  });

  it('loads hierarchy records directly for deep-linked Admin workflows', async () => {
    const derivative = {
      id: derivativeId,
      modelId,
      code: 'SALOON',
      name: 'Saloon',
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const generation = {
      id: generationId,
      modelId,
      derivativeId,
      code: 'E140',
      name: 'E140',
      startYear: 2006,
      endYear: 2013,
      endStatus: VehicleProductionEndStatus.ENDED,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const trim = {
      id: trimId,
      generationId,
      code: 'GLI',
      name: 'GLI',
      equipmentLevel: 'GLI',
      startYear: 2008,
      endYear: 2013,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const configuration = {
      id: configurationId,
      identityCode: configurationIdentityCode,
      code: 'TOYOTA_COROLLA_E140_GLI',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2008,
      productionStartMonth: null,
      productionEndYear: 2013,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    vehicleModelDerivative.findUnique.mockResolvedValueOnce(derivative);
    vehicleGeneration.findUnique.mockResolvedValueOnce(generation);
    vehicleTrim.findUnique.mockResolvedValueOnce(trim);
    vehicleConfiguration.findUnique.mockResolvedValueOnce(configuration);

    await expect(service.getAdminDerivative(derivativeId)).resolves.toEqual(
      derivative,
    );
    await expect(service.getAdminGeneration(generationId)).resolves.toEqual(
      generation,
    );
    await expect(service.getAdminTrim(trimId)).resolves.toEqual(trim);
    await expect(
      service.getAdminConfiguration(configurationId),
    ).resolves.toEqual(configuration);
  });

  it('uses canonical hierarchy ordering by default for the Configured Vehicle library', async () => {
    vehicleConfiguration.count.mockResolvedValue(0);
    vehicleConfiguration.findMany.mockResolvedValue([]);

    await service.listAdminConfigurationLibraryPage({
      page: 1,
      pageSize: 25,
    });

    expect(vehicleConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { make: { name: 'asc' } },
          { model: { name: 'asc' } },
          { generation: { startYear: 'asc' } },
          { generation: { name: 'asc' } },
          { trim: { name: 'asc' } },
          { productionStartYear: 'asc' },
          { productionStartMonth: 'asc' },
          { identityCode: 'asc' },
          { id: 'asc' },
        ],
      }),
    );
  });

  it('filters the Configured Vehicle library by exact canonical id for deep links', async () => {
    vehicleConfiguration.count.mockResolvedValue(0);
    vehicleConfiguration.findMany.mockResolvedValue([]);

    await service.listAdminConfigurationLibraryPage({
      configurationId,
      page: 1,
      pageSize: 25,
    });

    expect(vehicleConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: configurationId,
        }),
      }),
    );
  });

  it('pages resolved Configured Vehicles with server-side identity search', async () => {
    const resolved = {
      id: configurationId,
      identityCode: configurationIdentityCode,
      code: 'TOYOTA_COROLLA_E140_GLI',
      modelYear: 2010,
      productionStartYear: 2008,
      productionStartMonth: null,
      productionEndYear: 2013,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      make: { id: makeId, code: 'TOYOTA', name: 'Toyota' },
      model: { id: modelId, code: 'COROLLA', name: 'Corolla' },
      generation: {
        id: generationId,
        code: 'E140',
        name: 'E140',
        startYear: 2006,
        endYear: 2013,
        endStatus: VehicleProductionEndStatus.ENDED,
        derivative: {
          id: derivativeId,
          code: 'SALOON',
          name: 'Saloon',
        },
      },
      trim: {
        id: trimId,
        code: 'GLI',
        name: 'GLI',
        equipmentLevel: 'GLI',
        startYear: 2008,
        endYear: 2013,
      },
      engine: {
        id: engineId,
        code: '2ZR_FE',
        name: '2ZR-FE',
        family: 'ZR',
        displacementCc: 1798,
        fuelType: 'Petrol',
        cylinderCount: 4,
        aspiration: 'Naturally aspirated',
        powerKw: 100,
        torqueNm: 175,
      },
      transmission: {
        id: transmissionId,
        code: 'U341E',
        transmissionType: 'AUTOMATIC',
        gearCount: 4,
        driveType: 'FWD',
      },
      bodyType: { id: bodyTypeId, code: 'SEDAN', name: 'Sedan' },
      market: { id: marketId, code: 'ETHIOPIA', name: 'Ethiopia' },
    };

    vehicleConfiguration.count.mockResolvedValue(26);
    vehicleConfiguration.findMany.mockResolvedValue([resolved]);

    const page = await service.listAdminConfigurationLibraryPage({
      makeId,
      status: MasterDataStatus.ACTIVE,
      search: 'corolla',
      sortBy: VehicleConfigurationAdminSortBy.MAKE,
      sortDirection: AdminSortDirection.DESC,
      page: 2,
      pageSize: 25,
    });

    expect(page).toMatchObject({
      total: 26,
      page: 2,
      pageSize: 25,
      pageCount: 2,
      items: [
        {
          id: configurationId,
          identityCode: configurationIdentityCode,
          derivative: { id: derivativeId, name: 'Saloon' },
          generation: {
            id: generationId,
            name: 'E140',
            startYear: 2006,
            endYear: 2013,
          },
          trim: { id: trimId, name: 'GLI', startYear: 2008, endYear: 2013 },
        },
      ],
    });
    expect(vehicleConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          makeId,
          status: MasterDataStatus.ACTIVE,
          OR: expect.arrayContaining([
            {
              identityCode: {
                contains: 'corolla',
                mode: 'insensitive',
              },
            },
          ]),
        }),
        orderBy: [
          { make: { name: 'desc' } },
          { identityCode: 'asc' },
          { id: 'asc' },
        ],
        skip: 25,
        take: 25,
      }),
    );
  });

  it('creates a Corolla model derivative such as Saloon', async () => {
    vehicleModelDerivative.create.mockResolvedValue({
      id: derivativeId,
      modelId,
      code: 'SALOON',
      name: 'Saloon',
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.createDerivative(
      {
        modelId,
        code: 'SALOON',
        name: 'Saloon',
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      id: derivativeId,
      modelId,
      code: 'SALOON',
      name: 'Saloon',
    });
    expect(vehicleModelDerivative.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelId,
          code: 'SALOON',
          name: 'Saloon',
          createdById: actorId,
          updatedById: actorId,
        }),
      }),
    );
  });

  it('creates a generation directly under a model when no derivative exists', async () => {
    vehicleGeneration.create.mockResolvedValue({
      id: generationId,
      modelId,
      derivativeId: null,
      code: 'GEN1',
      name: 'Generation 1',
      startYear: 2022,
      endYear: null,
      endStatus: VehicleProductionEndStatus.UNKNOWN,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.createGeneration(
      {
        modelId,
        code: 'GEN1',
        name: 'Generation 1',
        startYear: 2022,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      modelId,
      derivativeId: null,
      code: 'GEN1',
    });
    expect(vehicleModelDerivative.findUnique).not.toHaveBeenCalled();
    expect(vehicleGeneration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelId,
          derivativeId: null,
          code: 'GEN1',
        }),
      }),
    );
  });

  it('requires ENDED generation semantics to include an end year', async () => {
    await expect(
      service.createGeneration(
        {
          modelId,
          code: 'ENDED_WITHOUT_YEAR',
          name: 'Ended without year',
          startYear: 2020,
          endStatus: VehicleProductionEndStatus.ENDED,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_GENERATION_END_YEAR_REQUIRED' },
    });
  });

  it('accepts an explicitly CURRENT generation with a verified start year', async () => {
    vehicleGeneration.create.mockResolvedValue({
      id: generationId,
      modelId,
      derivativeId: null,
      code: 'CURRENT_GEN',
      name: 'Current generation',
      startYear: 2023,
      endYear: null,
      endStatus: VehicleProductionEndStatus.CURRENT,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await service.createGeneration(
      {
        modelId,
        code: 'CURRENT_GEN',
        name: 'Current generation',
        startYear: 2023,
        endStatus: VehicleProductionEndStatus.CURRENT,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(vehicleGeneration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startYear: 2023,
          endYear: undefined,
          endStatus: VehicleProductionEndStatus.CURRENT,
        }),
      }),
    );
  });

  it('requires an active generation to have a verified start year', async () => {
    await expect(
      service.createGeneration(
        {
          modelId,
          code: 'NO_YEAR',
          name: 'Generation without year',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_GENERATION_START_YEAR_REQUIRED' },
    });

    expect(vehicleGeneration.create).not.toHaveBeenCalled();
  });

  it('rejects a generation when its derivative belongs to another model', async () => {
    vehicleModelDerivative.findUnique.mockResolvedValue({
      id: derivativeId,
      modelId: '00000000-0000-4000-8000-000000000000',
      status: MasterDataStatus.ACTIVE,
    });

    await expect(
      service.createGeneration(
        {
          modelId,
          derivativeId,
          code: 'E140',
          name: 'E140',
          startYear: 2006,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_DERIVATIVE_MODEL_MISMATCH' },
    });

    expect(vehicleGeneration.create).not.toHaveBeenCalled();
  });

  it('does not activate a generation under an inactive model', async () => {
    vehicleModel.findUnique.mockResolvedValue({
      id: modelId,
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.createGeneration(
        {
          modelId,
          code: 'E140',
          name: 'E140',
          startYear: 2006,
          endYear: 2013,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_MODEL_NOT_ACTIVE' },
    });

    expect(vehicleGeneration.create).not.toHaveBeenCalled();
  });

  it('rejects a trim production range outside its generation', async () => {
    await expect(
      service.createTrim(
        {
          generationId,
          code: 'GLI',
          name: 'GLI',
          startYear: 2004,
          endYear: 2013,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_TRIM_RANGE_OUTSIDE_GENERATION' },
    });

    expect(vehicleTrim.create).not.toHaveBeenCalled();
  });

  it('rejects new RHD configurations before master lookup or insertion', async () => {
    await expect(
      service.createConfiguration(
        {
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          steeringSide: VehicleSteeringSide.RHD,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ETHIOPIA_VEHICLE_LHD_REQUIRED' },
    });
    expect(vehicleMake.findUnique).not.toHaveBeenCalled();
    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('creates an exact active Corolla configuration from independent master references', async () => {
    vehicleConfiguration.create.mockResolvedValue({
      id: configurationId,
      identityCode: configurationIdentityCode,
      code: null,
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2009,
      productionStartMonth: null,
      productionEndYear: 2011,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.createConfiguration(
      {
        makeId,
        modelId,
        generationId,
        trimId,
        engineId,
        transmissionId,
        bodyTypeId,
        marketId,
        modelYear: 2010,
        productionStartYear: 2009,
        productionEndYear: 2011,
        steeringSide: VehicleSteeringSide.LHD,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      id: configurationId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      modelYear: 2010,
    });
    expect(vehicleConfiguration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        identityCode: expect.any(String),
        code: null,
        makeId,
        modelId,
        generationId,
        trimId,
        engineId,
        transmissionId,
        bodyTypeId,
        marketId,
        status: MasterDataStatus.ACTIVE,
        createdById: actorId,
        updatedById: actorId,
      }),
      select: expect.any(Object),
    });
    const createData = vehicleConfiguration.create.mock.calls[0]?.[0]?.data as {
      id: string;
      identityCode: string;
      code: string | null;
    };
    expect(createData.identityCode).toBe(
      vehicleConfigurationIdentityCode(createData.id),
    );
    expect(createData.code).toBeNull();
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VEHICLE_CONFIGURATION_CREATED',
          entityType: 'VehicleConfiguration',
          entityId: configurationId,
        }),
      }),
    );
  });

  it('rejects a configuration when the selected model belongs to another make', async () => {
    vehicleModel.findUnique.mockResolvedValue({
      makeId: '00000000-0000-4000-8000-000000000000',
      status: MasterDataStatus.ACTIVE,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'BAD_HIERARCHY',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_MODEL_MAKE_MISMATCH' },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('requires a generation whenever a trim is selected', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'TRIM_WITHOUT_GENERATION',
          makeId,
          modelId,
          trimId,
          engineId,
          transmissionId,
        } as CreateVehicleConfigurationDto,
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_TRIM_REQUIRES_GENERATION' },
    });
  });

  it('rejects a model year outside the selected generation production range', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'OUTSIDE_YEAR',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          modelYear: 2015,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_YEAR_OUTSIDE_GENERATION' },
    });
  });

  it('requires Active configured vehicles to have complete canonical dimensions', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'ACTIVE_WITHOUT_BODY',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          marketId,
          productionStartYear: 2009,
          productionEndYear: 2011,
          productionEndStatus: VehicleProductionEndStatus.ENDED,
          steeringSide: VehicleSteeringSide.LHD,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_BODY_TYPE_REQUIRED' },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects a configuration period outside the selected Engine range', async () => {
    vehicleEngine.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
      startYear: 2010,
      endYear: 2014,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'ENGINE_RANGE_MISMATCH',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          bodyTypeId,
          marketId,
          productionStartYear: 2009,
          productionEndYear: 2011,
          productionEndStatus: VehicleProductionEndStatus.ENDED,
          steeringSide: VehicleSteeringSide.LHD,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_RANGE_OUTSIDE_ENGINE' },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects overlapping duplicate canonical configuration identity', async () => {
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
        code: 'EXISTING_CONFIGURATION',
        modelYear: null,
        productionStartYear: 2009,
        productionStartMonth: null,
        productionEndYear: 2011,
        productionEndMonth: null,
        productionEndStatus: VehicleProductionEndStatus.ENDED,
      },
    ]);

    await expect(
      service.createConfiguration(
        {
          code: 'DUPLICATE_CONFIGURATION',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          bodyTypeId,
          marketId,
          modelYear: 2010,
          productionStartYear: 2009,
          productionEndYear: 2011,
          productionEndStatus: VehicleProductionEndStatus.ENDED,
          steeringSide: VehicleSteeringSide.LHD,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_IDENTITY_CONFLICT',
        details: {
          conflictingConfigurationCode: 'EXISTING_CONFIGURATION',
        },
      },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('allows the same canonical dimensions for non-overlapping exact model years', async () => {
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
        code: 'COROLLA_2008',
        modelYear: 2008,
        productionStartYear: 2008,
        productionStartMonth: null,
        productionEndYear: 2008,
        productionEndMonth: null,
        productionEndStatus: VehicleProductionEndStatus.ENDED,
      },
    ]);
    vehicleConfiguration.create.mockResolvedValue({
      id: configurationId,
      code: 'COROLLA_2010',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2010,
      productionStartMonth: null,
      productionEndYear: 2010,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'COROLLA_2010',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          bodyTypeId,
          marketId,
          modelYear: 2010,
          productionStartYear: 2010,
          productionEndYear: 2010,
          productionEndStatus: VehicleProductionEndStatus.ENDED,
          steeringSide: VehicleSteeringSide.LHD,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({ code: 'COROLLA_2010' });
  });

  it('requires active configured vehicles to have a verified production start year', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'ACTIVE_WITHOUT_PRODUCTION_START',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          modelYear: 2010,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_PRODUCTION_START_REQUIRED' },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects a configured-vehicle range outside the generation', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'RANGE_OUTSIDE_GENERATION',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          productionStartYear: 2005,
          productionEndYear: 2010,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_RANGE_OUTSIDE_GENERATION',
      },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects a configured-vehicle range outside the selected trim', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'RANGE_OUTSIDE_TRIM',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          productionStartYear: 2007,
          productionEndYear: 2010,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_CONFIGURATION_RANGE_OUTSIDE_TRIM' },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('keeps an exact model year inside its own configuration range', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'MODEL_YEAR_OUTSIDE_CONFIG_RANGE',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          modelYear: 2010,
          productionStartYear: 2011,
          productionEndYear: 2012,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_YEAR_OUTSIDE_CONFIGURATION_PRODUCTION',
      },
    });

    expect(vehicleConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects CURRENT configuration under an ended generation', async () => {
    vehicleGeneration.findUnique.mockResolvedValue({
      modelId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2002,
      endYear: 2007,
      endStatus: VehicleProductionEndStatus.ENDED,
    });
    vehicleTrim.findUnique.mockResolvedValue({
      generationId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2002,
      endYear: null,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'ENDED_PARENT_CURRENT_CHILD',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          productionStartYear: 2005,
          productionEndStatus: VehicleProductionEndStatus.CURRENT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_CURRENT_OUTSIDE_GENERATION',
      },
    });
  });

  it('rejects CURRENT configuration under an unknown-ended generation', async () => {
    vehicleGeneration.findUnique.mockResolvedValue({
      modelId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2023,
      endYear: null,
      endStatus: VehicleProductionEndStatus.UNKNOWN,
    });
    vehicleTrim.findUnique.mockResolvedValue({
      generationId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2023,
      endYear: null,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'UNKNOWN_PARENT_CURRENT_CHILD',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          productionStartYear: 2023,
          productionEndStatus: VehicleProductionEndStatus.CURRENT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_CURRENT_OUTSIDE_GENERATION',
      },
    });
  });

  it('rejects CURRENT configuration when the trim has a finite end year', async () => {
    vehicleGeneration.findUnique.mockResolvedValue({
      modelId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2022,
      endYear: null,
      endStatus: VehicleProductionEndStatus.CURRENT,
    });
    vehicleTrim.findUnique.mockResolvedValue({
      generationId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2022,
      endYear: 2025,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'ENDED_TRIM_CURRENT_CHILD',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          productionStartYear: 2024,
          productionEndStatus: VehicleProductionEndStatus.CURRENT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_CURRENT_OUTSIDE_TRIM',
      },
    });
  });

  it('supports an explicitly current open-ended production period', async () => {
    vehicleGeneration.findUnique.mockResolvedValue({
      modelId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2006,
      endYear: null,
      endStatus: VehicleProductionEndStatus.CURRENT,
    });
    vehicleTrim.findUnique.mockResolvedValue({
      generationId,
      status: MasterDataStatus.ACTIVE,
      startYear: 2008,
      endYear: null,
    });
    vehicleEngine.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
      startYear: 2006,
      endYear: null,
    });
    vehicleTransmission.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
      startYear: 2008,
      endYear: null,
    });
    vehicleConfiguration.create.mockResolvedValue({
      id: configurationId,
      code: 'CURRENT_CONFIGURATION',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: null,
      productionStartYear: 2010,
      productionStartMonth: 6,
      productionEndYear: null,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.CURRENT,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await service.createConfiguration(
      {
        code: 'CURRENT_CONFIGURATION',
        makeId,
        modelId,
        generationId,
        trimId,
        engineId,
        transmissionId,
        bodyTypeId,
        marketId,
        productionStartYear: 2010,
        productionStartMonth: 6,
        productionEndStatus: VehicleProductionEndStatus.CURRENT,
        steeringSide: VehicleSteeringSide.LHD,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(vehicleConfiguration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productionStartYear: 2010,
          productionStartMonth: 6,
          productionEndYear: null,
          productionEndStatus: VehicleProductionEndStatus.CURRENT,
        }),
      }),
    );
  });

  it('does not allow an unknown or current period to carry a production end date', async () => {
    await expect(
      service.createConfiguration(
        {
          code: 'AMBIGUOUS_OPEN_END',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          productionStartYear: 2010,
          productionEndYear: 2011,
          productionEndStatus: VehicleProductionEndStatus.UNKNOWN,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_OPEN_END_CANNOT_HAVE_END_DATE',
      },
    });
  });

  it('validates a Draft configuration against the real Active lifecycle rules without writing', async () => {
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      code: 'TOYOTA_COROLLA_E140_GLI_2ZR_AT',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2009,
      productionStartMonth: null,
      productionEndYear: 2011,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.DRAFT,
      version: 4,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.validateConfigurationActivation(configurationId),
    ).resolves.toEqual({
      configurationId,
      version: 4,
      valid: true,
      message: 'Configured vehicle is ready for activation.',
    });

    expect(vehicleConfiguration.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
    expect(vehicleEngine.findUnique).toHaveBeenCalled();
    expect(vehicleTransmission.findUnique).toHaveBeenCalled();
  });

  it('fails activation validation when a referenced master is not Active', async () => {
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      code: 'TOYOTA_COROLLA_E140_GLI_2ZR_AT',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2009,
      productionStartMonth: null,
      productionEndYear: 2011,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.DRAFT,
      version: 4,
      createdAt: now,
      updatedAt: now,
    });
    vehicleEngine.findUnique.mockResolvedValue({
      status: MasterDataStatus.INACTIVE,
      startYear: 2006,
      endYear: 2014,
    });

    await expect(
      service.validateConfigurationActivation(configurationId),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_ENGINE_NOT_ACTIVE' },
    });

    expect(vehicleConfiguration.update).not.toHaveBeenCalled();
  });

  it('does not validate an incomplete configured vehicle for activation', async () => {
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      code: 'INCOMPLETE_CONFIGURATION',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId: null,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2009,
      productionStartMonth: null,
      productionEndYear: 2011,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.DRAFT,
      version: 2,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.validateConfigurationActivation(configurationId),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_CONFIGURATION_ENGINE_REQUIRED',
      },
    });

    expect(vehicleConfiguration.update).not.toHaveBeenCalled();
  });

  it('does not activate a configuration with an inactive engine', async () => {
    vehicleEngine.findUnique.mockResolvedValue({
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.createConfiguration(
        {
          code: 'INACTIVE_ENGINE',
          makeId,
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          bodyTypeId,
          marketId,
          modelYear: 2010,
          productionStartYear: 2009,
          productionEndYear: 2011,
          productionEndStatus: VehicleProductionEndStatus.ENDED,
          steeringSide: VehicleSteeringSide.LHD,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'VEHICLE_ENGINE_NOT_ACTIVE' },
    });
  });

  it('blocks narrowing an Engine year range across an Active configured vehicle', async () => {
    vehicleEngine.findUnique.mockResolvedValue({
      id: engineId,
      code: '2ZR-FE',
      name: '2ZR-FE 1.8L',
      family: 'ZR',
      displacementCc: 1798,
      fuelType: 'PETROL',
      cylinderCount: 4,
      aspiration: 'NATURALLY_ASPIRATED',
      powerKw: null,
      torqueNm: null,
      startYear: 2006,
      endYear: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: configurationId,
        modelYear: 2010,
        productionStartYear: 2009,
        productionStartMonth: null,
        productionEndYear: 2011,
        productionEndMonth: null,
        productionEndStatus: VehicleProductionEndStatus.ENDED,
      },
    ]);

    await expect(
      service.updateEngine(
        engineId,
        {
          version: 1,
          startYear: 2010,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'VEHICLE_ENGINE_RANGE_CONFLICTS_WITH_ACTIVE_CONFIGURATION',
        details: { configurationId },
      },
    });

    expect(vehicleEngine.update).not.toHaveBeenCalled();
  });

  it('does not let Engine editing bypass lifecycle governance', async () => {
    vehicleEngine.findUnique.mockResolvedValue({
      id: engineId,
      code: '2ZR-FE',
      name: '2ZR-FE 1.8L',
      family: 'ZR',
      displacementCc: 1798,
      fuelType: 'PETROL',
      cylinderCount: 4,
      aspiration: 'NATURALLY_ASPIRATED',
      powerKw: null,
      torqueNm: null,
      startYear: 2006,
      endYear: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.updateEngine(
        engineId,
        {
          version: 1,
          status: MasterDataStatus.INACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(vehicleConfiguration.findFirst).not.toHaveBeenCalled();
    expect(vehicleEngine.update).not.toHaveBeenCalled();
  });

  it('routes configured-vehicle retirement through the governed lifecycle endpoint', async () => {
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      identityCode: configurationIdentityCode,
      code: 'TOYOTA_COROLLA_E140_GLI_2ZR_AT',
      makeId,
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      bodyTypeId,
      marketId,
      modelYear: 2010,
      productionStartYear: 2009,
      productionStartMonth: null,
      productionEndYear: 2011,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 4,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.updateConfiguration(
        configurationId,
        {
          version: 4,
          status: MasterDataStatus.DEPRECATED,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED',
      },
    });

    expect(vehicleIdentifierMapping.findFirst).not.toHaveBeenCalled();
    expect(vehicleConfiguration.update).not.toHaveBeenCalled();
  });

  it('returns the optional model derivative in resolved configuration detail', async () => {
    vehicleConfiguration.findFirst.mockResolvedValue({
      id: configurationId,
      identityCode: configurationIdentityCode,
      code: 'TOYOTA_COROLLA_SALOON_E140_GLI_2ZRFE_MT',
      modelYear: 2010,
      productionStartYear: 2009,
      productionStartMonth: null,
      productionEndYear: 2011,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.ENDED,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      make: { id: makeId, code: 'TOYOTA', name: 'Toyota' },
      model: { id: modelId, code: 'COROLLA', name: 'Corolla' },
      generation: {
        id: generationId,
        code: 'E140',
        name: 'E140',
        derivative: {
          id: derivativeId,
          code: 'SALOON',
          name: 'Saloon',
        },
      },
      trim: {
        id: trimId,
        code: 'GLI',
        name: 'GLI',
        equipmentLevel: null,
      },
      engine: {
        id: engineId,
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
        id: transmissionId,
        code: 'MT',
        transmissionType: 'MANUAL',
        gearCount: 5,
        driveType: 'FWD',
      },
      bodyType: { id: bodyTypeId, code: 'SEDAN', name: 'Sedan' },
      market: { id: marketId, code: 'ETHIOPIA', name: 'Ethiopia' },
    });

    const result = await service.getPublishedConfiguration(configurationId);

    expect(result).not.toHaveProperty('identityCode');
    expect(result.derivative).toEqual({
      id: derivativeId,
      code: 'SALOON',
      name: 'Saloon',
    });
    expect(result.generation).toEqual({
      id: generationId,
      code: 'E140',
      name: 'E140',
    });
  });

  it('returns null derivative for configured vehicles whose generation belongs directly to the model', async () => {
    vehicleConfiguration.findFirst.mockResolvedValue({
      id: configurationId,
      identityCode: configurationIdentityCode,
      code: 'TOYOTA_BZ4X_GEN1_AWD',
      modelYear: 2023,
      productionStartYear: 2022,
      productionStartMonth: null,
      productionEndYear: null,
      productionEndMonth: null,
      productionEndStatus: VehicleProductionEndStatus.CURRENT,
      steeringSide: VehicleSteeringSide.LHD,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      make: { id: makeId, code: 'TOYOTA', name: 'Toyota' },
      model: { id: modelId, code: 'BZ4X', name: 'bZ4X' },
      generation: {
        id: generationId,
        code: 'GEN1',
        name: 'Generation 1',
        derivative: null,
      },
      trim: {
        id: trimId,
        code: 'AWD',
        name: 'AWD',
        equipmentLevel: null,
      },
      engine: {
        id: engineId,
        code: 'EV',
        name: 'Electric motor',
        family: null,
        displacementCc: null,
        fuelType: 'ELECTRIC',
        cylinderCount: null,
        aspiration: null,
        powerKw: null,
        torqueNm: null,
      },
      transmission: {
        id: transmissionId,
        code: 'EV_DRIVE',
        transmissionType: 'Single-speed',
        gearCount: 1,
        driveType: 'AWD',
      },
      bodyType: null,
      market: null,
    });

    const result = await service.getPublishedConfiguration(configurationId);

    expect(result.derivative).toBeNull();
    expect(result.generation.name).toBe('Generation 1');
  });

  it('adaptively filters Garage candidates by year before asking the next distinguishing field', async () => {
    vehicleModel.findFirst.mockResolvedValue({ id: modelId });
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: configurationId,
        code: 'COROLLA_16_MT',
        modelYear: null,
        productionStartYear: 2005,
        productionStartMonth: null,
        productionEndYear: 2007,
        productionEndMonth: null,
        productionEndStatus: VehicleProductionEndStatus.ENDED,
        steeringSide: VehicleSteeringSide.LHD,
        status: MasterDataStatus.ACTIVE,
        version: 1,
        createdAt: now,
        updatedAt: now,
        make: { id: makeId, code: 'TOYOTA', name: 'Toyota' },
        model: { id: modelId, code: 'COROLLA', name: 'Corolla' },
        generation: {
          id: generationId,
          code: 'E120',
          name: 'E120',
          derivative: null,
        },
        trim: { id: trimId, code: 'GLI', name: 'GLI', equipmentLevel: null },
        engine: {
          id: engineId,
          code: '3ZZ-FE',
          name: '1.6 VVT-i',
          family: null,
          displacementCc: 1598,
          fuelType: 'PETROL',
          cylinderCount: 4,
          aspiration: null,
          powerKw: 81,
          torqueNm: null,
        },
        transmission: {
          id: transmissionId,
          code: 'MT',
          transmissionType: 'MANUAL',
          gearCount: 5,
          driveType: 'FWD',
        },
        bodyType: { id: bodyTypeId, code: 'SEDAN', name: 'Sedan' },
        market: { id: marketId, code: 'ETHIOPIA', name: 'Ethiopia' },
      },
    ]);

    const result = await service.resolveSelector({ modelId, year: 2006 });

    expect(result.matchCount).toBe(1);
    expect(result.resolvedConfigurationId).toBe(configurationId);
    expect(result.nextDimension).toBeNull();
    expect(vehicleConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          modelId,
          status: MasterDataStatus.ACTIVE,
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('lists only ACTIVE configurations for public resolution filters without exposing internal identity', async () => {
    vehicleModel.findFirst.mockResolvedValue({ id: modelId });
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: configurationId,
        identityCode: configurationIdentityCode,
        code: null,
        makeId,
        modelId,
        generationId,
        trimId,
        engineId,
        transmissionId,
        bodyTypeId,
        marketId,
        modelYear: 2010,
        productionStartYear: 2009,
        productionStartMonth: null,
        productionEndYear: 2011,
        productionEndMonth: null,
        productionEndStatus: VehicleProductionEndStatus.ENDED,
        steeringSide: VehicleSteeringSide.LHD,
        status: MasterDataStatus.ACTIVE,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await service.listPublishedConfigurations({
      modelId,
      generationId,
      trimId,
      engineId,
      transmissionId,
      modelYear: 2010,
      steeringSide: VehicleSteeringSide.LHD,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('identityCode');
    expect(result[0]?.code).toBeNull();

    expect(vehicleConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          modelId,
          generationId,
          trimId,
          engineId,
          transmissionId,
          modelYear: 2010,
          steeringSide: VehicleSteeringSide.LHD,
          status: MasterDataStatus.ACTIVE,
        }),
      }),
    );
  });

  it('lists provenance only for an existing configured vehicle', async () => {
    vehicleConfiguration.findUnique.mockResolvedValue({ id: configurationId });
    masterDataProvenance.findMany.mockResolvedValue([
      {
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        entityType: 'VehicleConfiguration',
        entityId: configurationId,
        sourceName: 'Toyota EPC',
        sourceReference: 'E140-2008',
        sourceUrl: null,
        observedAt: new Date('2026-10-01T00:00:00.000Z'),
        verificationState: ProvenanceVerificationState.VERIFIED,
        notes: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await service.listConfigurationProvenance(configurationId);

    expect(result).toHaveLength(1);
    expect(result[0]?.sourceName).toBe('Toyota EPC');
    expect(masterDataProvenance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: 'VehicleConfiguration',
          entityId: configurationId,
        },
      }),
    );
  });

  it('creates configured-vehicle provenance and records an audit event', async () => {
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      code: 'TOYOTA_COROLLA_E140',
    });
    masterDataProvenance.create.mockResolvedValue({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      entityType: 'VehicleConfiguration',
      entityId: configurationId,
      sourceName: 'Toyota EPC',
      sourceReference: 'E140-2008',
      sourceUrl: 'https://example.com/toyota-epc',
      observedAt: new Date('2026-10-01T00:00:00.000Z'),
      verificationState: ProvenanceVerificationState.VERIFIED,
      notes: 'Checked against manufacturer catalog.',
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.createConfigurationProvenance(
      configurationId,
      {
        sourceName: ' Toyota EPC ',
        sourceReference: 'E140-2008',
        sourceUrl: 'https://example.com/toyota-epc',
        observedAt: '2026-10-01T00:00:00.000Z',
        verificationState: ProvenanceVerificationState.VERIFIED,
        notes: 'Checked against manufacturer catalog.',
      },
      actorId,
    );

    expect(result.verificationState).toBe(
      ProvenanceVerificationState.VERIFIED,
    );
    expect(masterDataProvenance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'VehicleConfiguration',
          entityId: configurationId,
          sourceName: 'Toyota EPC',
          createdById: actorId,
          updatedById: actorId,
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MASTER_DATA_PROVENANCE_CREATED',
          entityType: 'MasterDataProvenance',
        }),
      }),
    );
  });

  it('updates provenance with optimistic version protection', async () => {
    const provenanceId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      code: 'TOYOTA_COROLLA_E140',
    });
    masterDataProvenance.findUnique.mockResolvedValue({
      id: provenanceId,
      entityType: 'VehicleConfiguration',
      entityId: configurationId,
      sourceName: 'Toyota EPC',
      sourceReference: null,
      sourceUrl: null,
      observedAt: null,
      verificationState: ProvenanceVerificationState.REVIEWED,
      notes: null,
      version: 2,
      createdAt: now,
      updatedAt: now,
    });
    masterDataProvenance.update.mockResolvedValue({
      id: provenanceId,
      entityType: 'VehicleConfiguration',
      entityId: configurationId,
      sourceName: 'Toyota EPC',
      sourceReference: null,
      sourceUrl: null,
      observedAt: null,
      verificationState: ProvenanceVerificationState.VERIFIED,
      notes: 'Verified.',
      version: 3,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.updateConfigurationProvenance(
      configurationId,
      provenanceId,
      {
        version: 2,
        verificationState: ProvenanceVerificationState.VERIFIED,
        notes: 'Verified.',
      },
      actorId,
    );

    expect(result.version).toBe(3);
    expect(masterDataProvenance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: provenanceId, version: 2 },
        data: expect.objectContaining({
          verificationState: ProvenanceVerificationState.VERIFIED,
          version: { increment: 1 },
          updatedById: actorId,
        }),
      }),
    );
  });

});
