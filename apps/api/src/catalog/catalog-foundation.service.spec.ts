import { MasterDataStatus, ProductStatus } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { CatalogFoundationService } from './catalog-foundation.service.js';

describe('CatalogFoundationService', () => {
  const category = { findUnique: vi.fn() };
  const productFamily = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const unitOfMeasure = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productType = { findFirst: vi.fn() };
  const product = { findFirst: vi.fn() };
  const auditLog = { create: vi.fn() };
  const database = {
    category,
    productFamily,
    unitOfMeasure,
    productType,
    product,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ productFamily, unitOfMeasure, auditLog }),
    ),
  };
  const service = new CatalogFoundationService(
    database as unknown as DatabaseService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const categoryId = '11111111-1111-4111-8111-111111111111';
  const familyId = '22222222-2222-4222-8222-222222222222';
  const unitId = '33333333-3333-4333-8333-333333333333';
  const now = new Date('2026-09-28T08:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    category.findUnique.mockResolvedValue({
      id: categoryId,
      parentId: null,
      status: MasterDataStatus.ACTIVE,
    });
    productType.findFirst.mockResolvedValue(null);
    product.findFirst.mockResolvedValue(null);
    auditLog.create.mockResolvedValue({});
  });

  it('pages Part Groups with embedded Category context', async () => {
    const record = {
      id: familyId,
      categoryId,
      code: 'BRAKE_FRICTION',
      name: 'Brake Friction',
      description: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      category: {
        name: 'Braking System',
        status: MasterDataStatus.ACTIVE,
      },
    };
    productFamily.count.mockResolvedValue(63);
    productFamily.findMany.mockResolvedValue([record]);

    await expect(
      service.listProductFamiliesPage({
        search: 'brake',
        categorySearch: 'braking',
        status: MasterDataStatus.ACTIVE,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: familyId,
          categoryId,
          code: 'BRAKE_FRICTION',
          name: 'Brake Friction',
          description: null,
          status: MasterDataStatus.ACTIVE,
          version: 1,
          createdAt: now,
          updatedAt: now,
          categoryName: 'Braking System',
          categoryStatus: MasterDataStatus.ACTIVE,
        },
      ],
      total: 63,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    expect(productFamily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MasterDataStatus.ACTIVE,
          categoryId: undefined,
          category: {
            OR: [
              { name: { contains: 'braking', mode: 'insensitive' } },
              { code: { contains: 'braking', mode: 'insensitive' } },
            ],
          },
        }),
        skip: 25,
        take: 25,
      }),
    );
  });

  it('creates an Active Part Group only beneath an Active category', async () => {
    productFamily.create.mockResolvedValue({
      id: familyId,
      categoryId,
      code: 'BRAKE_FRICTION',
      name: 'Brake Friction',
      description: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.createProductFamily(
        {
          categoryId,
          code: 'BRAKE_FRICTION',
          name: ' Brake Friction ',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      id: familyId,
      code: 'BRAKE_FRICTION',
      status: MasterDataStatus.ACTIVE,
    });

    category.findUnique.mockResolvedValue({
      id: categoryId,
      parentId: null,
      status: MasterDataStatus.INACTIVE,
    });
    await expect(
      service.createProductFamily(
        {
          categoryId,
          code: 'FILTERS',
          name: 'Filters',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PART_GROUP_CATEGORY_NOT_ACTIVE' },
    });
  });

  it('routes Part Group retirement through the governed lifecycle endpoint', async () => {
    productFamily.findUnique.mockResolvedValue({
      id: familyId,
      categoryId,
      code: 'BRAKE_FRICTION',
      name: 'Brake Friction',
      description: null,
      status: MasterDataStatus.ACTIVE,
      version: 2,
      createdById: actorId,
      updatedById: actorId,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.updateProductFamily(
        familyId,
        { version: 2, status: MasterDataStatus.DEPRECATED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });
    expect(productType.findFirst).not.toHaveBeenCalled();
    expect(productFamily.update).not.toHaveBeenCalled();
  });

  it('routes Unit of Measure retirement through the governed lifecycle endpoint', async () => {
    unitOfMeasure.findUnique.mockResolvedValue({
      id: unitId,
      code: 'PIECE',
      name: 'Piece',
      symbol: 'pc',
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdById: actorId,
      updatedById: actorId,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.updateUnit(
        unitId,
        { version: 1, status: MasterDataStatus.DEPRECATED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });
    expect(product.findFirst).not.toHaveBeenCalled();
    expect(unitOfMeasure.update).not.toHaveBeenCalled();
  });
});
