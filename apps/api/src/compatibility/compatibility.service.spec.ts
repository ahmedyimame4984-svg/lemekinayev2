import {
  CompatibilityAxlePosition,
  CompatibilityCriterionType,
  CompatibilityFitmentType,
  CompatibilityInstallationPosition,
  CompatibilitySource,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  ProductStatus,
  VehicleSteeringSide,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { CompatibilityService } from './compatibility.service.js';

describe('CompatibilityService', () => {
  const product = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const vehicleConfiguration = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  };
  const vehicleMake = { findUnique: vi.fn() };
  const vehicleModel = { findUnique: vi.fn() };
  const vehicleGeneration = { findUnique: vi.fn() };
  const vehicleTrim = { findUnique: vi.fn() };
  const vehicleEngine = { findUnique: vi.fn() };
  const vehicleTransmission = { findUnique: vi.fn() };
  const vehicleBodyType = { findUnique: vi.fn() };
  const vehicleMarket = { findUnique: vi.fn() };
  const vehicleCompatibility = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productVehicleArticle = { upsert: vi.fn() };
  const vehicleCompatibilityCriterion = {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const auditLog = { create: vi.fn() };

  const transaction = {
    productVehicleArticle,
    vehicleCompatibility,
    vehicleCompatibilityCriterion,
    auditLog,
  };
  const database = {
    product,
    vehicleConfiguration,
    vehicleMake,
    vehicleModel,
    vehicleGeneration,
    vehicleTrim,
    vehicleEngine,
    vehicleTransmission,
    vehicleBodyType,
    vehicleMarket,
    vehicleCompatibility,
    vehicleCompatibilityCriterion,
    productVehicleArticle,
    auditLog,
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  const service = new CompatibilityService(
    database as unknown as DatabaseService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const productId = '11111111-1111-4111-8111-111111111111';
  const makeId = '22222222-2222-4222-8222-222222222222';
  const modelId = '33333333-3333-4333-8333-333333333333';
  const generationId = '44444444-4444-4444-8444-444444444444';
  const trimId = '55555555-5555-4555-8555-555555555555';
  const engineId = '66666666-6666-4666-8666-666666666666';
  const transmissionId = '77777777-7777-4777-8777-777777777777';
  const bodyTypeId = '88888888-8888-4888-8888-888888888888';
  const marketId = '99999999-9999-4999-8999-999999999999';
  const configurationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const compatibilityId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const now = new Date('2026-09-28T06:30:00.000Z');

  const configuration = {
    id: configurationId,
    makeId,
    modelId,
    generationId,
    trimId,
    engineId,
    transmissionId,
    bodyTypeId,
    marketId,
    steeringSide: VehicleSteeringSide.RHD,
    modelYear: 2010,
    productionStartYear: 2009,
    productionStartMonth: 6,
    productionEndYear: 2011,
    productionEndMonth: 8,
    engine: { code: '2ZR-FE' },
    transmission: { code: 'U341E', driveType: 'FWD' },
    status: MasterDataStatus.ACTIVE,
  };

  const verifiedRule = {
    id: compatibilityId,
    productId,
    vehicleConfigurationId: configurationId,
    makeId,
    modelId,
    generationId,
    trimId,
    engineId,
    transmissionId,
    bodyTypeId,
    marketId,
    steeringSide: VehicleSteeringSide.RHD,
    driveType: 'FWD',
    yearFrom: null,
    yearTo: null,
    position: 'FRONT',
    criteria: [],
    fitmentType: CompatibilityFitmentType.EXACT,
    conditions: null,
    notes: 'Verified exact fitment',
    source: CompatibilitySource.MANUFACTURER,
    verificationStatus: CompatibilityVerificationStatus.VERIFIED,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };


  const criterion = (
    overrides: Partial<{
      id: string;
      type: CompatibilityCriterionType;
      textValue: string | null;
      normalizedTextValue: string | null;
      rangeFrom: string | null;
      rangeTo: string | null;
      productionFromYear: number | null;
      productionFromMonth: number | null;
      productionToYear: number | null;
      productionToMonth: number | null;
      axlePosition: CompatibilityAxlePosition | null;
      installationPosition: CompatibilityInstallationPosition | null;
      isRequired: boolean;
      sortOrder: number;
    }> = {},
  ) => ({
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    type: CompatibilityCriterionType.ENGINE_CODE,
    textValue: null,
    normalizedTextValue: null,
    rangeFrom: null,
    rangeTo: null,
    productionFromYear: null,
    productionFromMonth: null,
    productionToYear: null,
    productionToMonth: null,
    axlePosition: null,
    installationPosition: null,
    isRequired: true,
    sortOrder: 0,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockResolvedValue({
      id: productId,
      status: ProductStatus.ACTIVE,
    });
    product.findFirst.mockResolvedValue({ id: productId });
    vehicleConfiguration.findUnique.mockResolvedValue(configuration);
    vehicleConfiguration.findFirst.mockResolvedValue(configuration);
    vehicleConfiguration.findMany.mockResolvedValue([configuration]);
    vehicleMake.findUnique.mockResolvedValue({
      id: makeId,
      status: MasterDataStatus.ACTIVE,
    });
    vehicleModel.findUnique.mockResolvedValue({
      id: modelId,
      makeId,
      status: MasterDataStatus.ACTIVE,
    });
    vehicleGeneration.findUnique.mockResolvedValue({
      id: generationId,
      modelId,
      startYear: 2006,
      endYear: 2013,
      status: MasterDataStatus.ACTIVE,
    });
    vehicleTrim.findUnique.mockResolvedValue({
      id: trimId,
      generationId,
      startYear: 2008,
      endYear: 2012,
      status: MasterDataStatus.ACTIVE,
    });
    vehicleEngine.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    vehicleTransmission.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
      driveType: 'FWD',
    });
    vehicleBodyType.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    vehicleMarket.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    vehicleCompatibility.create.mockResolvedValue(verifiedRule);
    productVehicleArticle.upsert.mockResolvedValue({ id: 'vehicle-article-id' });
    vehicleCompatibility.update.mockResolvedValue({
      ...verifiedRule,
      version: 2,
    });
    vehicleCompatibility.findUnique.mockResolvedValue(verifiedRule);
    vehicleCompatibility.findMany.mockResolvedValue([verifiedRule]);
    vehicleCompatibilityCriterion.createMany.mockResolvedValue({ count: 0 });
    vehicleCompatibilityCriterion.deleteMany.mockResolvedValue({ count: 0 });
    auditLog.create.mockResolvedValue({});
  });

  it('creates exact verified fitment from a canonical Vehicle Configuration', async () => {
    const result = await service.create(
      {
        productId,
        vehicleConfigurationId: configurationId,
        position: 'FRONT',
        fitmentType: CompatibilityFitmentType.EXACT,
        source: CompatibilitySource.MANUFACTURER,
        verificationStatus: CompatibilityVerificationStatus.VERIFIED,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(productVehicleArticle.upsert).toHaveBeenCalledWith({
      where: { productId_vehicleConfigurationId: { productId, vehicleConfigurationId: configurationId } },
      create: { productId, vehicleConfigurationId: configurationId },
      update: {},
    });
    expect(vehicleCompatibility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        vehicleConfigurationId: configurationId,
        makeId,
        modelId,
        generationId,
        trimId,
        engineId,
        transmissionId,
        bodyTypeId,
        marketId,
        steeringSide: VehicleSteeringSide.RHD,
        driveType: 'FWD',
        position: 'FRONT',
        fitmentType: CompatibilityFitmentType.EXACT,
        verificationStatus: CompatibilityVerificationStatus.VERIFIED,
        status: MasterDataStatus.ACTIVE,
        createdById: actorId,
        updatedById: actorId,
      }),
      select: expect.any(Object),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VEHICLE_COMPATIBILITY_CREATED',
          entityType: 'VehicleCompatibility',
          entityId: compatibilityId,
        }),
      }),
    );
    expect(result).toMatchObject({
      id: compatibilityId,
      productId,
      vehicleConfigurationId: configurationId,
    });
  });

  it('rejects drivetrain restrictions that conflict with an exact Vehicle Configuration', async () => {
    await expect(
      service.create(
        {
          productId,
          vehicleConfigurationId: configurationId,
          driveType: 'AWD',
          fitmentType: CompatibilityFitmentType.EXACT,
          source: CompatibilitySource.MANUFACTURER,
          verificationStatus: CompatibilityVerificationStatus.VERIFIED,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPATIBILITY_CONFIGURATION_DRIVETRAIN_MISMATCH' },
    });

    expect(vehicleCompatibility.create).not.toHaveBeenCalled();
  });

  it('requires Active broad fitment to resolve to a canonical Vehicle Configuration', async () => {
    vehicleConfiguration.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        {
          productId,
          makeId,
          modelId,
          generationId,
          yearFrom: 2008,
          yearTo: 2012,
          steeringSide: VehicleSteeringSide.RHD,
          driveType: 'FWD',
          fitmentType: CompatibilityFitmentType.RANGE,
          source: CompatibilitySource.MANUFACTURER,
          verificationStatus: CompatibilityVerificationStatus.VERIFIED,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPATIBILITY_TARGET_NOT_CANONICAL' },
    });

    expect(vehicleCompatibility.create).not.toHaveBeenCalled();
  });

  it('returns not confirmed when steering-side data required by a fitment rule is unavailable', async () => {
    vehicleConfiguration.findFirst.mockResolvedValue({
      ...configuration,
      steeringSide: null,
    });
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        fitmentType: CompatibilityFitmentType.CONDITIONAL,
      },
    ]);

    const result = await service.evaluate(productId, configurationId);

    expect(result.result).toBe('NOT_CONFIRMED');
    expect(result.missingFields).toEqual(['steeringSide']);
  });

  it('returns not confirmed when drivetrain data required by a fitment rule is unavailable', async () => {
    vehicleConfiguration.findFirst.mockResolvedValue({
      ...configuration,
      transmission: null,
    });
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        transmissionId: null,
        driveType: 'FWD',
        fitmentType: CompatibilityFitmentType.CONDITIONAL,
      },
    ]);

    const result = await service.evaluate(productId, configurationId);

    expect(result.result).toBe('NOT_CONFIRMED');
    expect(result.missingFields).toEqual(['drivetrain']);
  });

  it('does not activate unverified compatibility data', async () => {
    await expect(
      service.create(
        {
          productId,
          vehicleConfigurationId: configurationId,
          fitmentType: CompatibilityFitmentType.EXACT,
          source: CompatibilitySource.SELLER,
          verificationStatus: CompatibilityVerificationStatus.SELLER_SUBMITTED,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPATIBILITY_VERIFICATION_REQUIRED' },
    });

    expect(vehicleCompatibility.create).not.toHaveBeenCalled();
  });

  it('evaluates a verified exact fitment as compatible', async () => {
    const result = await service.evaluate(productId, configurationId);

    expect(result).toEqual({
      result: 'COMPATIBLE',
      productId,
      vehicleConfigurationId: configurationId,
      matchedCompatibilityId: compatibilityId,
      explanation:
        'A verified compatibility rule and its structured linkage criteria match this Manufacturer Article and vehicle.',
      missingFields: [],
    });
  });

  it('returns not confirmed when a verified rule needs vehicle data that is unknown', async () => {
    vehicleConfiguration.findFirst.mockResolvedValue({
      ...configuration,
      engineId: null,
    });
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        trimId: null,
        transmissionId: null,
        bodyTypeId: null,
        marketId: null,
        fitmentType: CompatibilityFitmentType.CONDITIONAL,
        conditions: { requirement: 'engine-specific' },
      },
    ]);

    const result = await service.evaluate(productId, configurationId);

    expect(result.result).toBe('NOT_CONFIRMED');
    expect(result.missingFields).toEqual(['engine']);
  });

  it('returns needs review when verified inclusion and exclusion records both match', async () => {
    vehicleCompatibility.findMany.mockResolvedValue([
      verifiedRule,
      {
        ...verifiedRule,
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        fitmentType: CompatibilityFitmentType.EXCLUSION,
        source: CompatibilitySource.OEM_CATALOG,
      },
    ]);

    const result = await service.evaluate(productId, configurationId);

    expect(result.result).toBe('NEEDS_REVIEW');
    expect(result.explanation).toContain('conflict');
  });

  it('stores normalized engine-code and month-precise production criteria with a fitment rule', async () => {
    await service.create(
      {
        productId,
        vehicleConfigurationId: configurationId,
        fitmentType: CompatibilityFitmentType.EXACT,
        source: CompatibilitySource.MANUFACTURER,
        verificationStatus: CompatibilityVerificationStatus.VERIFIED,
        status: MasterDataStatus.ACTIVE,
        criteria: [
          {
            type: CompatibilityCriterionType.ENGINE_CODE,
            textValue: '2ZR-FE',
          },
          {
            type: CompatibilityCriterionType.PRODUCTION_DATE,
            productionFromYear: 2009,
            productionFromMonth: 1,
            productionToYear: 2012,
            productionToMonth: 12,
          },
        ],
      },
      actorId,
    );

    expect(vehicleCompatibilityCriterion.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          vehicleCompatibilityId: compatibilityId,
          type: CompatibilityCriterionType.ENGINE_CODE,
          textValue: '2ZR-FE',
          normalizedTextValue: '2ZRFE',
          isRequired: true,
        }),
        expect.objectContaining({
          vehicleCompatibilityId: compatibilityId,
          type: CompatibilityCriterionType.PRODUCTION_DATE,
          productionFromYear: 2009,
          productionFromMonth: 1,
          productionToYear: 2012,
          productionToMonth: 12,
        }),
      ]),
    });
  });

  it('rejects an engine-code criterion that conflicts with an exact canonical configuration', async () => {
    await expect(
      service.create(
        {
          productId,
          vehicleConfigurationId: configurationId,
          fitmentType: CompatibilityFitmentType.EXACT,
          source: CompatibilitySource.MANUFACTURER,
          verificationStatus: CompatibilityVerificationStatus.VERIFIED,
          status: MasterDataStatus.ACTIVE,
          criteria: [
            {
              type: CompatibilityCriterionType.ENGINE_CODE,
              textValue: '1NZ-FE',
            },
          ],
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'COMPATIBILITY_CRITERION_CONFIGURATION_MISMATCH',
      },
    });

    expect(vehicleCompatibility.create).not.toHaveBeenCalled();
  });

  it('requires explicit standardized axle and installation position when the fitment rule depends on them', async () => {
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        criteria: [
          criterion({
            type: CompatibilityCriterionType.AXLE,
            axlePosition: CompatibilityAxlePosition.FRONT,
          }),
          criterion({
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            type: CompatibilityCriterionType.INSTALLATION_POSITION,
            installationPosition: CompatibilityInstallationPosition.LEFT,
            sortOrder: 1,
          }),
        ],
      },
    ]);

    const withoutContext = await service.evaluate(
      productId,
      configurationId,
    );
    expect(withoutContext.result).toBe('NOT_CONFIRMED');
    expect(withoutContext.missingFields).toEqual(['axlePosition']);

    const withContext = await service.evaluate(
      productId,
      configurationId,
      {
        axlePosition: CompatibilityAxlePosition.FRONT,
        installationPosition: CompatibilityInstallationPosition.LEFT,
      },
    );
    expect(withContext.result).toBe('COMPATIBLE');
  });

  it('uses month-precise production context when a canonical configuration spans beyond the fitment window', async () => {
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        criteria: [
          criterion({
            type: CompatibilityCriterionType.PRODUCTION_DATE,
            productionFromYear: 2010,
            productionFromMonth: 3,
            productionToYear: 2010,
            productionToMonth: 9,
          }),
        ],
      },
    ]);

    const withoutProductionDate = await service.evaluate(
      productId,
      configurationId,
    );
    expect(withoutProductionDate.result).toBe('NOT_CONFIRMED');
    expect(withoutProductionDate.missingFields).toEqual(['productionDate']);

    const insideWindow = await service.evaluate(
      productId,
      configurationId,
      { productionYear: 2010, productionMonth: 6 },
    );
    expect(insideWindow.result).toBe('COMPATIBLE');

    const outsideWindow = await service.evaluate(
      productId,
      configurationId,
      { productionYear: 2010, productionMonth: 11 },
    );
    expect(outsideWindow.result).toBe('NOT_CONFIRMED');
    expect(outsideWindow.matchedCompatibilityId).toBeNull();
  });

  it('resolves VIN ranges only when the caller supplies VIN context', async () => {
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        criteria: [
          criterion({
            type: CompatibilityCriterionType.VIN_RANGE,
            rangeFrom: 'JTDBR32E000100000',
            rangeTo: 'JTDBR32E000199999',
          }),
        ],
      },
    ]);

    const withoutVin = await service.evaluate(productId, configurationId);
    expect(withoutVin.result).toBe('NOT_CONFIRMED');
    expect(withoutVin.missingFields).toEqual(['vin']);

    const withVin = await service.evaluate(productId, configurationId, {
      vin: 'JTDBR32E000150000',
    });
    expect(withVin.result).toBe('COMPATIBLE');
  });

  it('allows Active production-date fitment when the canonical configuration overlaps a narrower month window', async () => {
    await expect(
      service.create(
        {
          productId,
          vehicleConfigurationId: configurationId,
          fitmentType: CompatibilityFitmentType.EXACT,
          source: CompatibilitySource.MANUFACTURER,
          verificationStatus: CompatibilityVerificationStatus.VERIFIED,
          status: MasterDataStatus.ACTIVE,
          criteria: [
            {
              type: CompatibilityCriterionType.PRODUCTION_DATE,
              productionFromYear: 2010,
              productionFromMonth: 3,
              productionToYear: 2010,
              productionToMonth: 9,
            },
          ],
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      id: compatibilityId,
    });
  });

  it('treats FRONT_AND_REAR axle applicability as matching either front or rear context', async () => {
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        criteria: [
          criterion({
            type: CompatibilityCriterionType.AXLE,
            axlePosition: CompatibilityAxlePosition.FRONT_AND_REAR,
          }),
        ],
      },
    ]);

    const front = await service.evaluate(productId, configurationId, {
      axlePosition: CompatibilityAxlePosition.FRONT,
    });
    const rear = await service.evaluate(productId, configurationId, {
      axlePosition: CompatibilityAxlePosition.REAR,
    });

    expect(front.result).toBe('COMPATIBLE');
    expect(rear.result).toBe('COMPATIBLE');
  });

  it('rejects malformed VIN ranges before fitment data is stored', async () => {
    await expect(
      service.create(
        {
          productId,
          vehicleConfigurationId: configurationId,
          fitmentType: CompatibilityFitmentType.EXACT,
          source: CompatibilitySource.MANUFACTURER,
          verificationStatus: CompatibilityVerificationStatus.VERIFIED,
          status: MasterDataStatus.ACTIVE,
          criteria: [
            {
              type: CompatibilityCriterionType.VIN_RANGE,
              rangeFrom: 'JTDBR32E00010000',
              rangeTo: 'JTDBR32E00019999',
            },
          ],
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPATIBILITY_VIN_INVALID' },
    });

    expect(vehicleCompatibility.create).not.toHaveBeenCalled();
  });

  it('does not treat absence of a matching rule as incompatibility', async () => {
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        ...verifiedRule,
        vehicleConfigurationId: null,
        modelId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        generationId: null,
        trimId: null,
        engineId: null,
        transmissionId: null,
        bodyTypeId: null,
        marketId: null,
        fitmentType: CompatibilityFitmentType.BROAD,
      },
    ]);

    const result = await service.evaluate(productId, configurationId);

    expect(result.result).toBe('NOT_CONFIRMED');
    expect(result.matchedCompatibilityId).toBeNull();
  });
});
