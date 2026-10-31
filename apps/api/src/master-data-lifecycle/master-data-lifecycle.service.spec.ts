import {
  MasterDataStatus,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import {
  MasterDataLifecycleEntityType,
} from './dto/master-data-lifecycle.dto.js';
import { MasterDataLifecycleService } from './master-data-lifecycle.service.js';

describe('MasterDataLifecycleService', () => {
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const categoryId = '11111111-1111-4111-8111-111111111111';
  const brandId = '22222222-2222-4222-8222-222222222222';
  const replacementBrandId =
    '33333333-3333-4333-8333-333333333333';
  const unitId = '44444444-4444-4444-8444-444444444444';

  const category = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const productFamily = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const productType = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const attributeDefinition = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const attributeGroup = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const attributeAllowedValue = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const productTypeCriteriaTemplate = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const productTypeCriteriaTemplateItem = {
    findFirst: vi.fn(),
    count: vi.fn(),
  };
  const productTypeCriteriaTemplateTarget = {
    findFirst: vi.fn(),
    count: vi.fn(),
  };
  const brand = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const unitOfMeasure = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const product = { findFirst: vi.fn(), count: vi.fn() };
  const partNumber = { findFirst: vi.fn(), count: vi.fn() };
  const productTypeAttributeAssignment = { findFirst: vi.fn(), count: vi.fn() };
  const productAttributeValue = { findFirst: vi.fn(), count: vi.fn() };
  const attributeAlias = { count: vi.fn() };
  const vehicleMake = { findUnique: vi.fn(), updateMany: vi.fn() };
  const vehicleModel = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const vehicleModelDerivative = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleGenerationFamily = {
    findFirst: vi.fn(),
    count: vi.fn(),
  };
  const vehicleGeneration = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleTrim = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleEngine = { findUnique: vi.fn(), updateMany: vi.fn() };
  const vehicleTransmission = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleBodyType = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleMarket = { findUnique: vi.fn(), updateMany: vi.fn() };
  const vehicleConfiguration = {
    count: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleCompatibility = { findFirst: vi.fn(), count: vi.fn() };
  const vehicleIdentifierMapping = { findFirst: vi.fn(), count: vi.fn() };
  const vehicleProfile = { findFirst: vi.fn(), count: vi.fn() };
  const masterDataProvenance = { count: vi.fn() };
  const masterDataLocalization = { count: vi.fn() };
  const externalStandardMapping = { count: vi.fn() };
  const supplier = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const supplierOffer = { findFirst: vi.fn(), count: vi.fn() };
  const auditLog = {
    create: vi.fn(),
    findFirst: vi.fn(),
  };

  const tx = {
    category,
    productFamily,
    productType,
    attributeDefinition,
    attributeGroup,
    attributeAllowedValue,
    attributeAlias,
    productTypeCriteriaTemplate,
    productTypeCriteriaTemplateItem,
    productTypeCriteriaTemplateTarget,
    brand,
    unitOfMeasure,
    product,
    partNumber,
    productTypeAttributeAssignment,
    productAttributeValue,
    vehicleMake,
    vehicleModel,
    vehicleModelDerivative,
    vehicleGenerationFamily,
    vehicleGeneration,
    vehicleTrim,
    vehicleEngine,
    vehicleTransmission,
    vehicleBodyType,
    vehicleMarket,
    vehicleConfiguration,
    vehicleCompatibility,
    vehicleIdentifierMapping,
    vehicleProfile,
    masterDataProvenance,
    masterDataLocalization,
    externalStandardMapping,
    supplier,
    supplierOffer,
    auditLog,
  };

  const database = {
    ...tx,
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    ),
  } as unknown as DatabaseService;

  const service = new MasterDataLifecycleService(database);

  beforeEach(() => {
    vi.clearAllMocks();
    productFamily.findFirst.mockResolvedValue(null);
    productType.findFirst.mockResolvedValue(null);
    product.findFirst.mockResolvedValue(null);
    partNumber.findFirst.mockResolvedValue(null);
    productTypeAttributeAssignment.findFirst.mockResolvedValue(null);
    productTypeCriteriaTemplate.findFirst.mockResolvedValue(null);
    productTypeCriteriaTemplateItem.findFirst.mockResolvedValue(null);
    productTypeCriteriaTemplateTarget.findFirst.mockResolvedValue(null);
    attributeAllowedValue.findFirst.mockResolvedValue(null);
    productAttributeValue.findFirst.mockResolvedValue(null);
    attributeDefinition.findFirst.mockResolvedValue(null);
    supplierOffer.findFirst.mockResolvedValue(null);
    vehicleModel.findFirst.mockResolvedValue(null);
    vehicleModelDerivative.findFirst.mockResolvedValue(null);
    vehicleGenerationFamily.findFirst.mockResolvedValue(null);
    vehicleGeneration.findFirst.mockResolvedValue(null);
    vehicleTrim.findFirst.mockResolvedValue(null);
    vehicleConfiguration.findFirst.mockResolvedValue(null);
    vehicleCompatibility.findFirst.mockResolvedValue(null);
    vehicleIdentifierMapping.findFirst.mockResolvedValue(null);
    vehicleProfile.findFirst.mockResolvedValue(null);
    category.count.mockResolvedValue(0);
    productFamily.count.mockResolvedValue(0);
    productType.count.mockResolvedValue(0);
    product.count.mockResolvedValue(0);
    productTypeCriteriaTemplate.count.mockResolvedValue(0);
    productTypeCriteriaTemplateItem.count.mockResolvedValue(0);
    productTypeCriteriaTemplateTarget.count.mockResolvedValue(0);
    productTypeAttributeAssignment.count.mockResolvedValue(0);
    productAttributeValue.count.mockResolvedValue(0);
    attributeAllowedValue.count.mockResolvedValue(0);
    attributeAlias.count.mockResolvedValue(0);
    attributeDefinition.count.mockResolvedValue(0);
    partNumber.count.mockResolvedValue(0);
    supplierOffer.count.mockResolvedValue(0);
    vehicleCompatibility.count.mockResolvedValue(0);
    vehicleConfiguration.count.mockResolvedValue(0);
    vehicleModelDerivative.count.mockResolvedValue(0);
    vehicleGenerationFamily.count.mockResolvedValue(0);
    vehicleGeneration.count.mockResolvedValue(0);
    vehicleIdentifierMapping.count.mockResolvedValue(0);
    vehicleProfile.count.mockResolvedValue(0);
    masterDataProvenance.count.mockResolvedValue(0);
    masterDataLocalization.count.mockResolvedValue(0);
    externalStandardMapping.count.mockResolvedValue(0);
    auditLog.create.mockResolvedValue({});
    auditLog.findFirst.mockResolvedValue(null);
  });

  it('allows deprecation while preserving existing active references', async () => {
    const record: {
      id: string;
      status: MasterDataStatus;
      version: number;
    } = {
      id: categoryId,
      status: MasterDataStatus.ACTIVE,
      version: 4,
    };
    category.findUnique.mockImplementation(() =>
      Promise.resolve({ ...record }),
    );
    category.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; version: number };
        data: { status: MasterDataStatus };
      }) => {
        if (
          where.id !== record.id ||
          where.version !== record.version
        ) {
          return Promise.resolve({ count: 0 });
        }
        record.status = data.status;
        record.version += 1;
        return Promise.resolve({ count: 1 });
      },
    );
    productFamily.findFirst.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
    });

    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.CATEGORY,
        categoryId,
        {
          version: 4,
          targetStatus: MasterDataStatus.DEPRECATED,
          reason: 'Category is being retired after taxonomy review.',
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      status: MasterDataStatus.DEPRECATED,
      version: 5,
      allowedNextStatuses: [
        MasterDataStatus.ACTIVE,
        MasterDataStatus.SUPERSEDED,
        MasterDataStatus.ARCHIVED,
      ],
    });

    expect(productFamily.findFirst).not.toHaveBeenCalled();
    expect(auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('supersedes a master record only toward an ACTIVE replacement and audits the transition', async () => {
    const records = new Map<
      string,
      { id: string; status: MasterDataStatus; version: number }
    >([
      [
        brandId,
        { id: brandId, status: MasterDataStatus.ACTIVE, version: 1 },
      ],
      [
        replacementBrandId,
        {
          id: replacementBrandId,
          status: MasterDataStatus.ACTIVE,
          version: 3,
        },
      ],
    ]);
    brand.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(records.get(where.id) ?? null),
    );
    brand.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; version: number };
        data: { status: MasterDataStatus };
      }) => {
        const current = records.get(where.id);
        if (!current || current.version !== where.version) {
          return Promise.resolve({ count: 0 });
        }
        records.set(where.id, {
          ...current,
          status: data.status,
          version: current.version + 1,
        });
        return Promise.resolve({ count: 1 });
      },
    );

    const result = await service.transition(
      'CATALOG',
      MasterDataLifecycleEntityType.BRAND,
      brandId,
      {
        version: 1,
        targetStatus: MasterDataStatus.SUPERSEDED,
        reason: 'Manufacturer consolidated the legacy Brand identity.',
        supersededById: replacementBrandId,
        sourceReference: 'manufacturer-bulletin-2026-10',
      },
      actorId,
    );

    expect(result).toEqual({
      entityType: MasterDataLifecycleEntityType.BRAND,
      entityId: brandId,
      status: MasterDataStatus.SUPERSEDED,
      version: 2,
      supersededById: replacementBrandId,
      reason: 'Manufacturer consolidated the legacy Brand identity.',
      sourceReference: 'manufacturer-bulletin-2026-10',
      allowedNextStatuses: [MasterDataStatus.ARCHIVED],
      activationWorkflowRequired: false,
      restoreAvailable: false,
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MASTER_DATA_LIFECYCLE_TRANSITIONED',
          entityType: 'Brand',
          entityId: brandId,
          metadata: expect.objectContaining({
            supersededById: replacementBrandId,
            before: { status: MasterDataStatus.ACTIVE, version: 1 },
            after: { status: MasterDataStatus.SUPERSEDED, version: 2 },
          }),
        }),
      }),
    );
  });

  it('carries a governed supersession target into final archival history', async () => {
    const record: {
      id: string;
      status: MasterDataStatus;
      version: number;
    } = {
      id: brandId,
      status: MasterDataStatus.SUPERSEDED,
      version: 2,
    };
    brand.findUnique.mockImplementation(() =>
      Promise.resolve({ ...record }),
    );
    brand.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; version: number };
        data: { status: MasterDataStatus };
      }) => {
        if (
          where.id !== record.id ||
          where.version !== record.version
        ) {
          return Promise.resolve({ count: 0 });
        }
        record.status = data.status;
        record.version += 1;
        return Promise.resolve({ count: 1 });
      },
    );
    auditLog.findFirst.mockResolvedValue({
      metadata: {
        before: {
          status: MasterDataStatus.ACTIVE,
          version: 1,
        },
        after: {
          status: MasterDataStatus.SUPERSEDED,
          version: 2,
        },
        reason: 'Legacy Brand replaced by canonical Brand.',
        supersededById: replacementBrandId,
        sourceReference: 'manufacturer-bulletin-2026-10',
      },
    });

    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.BRAND,
        brandId,
        {
          version: 2,
          targetStatus: MasterDataStatus.ARCHIVED,
          reason: 'Replacement migration is complete.',
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      status: MasterDataStatus.ARCHIVED,
      version: 3,
      supersededById: replacementBrandId,
    });

    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            supersededById: replacementBrandId,
            after: {
              status: MasterDataStatus.ARCHIVED,
              version: 3,
            },
          }),
        }),
      }),
    );
  });

  it('allows a Draft core master to be archived without destructive deletion', async () => {
    const records = new Map<
      string,
      { id: string; status: MasterDataStatus; version: number }
    >([
      [
        unitId,
        { id: unitId, status: MasterDataStatus.DRAFT, version: 2 },
      ],
    ]);
    unitOfMeasure.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(records.get(where.id) ?? null),
    );
    unitOfMeasure.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; version: number };
        data: { status: MasterDataStatus };
      }) => {
        const current = records.get(where.id);
        if (!current || current.version !== where.version) {
          return Promise.resolve({ count: 0 });
        }
        records.set(where.id, {
          ...current,
          status: data.status,
          version: current.version + 1,
        });
        return Promise.resolve({ count: 1 });
      },
    );

    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.UNIT_OF_MEASURE,
        unitId,
        {
          version: 2,
          targetStatus: MasterDataStatus.ARCHIVED,
          reason: 'Unused draft unit was cancelled before publication.',
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      status: MasterDataStatus.ARCHIVED,
      version: 3,
      allowedNextStatuses: [],
    });
  });

  it('requires reactivation to use the entity-specific activation workflow', async () => {
    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.BRAND,
        brandId,
        {
          version: 3,
          targetStatus: MasterDataStatus.ACTIVE,
          reason: 'Brand has been approved for reactivation.',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_TARGET_INVALID' },
    });
  });

  it('does not expose stale deprecation metadata after entity-specific reactivation', async () => {
    brand.findUnique.mockResolvedValue({
      id: brandId,
      status: MasterDataStatus.ACTIVE,
      version: 5,
    });
    auditLog.findFirst.mockResolvedValue({
      metadata: {
        before: {
          status: MasterDataStatus.ACTIVE,
          version: 3,
        },
        after: {
          status: MasterDataStatus.DEPRECATED,
          version: 4,
        },
        reason: 'Temporary retirement.',
        supersededById: null,
        sourceReference: 'ticket-123',
      },
    });

    await expect(
      service.getState(
        'CATALOG',
        MasterDataLifecycleEntityType.BRAND,
        brandId,
      ),
    ).resolves.toEqual({
      entityType: MasterDataLifecycleEntityType.BRAND,
      entityId: brandId,
      status: MasterDataStatus.ACTIVE,
      version: 5,
      supersededById: null,
      reason: null,
      sourceReference: null,
      allowedNextStatuses: [
        MasterDataStatus.DEPRECATED,
        MasterDataStatus.SUPERSEDED,
        MasterDataStatus.ARCHIVED,
      ],
      activationWorkflowRequired: false,
      restoreAvailable: false,
    });
  });

  it('rejects an entity type on the wrong permission/domain endpoint', async () => {
    await expect(
      service.getState(
        'CATALOG',
        MasterDataLifecycleEntityType.VEHICLE_MAKE,
        categoryId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_DOMAIN_MISMATCH' },
    });
  });

  it('blocks final archival while a live Article still references the master record', async () => {
    const productId = '66666666-6666-4666-8666-666666666666';
    brand.findUnique.mockResolvedValue({
      id: brandId,
      status: MasterDataStatus.DEPRECATED,
      version: 2,
    });
    product.findFirst.mockResolvedValue({
      id: productId,
      status: ProductStatus.ACTIVE,
    });

    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.BRAND,
        brandId,
        {
          version: 2,
          targetStatus: MasterDataStatus.ARCHIVED,
          reason: 'Archive after the replacement migration is complete.',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES',
        details: expect.objectContaining({ dependencyId: productId }),
      },
    });

    expect(brand.updateMany).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });
  it('blocks Model permanent deletion when an unassigned Generation Family exists', async () => {
    const modelId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    vehicleModel.findUnique.mockResolvedValue({
      id: modelId,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });
    vehicleGenerationFamily.count.mockResolvedValue(1);

    await expect(
      service.removalPreflight(
        'VEHICLE',
        MasterDataLifecycleEntityType.VEHICLE_MODEL,
        modelId,
      ),
    ).resolves.toMatchObject({
      canPermanentlyDelete: false,
      dependencies: expect.arrayContaining([
        { key: 'generationFamilies', label: 'Generation Families', count: 1 },
      ]),
    });

    expect(vehicleGenerationFamily.count).toHaveBeenCalledWith({
      where: { modelId },
    });
    await expect(
      service.permanentDelete(
        'VEHICLE',
        MasterDataLifecycleEntityType.VEHICLE_MODEL,
        modelId,
        { version: 1, reason: 'Test a family-owned Model deletion preflight.' },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_PERMANENT_DELETE_BLOCKED' },
    });
    expect(vehicleModel.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks Model archival while an active Generation Family exists', async () => {
    const modelId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    const familyId = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
    vehicleModel.findUnique.mockResolvedValue({
      id: modelId,
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });
    vehicleGenerationFamily.findFirst.mockResolvedValue({ id: familyId });

    await expect(
      service.transition(
        'VEHICLE',
        MasterDataLifecycleEntityType.VEHICLE_MODEL,
        modelId,
        { version: 1, targetStatus: MasterDataStatus.ARCHIVED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES',
        details: expect.objectContaining({ dependencyId: familyId }),
      },
    });
    expect(vehicleGenerationFamily.findFirst).toHaveBeenCalledWith({
      where: { modelId, status: MasterDataStatus.ACTIVE },
      select: { id: true },
    });
    expect(vehicleModel.updateMany).not.toHaveBeenCalled();
  });

  it('includes market memberships in permanent-removal preflight', async () => {
    vehicleMarket.findUnique.mockResolvedValue({ id: categoryId, status: MasterDataStatus.DRAFT, version: 1 });
    vehicleConfiguration.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => 'marketApplicabilities' in where ? 2 : 0);
    await expect(service.removalPreflight('VEHICLE', MasterDataLifecycleEntityType.VEHICLE_MARKET, categoryId)).resolves.toMatchObject({
      canPermanentlyDelete: false,
      dependencies: expect.arrayContaining([expect.objectContaining({ key: 'marketApplicabilities', count: 2 })]),
    });
  });

  it('checks active market memberships before archiving a Market', async () => {
    vehicleMarket.findUnique.mockResolvedValue({ id: categoryId, status: MasterDataStatus.ACTIVE, version: 1 });
    vehicleConfiguration.findFirst.mockResolvedValue({ id: 'dependent-config' });
    await expect(service.transition('VEHICLE', MasterDataLifecycleEntityType.VEHICLE_MARKET, categoryId, { version: 1, targetStatus: MasterDataStatus.ARCHIVED }, actorId)).rejects.toThrow();
    expect(vehicleConfiguration.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([{ marketApplicabilities: { some: { marketId: categoryId, status: MasterDataStatus.ACTIVE } } }]) }),
    }));
    expect(vehicleMarket.updateMany).not.toHaveBeenCalled();
  });

  it('reports structured dependency blockers before permanent deletion', async () => {
    category.findUnique.mockResolvedValue({
      id: categoryId,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });
    category.count.mockResolvedValue(1);
    productFamily.count.mockResolvedValue(2);

    await expect(
      service.removalPreflight(
        'CATALOG',
        MasterDataLifecycleEntityType.CATEGORY,
        categoryId,
      ),
    ).resolves.toMatchObject({
      entityType: MasterDataLifecycleEntityType.CATEGORY,
      entityId: categoryId,
      canPermanentlyDelete: false,
      deletionPolicy: 'DRAFT_ONLY_UNUSED',
      dependencies: expect.arrayContaining([
        { key: 'childCategories', label: 'child Categories', count: 1 },
        { key: 'productFamilies', label: 'Part Groups', count: 2 },
      ]),
    });
  });

  it('permanently deletes an unused Draft and preserves audit evidence', async () => {
    category.findUnique.mockResolvedValue({
      id: categoryId,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });
    category.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.permanentDelete(
        'CATALOG',
        MasterDataLifecycleEntityType.CATEGORY,
        categoryId,
        {
          version: 1,
          reason: 'Draft category was created in error and was never used.',
        },
        actorId,
      ),
    ).resolves.toEqual({
      entityType: MasterDataLifecycleEntityType.CATEGORY,
      entityId: categoryId,
      deleted: true,
    });

    expect(category.deleteMany).toHaveBeenCalledWith({
      where: { id: categoryId, version: 1 },
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MASTER_DATA_PERMANENTLY_DELETED',
          entityType: 'Category',
          entityId: categoryId,
        }),
      }),
    );
  });

  it('blocks permanent deletion after a Draft record has been modified', async () => {
    category.findUnique.mockResolvedValue({
      id: categoryId,
      status: MasterDataStatus.DRAFT,
      version: 2,
    });

    await expect(
      service.permanentDelete(
        'CATALOG',
        MasterDataLifecycleEntityType.CATEGORY,
        categoryId,
        {
          version: 2,
          reason: 'Attempt to delete a modified Draft record.',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MASTER_DATA_PERMANENT_DELETE_BLOCKED',
        details: expect.objectContaining({
          canPermanentlyDelete: false,
        }),
      },
    });

    expect(category.deleteMany).not.toHaveBeenCalled();
  });

  it('allows direct archival of an Active master when no live dependency blocks it', async () => {
    const record = {
      id: brandId,
      status: MasterDataStatus.ACTIVE,
      version: 4,
    };
    brand.findUnique.mockImplementation(() => Promise.resolve({ ...record }));
    brand.updateMany.mockResolvedValue({ count: 1 });
    brand.findUnique
      .mockResolvedValueOnce({ ...record })
      .mockResolvedValueOnce({
        ...record,
        status: MasterDataStatus.ARCHIVED,
        version: 5,
      });

    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.BRAND,
        brandId,
        {
          version: 4,
          targetStatus: MasterDataStatus.ARCHIVED,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      status: MasterDataStatus.ARCHIVED,
      version: 5,
      reason: null,
    });
  });

  it('restores ARCHIVED records to DEPRECATED so activation still uses entity validation', async () => {
    const record: {
      id: string;
      status: MasterDataStatus;
      version: number;
    } = {
      id: categoryId,
      status: MasterDataStatus.ARCHIVED,
      version: 3,
    };
    category.findUnique.mockImplementation(() => Promise.resolve({ ...record }));
    category.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; version: number };
        data: { status: MasterDataStatus };
      }) => {
        if (where.id !== record.id || where.version !== record.version) {
          return Promise.resolve({ count: 0 });
        }
        record.status = data.status;
        record.version += 1;
        return Promise.resolve({ count: 1 });
      },
    );

    await expect(
      service.restore(
        'CATALOG',
        MasterDataLifecycleEntityType.CATEGORY,
        categoryId,
        {
          version: 3,
          reason: 'Taxonomy review approved this record for reconsideration.',
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      status: MasterDataStatus.DEPRECATED,
      version: 4,
      restoreAvailable: false,
      activationWorkflowRequired: true,
    });

    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MASTER_DATA_LIFECYCLE_RESTORED',
          entityType: 'Category',
        }),
      }),
    );
  });

  it('never permits permanent deletion of Configured Vehicle identity records', async () => {
    const configurationId = '77777777-7777-4777-8777-777777777777';
    vehicleConfiguration.findUnique.mockResolvedValue({
      id: configurationId,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });

    await expect(
      service.removalPreflight(
        'VEHICLE',
        MasterDataLifecycleEntityType.VEHICLE_CONFIGURATION,
        configurationId,
      ),
    ).resolves.toMatchObject({
      canPermanentlyDelete: false,
      deletionPolicy: 'RETAINED_IDENTITY',
      blockers: expect.arrayContaining([
        'Configured Vehicle identities are retained and cannot be permanently deleted.',
      ]),
    });
  });

  it('blocks Supplier permanent deletion while Supplier Offers exist', async () => {
    const supplierId = '88888888-8888-4888-8888-888888888888';
    supplier.findUnique.mockResolvedValue({
      id: supplierId,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });
    supplierOffer.count.mockResolvedValue(2);

    await expect(
      service.removalPreflight(
        'SOURCING',
        MasterDataLifecycleEntityType.SUPPLIER,
        supplierId,
      ),
    ).resolves.toMatchObject({
      canPermanentlyDelete: false,
      dependencies: [
        { key: 'offers', label: 'Supplier Offers', count: 2 },
      ],
    });
  });

  it('reports Criteria Template item and assignment dependencies', async () => {
    const templateId = '99999999-9999-4999-8999-999999999999';
    productTypeCriteriaTemplate.findUnique.mockResolvedValue({
      id: templateId,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });
    productTypeCriteriaTemplateItem.count.mockResolvedValue(4);
    productTypeCriteriaTemplateTarget.count.mockResolvedValue(1);

    await expect(
      service.removalPreflight(
        'CATALOG',
        MasterDataLifecycleEntityType.CRITERIA_TEMPLATE,
        templateId,
      ),
    ).resolves.toMatchObject({
      canPermanentlyDelete: false,
      dependencies: expect.arrayContaining([
        { key: 'items', label: 'Criteria Template items', count: 4 },
        { key: 'targets', label: 'Product Type assignments', count: 1 },
      ]),
    });
  });

  it('blocks final Attribute Group archival while Active Attributes remain', async () => {
    const groupId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    attributeGroup.findUnique.mockResolvedValue({
      id: groupId,
      status: MasterDataStatus.DEPRECATED,
      version: 2,
    });
    attributeDefinition.findFirst.mockResolvedValue({
      id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
    });

    await expect(
      service.transition(
        'CATALOG',
        MasterDataLifecycleEntityType.ATTRIBUTE_GROUP,
        groupId,
        {
          version: 2,
          targetStatus: MasterDataStatus.ARCHIVED,
          reason: 'Archive group after its Attributes are migrated.',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MASTER_DATA_HAS_ACTIVE_DEPENDENCIES',
      },
    });

    expect(attributeGroup.updateMany).not.toHaveBeenCalled();
  });

});
