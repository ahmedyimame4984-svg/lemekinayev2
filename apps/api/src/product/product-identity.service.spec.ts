import {
  MasterDataStatus,
  PartNumberType,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { ProductIdentityService } from './product-identity.service.js';

describe('ProductIdentityService', () => {
  const brand = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const product = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const partNumber = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const auditLog = { create: vi.fn() };

  const transaction = {
    brand,
    product,
    partNumber,
    auditLog,
  };
  const database = {
    brand,
    product,
    partNumber,
    auditLog,
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  const service = new ProductIdentityService(
    database as unknown as DatabaseService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const brandId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const partNumberId = '33333333-3333-4333-8333-333333333333';
  const now = new Date('2026-09-28T07:30:00.000Z');

  const activeBrand = {
    id: brandId,
    code: 'BOSCH',
    name: 'Bosch',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const activeProduct = {
    id: productId,
    brandId,
    status: ProductStatus.ACTIVE,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    brand.findUnique.mockResolvedValue(activeBrand);
    brand.create.mockResolvedValue(activeBrand);
    brand.update.mockResolvedValue({ ...activeBrand, version: 2 });
    product.findUnique.mockResolvedValue(activeProduct);
    product.findFirst.mockResolvedValue(null);
    partNumber.findFirst.mockResolvedValue(null);
    partNumber.findMany.mockResolvedValue([]);
    partNumber.create.mockResolvedValue({
      id: partNumberId,
      productId,
      issuerBrandId: brandId,
      partNumber: '0 986 494 603',
      rawPartNumber: '0 986 494 603',
      normalizedPartNumber: '0986494603',
      type: PartNumberType.MANUFACTURER,
      isPrimary: true,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    partNumber.update.mockResolvedValue({
      id: partNumberId,
      productId,
      issuerBrandId: brandId,
      partNumber: '0 986 494 603',
      rawPartNumber: '0 986 494 603',
      normalizedPartNumber: '0986494603',
      type: PartNumberType.MANUFACTURER,
      isPrimary: true,
      status: MasterDataStatus.ACTIVE,
      version: 2,
      createdAt: now,
      updatedAt: now,
    });
    auditLog.create.mockResolvedValue({});
  });

  it('pages and searches Brand Master records in the database', async () => {
    brand.count.mockResolvedValue(76);
    brand.findMany.mockResolvedValue([activeBrand]);

    await expect(
      service.listAdminBrandsPage({
        search: 'bosch',
        status: MasterDataStatus.ACTIVE,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [activeBrand],
      total: 76,
      page: 2,
      pageSize: 25,
      pageCount: 4,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      OR: [
        { name: { contains: 'bosch', mode: 'insensitive' } },
        { code: { contains: 'bosch', mode: 'insensitive' } },
      ],
    };

    expect(brand.count).toHaveBeenCalledWith({ where });
    expect(brand.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      skip: 25,
      take: 25,
    });
  });

  it('updates selected Brand lifecycle atomically in bulk', async () => {
    const secondBrand = {
      ...activeBrand,
      id: '44444444-4444-4444-8444-444444444444',
      code: 'DENSO',
      name: 'Denso',
      status: MasterDataStatus.DRAFT,
      version: 3,
    };
    const firstDraft = {
      ...activeBrand,
      status: MasterDataStatus.DRAFT,
      version: 2,
    };
    brand.findMany.mockResolvedValue([firstDraft, secondBrand]);
    brand.update
      .mockResolvedValueOnce({
        ...firstDraft,
        status: MasterDataStatus.ACTIVE,
        version: 3,
      })
      .mockResolvedValueOnce({
        ...secondBrand,
        status: MasterDataStatus.ACTIVE,
        version: 4,
      });

    await expect(
      service.bulkUpdateBrandStatus(
        {
          items: [
            { id: firstDraft.id, version: 2 },
            { id: secondBrand.id, version: 3 },
          ],
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      updated: 2,
      items: [
        { id: firstDraft.id, status: MasterDataStatus.ACTIVE, version: 3 },
        { id: secondBrand.id, status: MasterDataStatus.ACTIVE, version: 4 },
      ],
    });

    expect(brand.update).toHaveBeenCalledTimes(2);
    expect(auditLog.create).toHaveBeenCalledTimes(2);
    expect(product.findFirst).not.toHaveBeenCalled();
    expect(partNumber.findFirst).not.toHaveBeenCalled();
  });

  it('routes Brand bulk retirement through the governed lifecycle endpoint', async () => {
    brand.findMany.mockResolvedValue([activeBrand]);

    await expect(
      service.bulkUpdateBrandStatus(
        {
          items: [{ id: brandId, version: 1 }],
          status: MasterDataStatus.DEPRECATED,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(product.findFirst).not.toHaveBeenCalled();
    expect(brand.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('blocks all Brand bulk writes when a selected version is stale', async () => {
    brand.findMany.mockResolvedValue([{ ...activeBrand, version: 2 }]);

    await expect(
      service.bulkUpdateBrandStatus(
        {
          items: [{ id: brandId, version: 1 }],
          status: MasterDataStatus.ARCHIVED,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'BRAND_VERSION_CONFLICT' },
    });

    expect(brand.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('normalizes Brand codes before canonical creation', async () => {
    await service.createBrand(
      {
        code: 'bosch automotive',
        name: ' Bosch ',
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(brand.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'BOSCH_AUTOMOTIVE',
        name: 'Bosch',
        status: MasterDataStatus.ACTIVE,
        createdById: actorId,
        updatedById: actorId,
      }),
      select: expect.any(Object),
    });
  });

  it('normalizes searchable Part Numbers while preserving raw representation', async () => {
    const result = await service.createPartNumber(
      productId,
      {
        issuerBrandId: brandId,
        partNumber: '0 986-494-603',
        rawPartNumber: '0 986 494 603',
        type: PartNumberType.MANUFACTURER,
        isPrimary: false,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(partNumber.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        issuerBrandId: brandId,
        partNumber: '0 986-494-603',
        rawPartNumber: '0 986 494 603',
        normalizedPartNumber: '0986494603',
        articleIdentityKey: brandId + ':0986494603',
        type: PartNumberType.MANUFACTURER,
        status: MasterDataStatus.ACTIVE,
      }),
      select: expect.any(Object),
    });
    expect(result.normalizedPartNumber).toBe('0986494603');
  });

  it('blocks a Manufacturer Part Number already owned by another Article', async () => {
    partNumber.findFirst.mockResolvedValue({
      id: 'existing-id',
      productId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });

    await expect(
      service.createPartNumber(
        productId,
        {
          issuerBrandId: brandId,
          partNumber: '0 986-494-603',
          type: PartNumberType.MANUFACTURER,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_IDENTITY_ALREADY_EXISTS' },
    });

    expect(partNumber.create).not.toHaveBeenCalled();
  });

  it('allows the same OE reference to appear on different Manufacturer Articles', async () => {
    partNumber.findFirst.mockResolvedValue({
      id: 'existing-oe-id',
      productId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });

    await service.createPartNumber(
      productId,
      {
        issuerBrandId: brandId,
        partNumber: '04465-02390',
        type: PartNumberType.OE,
        status: MasterDataStatus.DRAFT,
      },
      actorId,
    );

    expect(partNumber.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        issuerBrandId: brandId,
        normalizedPartNumber: '0446502390',
        articleIdentityKey: null,
        type: PartNumberType.OE,
      }),
      select: expect.any(Object),
    });
  });

  it('requires an explicit issuing Brand for an OE Number', async () => {
    await expect(
      service.createPartNumber(
        productId,
        {
          partNumber: '04465-02390',
          type: PartNumberType.OE,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'OE_NUMBER_ISSUER_BRAND_REQUIRED' },
    });

    expect(partNumber.create).not.toHaveBeenCalled();
  });

  it('rejects OE Numbers as the primary Article identifier', async () => {
    await expect(
      service.createPartNumber(
        productId,
        {
          issuerBrandId: brandId,
          partNumber: '04465-02390',
          type: PartNumberType.OE,
          isPrimary: true,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRIMARY_IDENTIFIER_MUST_BE_MANUFACTURER' },
    });

    expect(partNumber.create).not.toHaveBeenCalled();
  });

  it('blocks a second primary Manufacturer Part Number', async () => {
    partNumber.findFirst.mockResolvedValue({ id: partNumberId });

    await expect(
      service.createPartNumber(
        productId,
        {
          issuerBrandId: brandId,
          partNumber: '0 986 494 604',
          type: PartNumberType.MANUFACTURER,
          isPrimary: true,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'PRIMARY_MANUFACTURER_PART_NUMBER_ALREADY_EXISTS',
      },
    });

    expect(partNumber.create).not.toHaveBeenCalled();
  });

  it('blocks updating a Manufacturer Part Number into another Article identity', async () => {
    partNumber.findFirst
      .mockResolvedValueOnce({
        id: partNumberId,
        productId,
        issuerBrandId: brandId,
        partNumber: '0 986 494 603',
        rawPartNumber: '0 986 494 603',
        normalizedPartNumber: '0986494603',
        type: PartNumberType.MANUFACTURER,
        isPrimary: true,
        status: MasterDataStatus.ACTIVE,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .mockResolvedValueOnce({
        id: 'duplicate-id',
        productId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      });

    await expect(
      service.updatePartNumber(
        productId,
        partNumberId,
        {
          version: 1,
          partNumber: '0 986 494 999',
          isPrimary: false,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_IDENTITY_ALREADY_EXISTS' },
    });

    expect(partNumber.update).not.toHaveBeenCalled();
  });

  it('does not activate Part Numbers for a Draft Product', async () => {
    product.findUnique.mockResolvedValue({
      ...activeProduct,
      status: ProductStatus.DRAFT,
    });

    await expect(
      service.createPartNumber(
        productId,
        {
          issuerBrandId: brandId,
          partNumber: '04465-02390',
          type: PartNumberType.OE,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PART_NUMBER_PRODUCT_NOT_ACTIVE' },
    });

    expect(partNumber.create).not.toHaveBeenCalled();
  });

  it('routes Brand retirement through the governed lifecycle endpoint', async () => {
    await expect(
      service.updateBrand(
        brandId,
        { version: 1, status: MasterDataStatus.DEPRECATED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(product.findFirst).not.toHaveBeenCalled();
    expect(brand.update).not.toHaveBeenCalled();
  });

  it('uses the Article Brand by default for Manufacturer Part Numbers', async () => {
    await service.createPartNumber(
      productId,
      {
        partNumber: '0 986 494 604',
        type: PartNumberType.MANUFACTURER,
        status: MasterDataStatus.DRAFT,
      },
      actorId,
    );

    expect(partNumber.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        issuerBrandId: brandId,
        normalizedPartNumber: '0986494604',
      }),
      select: expect.any(Object),
    });
  });
});
