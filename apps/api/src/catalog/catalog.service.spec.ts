import {
  MasterDataStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
  type Category,
  type ProductFamily,
  type ProductType,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { AdminSortDirection } from '../common/admin-sort.js';
import { ProductTypeAdminSortBy } from './dto/product-type.dto.js';
import { CatalogService } from './catalog.service.js';

describe('CatalogService', () => {
  const category = {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productFamily = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  };
  const productType = {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productTypeAttributeAssignment = { findFirst: vi.fn() };
  const externalStandardMapping = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const masterDataLocalization = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const adminImportJob = { create: vi.fn() };
  const database = {
    category,
    productFamily,
    productType,
    productTypeAttributeAssignment,
    externalStandardMapping,
    masterDataLocalization,
    auditLog,
    adminImportJob,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          category,
          productFamily,
          productType,
          productTypeAttributeAssignment,
          externalStandardMapping,
          masterDataLocalization,
          auditLog,
          adminImportJob,
        }),
    ),
  };
  const service = new CatalogService(database as unknown as DatabaseService);
  const now = new Date('2026-09-23T18:00:00.000Z');
  const root: Category = {
    id: '11111111-1111-4111-8111-111111111111',
    parentId: null,
    code: 'SPARE_PARTS',
    name: 'Spare Parts',
    slug: 'spare-parts',
    description: null,
    sortOrder: 0,
    level: 0,
    isLeaf: true,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    updatedById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: now,
    updatedAt: now,
  };

  const brakeGroup: ProductFamily = {
    id: '22222222-2222-4222-8222-222222222222',
    categoryId: root.id,
    code: 'DISC_BRAKES',
    name: 'Disc Brake Components',
    description: null,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: root.createdById,
    updatedById: root.updatedById,
    createdAt: now,
    updatedAt: now,
  };

  const brakePad: ProductType = {
    id: '33333333-3333-4333-8333-333333333333',
    categoryId: root.id,
    productFamilyId: brakeGroup.id,
    parentId: null,
    code: 'BRAKE_PAD',
    name: 'Brake Pad',
    slug: 'brake-pad',
    description: null,
    sortOrder: 0,
    brandRequirement: ProductTypeRequirementLevel.OPTIONAL,
    identifierRequirement: ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
    gtinRequirement: ProductTypeRequirementLevel.OPTIONAL,
    oemReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
    crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
    fitmentRequirement: ProductTypeRequirementLevel.REQUIRED,
    imageRequirement: ProductTypeRequirementLevel.REQUIRED,
    minimumImageCount: 1,
    maximumImageCount: 20,
    documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
    minimumDocumentCount: 0,
    priceRequirement: ProductTypeRequirementLevel.REQUIRED,
    stockRequirement: ProductTypeRequirementLevel.REQUIRED,
    conditionRequirement: ProductTypeRequirementLevel.REQUIRED,
    warrantyRequirement: ProductTypeRequirementLevel.OPTIONAL,
    packageDimensionsRequirement: ProductTypeRequirementLevel.OPTIONAL,
    packageWeightRequirement: ProductTypeRequirementLevel.OPTIONAL,
    discountRequirement: ProductTypeRequirementLevel.OPTIONAL,
    transportRequirement: ProductTypeRequirementLevel.OPTIONAL,
    specialHandlingRequirement: ProductTypeRequirementLevel.OPTIONAL,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    currentSchemaVersionId: null,
    createdById: root.createdById,
    updatedById: root.updatedById,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    productFamily.findUnique.mockResolvedValue(brakeGroup);
    productFamily.findMany.mockResolvedValue([]);
    productType.findFirst.mockResolvedValue(null);
    productTypeAttributeAssignment.findFirst.mockResolvedValue(null);
    auditLog.create.mockResolvedValue({});
    adminImportJob.create.mockResolvedValue({});
  });

  it('publishes only active categories in navigation order', async () => {
    category.findMany.mockResolvedValue([root]);

    await expect(service.listPublishedCategories()).resolves.toEqual([root]);
    expect(category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: MasterDataStatus.ACTIVE },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
    );
  });

  it('pages Categories with server-side search and legacy parent context', async () => {
    category.count.mockResolvedValue(57);
    category.findMany.mockResolvedValue([{ ...root, parent: null }]);

    await expect(
      service.listAdminCategoriesPage({
        search: 'spare',
        status: MasterDataStatus.ACTIVE,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [{ ...root, parentName: null }],
      total: 57,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      parentId: undefined,
      OR: [
        { name: { contains: 'spare', mode: 'insensitive' } },
        { code: { contains: 'spare', mode: 'insensitive' } },
        { slug: { contains: 'spare', mode: 'insensitive' } },
        { description: { contains: 'spare', mode: 'insensitive' } },
      ],
    };
    expect(category.count).toHaveBeenCalledWith({ where });
    expect(category.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
      skip: 25,
      take: 25,
    });
  });

  it('supports root-only Category lookup for canonical hierarchy pickers', async () => {
    category.count.mockResolvedValue(1);
    category.findMany.mockResolvedValue([{ ...root, parent: null }]);

    await service.listAdminCategoriesPage({
      rootOnly: true,
      page: 1,
      pageSize: 20,
    });

    expect(category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: null }),
        skip: 0,
        take: 20,
      }),
    );
  });

  it('loads one Category directly for hierarchy context', async () => {
    category.findUnique.mockResolvedValue(root);

    await expect(service.getAdminCategory(root.id)).resolves.toEqual(root);
    expect(category.findUnique).toHaveBeenCalledWith({
      where: { id: root.id },
      select: expect.any(Object),
    });
  });

  it('creates only a root Category for the AUTODOC-style hierarchy', async () => {
    const createdCategory: Category = {
      ...root,
      id: '55555555-5555-4555-8555-555555555555',
      code: 'BRAKES',
      name: 'Brakes',
      slug: 'brakes',
      status: MasterDataStatus.DRAFT,
    };
    category.create.mockResolvedValue(createdCategory);

    const created = await service.createCategory(
      {
        code: 'BRAKES',
        name: ' Brakes ',
        slug: 'brakes',
      },
      root.createdById,
    );

    expect(created).toMatchObject({
      code: 'BRAKES',
      parentId: null,
      level: 0,
    });
    expect(category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: null,
        level: 0,
        isLeaf: true,
        name: 'Brakes',
      }),
    });
  });

  it('rejects an update made from a stale category version', async () => {
    category.findUnique.mockResolvedValue({ ...root, version: 2 });

    await expect(
      service.updateCategory(
        root.id,
        { version: 1, name: 'Parts' },
        root.updatedById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CATEGORY_VERSION_CONFLICT' },
    });
    expect(category.update).not.toHaveBeenCalled();
  });

  it('routes Category retirement through the governed lifecycle endpoint', async () => {
    category.findUnique.mockResolvedValue(root);

    await expect(
      service.updateCategory(
        root.id,
        { version: 1, status: MasterDataStatus.DEPRECATED },
        root.updatedById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(productType.findFirst).not.toHaveBeenCalled();
    expect(category.update).not.toHaveBeenCalled();
  });

  it('updates with an atomic version predicate and records before/after state', async () => {
    const updated = { ...root, name: 'Automotive Parts', version: 2 };
    category.findUnique.mockResolvedValue(root);
    category.update.mockResolvedValue(updated);

    const result = await service.updateCategory(
      root.id,
      { version: 1, name: ' Automotive Parts ' },
      root.updatedById,
    );
    expect(result).toMatchObject({ name: 'Automotive Parts', version: 2 });
    expect(result).not.toHaveProperty('updatedById');

    expect(category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: root.id, version: 1 },
        data: expect.objectContaining({
          name: 'Automotive Parts',
          version: { increment: 1 },
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CATEGORY_UPDATED' }),
      }),
    );
  });

  it('lists product types with category, Part Group, and status filters', async () => {
    productType.findMany.mockResolvedValue([brakePad]);

    await expect(
      service.listAdminProductTypes({
        categoryId: root.id,
        productFamilyId: brakeGroup.id,
        status: MasterDataStatus.ACTIVE,
      }),
    ).resolves.toEqual([brakePad]);

    expect(productType.findMany).toHaveBeenCalledWith({
      where: {
        status: MasterDataStatus.ACTIVE,
        categoryId: root.id,
        productFamilyId: brakeGroup.id,
      },
      select: expect.any(Object),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('pages Product Types with server-side search and deterministic ordering', async () => {
    productType.count.mockResolvedValue(61);
    productType.findMany.mockResolvedValue([brakePad]);

    await expect(
      service.listAdminProductTypesPage({
        categoryId: root.id,
        productFamilyId: brakeGroup.id,
        status: MasterDataStatus.ACTIVE,
        search: 'brake',
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [brakePad],
      total: 61,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      categoryId: root.id,
      productFamilyId: brakeGroup.id,
      OR: [
        { name: { contains: 'brake', mode: 'insensitive' } },
        { code: { contains: 'brake', mode: 'insensitive' } },
        { slug: { contains: 'brake', mode: 'insensitive' } },
        { description: { contains: 'brake', mode: 'insensitive' } },
      ],
    };

    expect(productType.count).toHaveBeenCalledWith({ where });
    expect(productType.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
      skip: 25,
      take: 25,
    });
  });

  it('sorts Product Type pages explicitly on the server', async () => {
    productType.count.mockResolvedValue(1);
    productType.findMany.mockResolvedValue([brakePad]);

    await service.listAdminProductTypesPage({
      sortBy: ProductTypeAdminSortBy.NAME,
      sortDirection: AdminSortDirection.DESC,
      page: 1,
      pageSize: 50,
    });

    expect(productType.findMany).toHaveBeenCalledWith({
      where: {
        status: undefined,
        categoryId: undefined,
        productFamilyId: undefined,
      },
      select: expect.any(Object),
      orderBy: [{ name: 'desc' }, { code: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 50,
    });

    productType.findMany.mockClear();

    await service.listAdminProductTypesPage({
      sortBy: ProductTypeAdminSortBy.UPDATED_AT,
      sortDirection: AdminSortDirection.DESC,
      page: 1,
      pageSize: 50,
    });

    expect(productType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
    );
  });

  it('loads one Product Type directly instead of scanning the library', async () => {
    productType.findUnique.mockResolvedValue(brakePad);

    await expect(service.getAdminProductType(brakePad.id)).resolves.toEqual(
      brakePad,
    );
    expect(productType.findUnique).toHaveBeenCalledWith({
      where: { id: brakePad.id },
      select: expect.any(Object),
    });
    expect(productType.findMany).not.toHaveBeenCalled();
  });

  it('summarizes Product Types with count queries only', async () => {
    productType.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(82)
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(31);

    await expect(service.getAdminProductTypeSummary()).resolves.toEqual({
      total: 120,
      published: 82,
      draft: 14,
      needsPublication: 31,
    });
    expect(productType.findMany).not.toHaveBeenCalled();
    expect(productType.count).toHaveBeenCalledTimes(4);
  });

  it('creates a product type under an existing category and records audit evidence', async () => {
    category.findUnique.mockResolvedValue(root);
    productType.create.mockResolvedValue(brakePad);

    const created = await service.createProductType(
      {
        categoryId: root.id,
        productFamilyId: brakeGroup.id,
        code: 'BRAKE_PAD',
        name: ' Brake Pad ',
        slug: 'brake-pad',
        status: MasterDataStatus.ACTIVE,
      },
      root.createdById,
    );

    expect(created).toMatchObject({
      categoryId: root.id,
      code: 'BRAKE_PAD',
      name: 'Brake Pad',
    });
    expect(created).not.toHaveProperty('createdById');
    expect(productType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: root.id,
        productFamilyId: brakeGroup.id,
        parentId: null,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        status: MasterDataStatus.ACTIVE,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PRODUCT_TYPE_CREATED' }),
      }),
    );
  });

  it('persists seller-facing Product Type requirements separately from actual values', async () => {
    category.findUnique.mockResolvedValue(root);
    productType.create.mockResolvedValue({
      ...brakePad,
      brandRequirement: ProductTypeRequirementLevel.REQUIRED,
      identifierRequirement:
        ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
      fitmentRequirement: ProductTypeRequirementLevel.REQUIRED,
      imageRequirement: ProductTypeRequirementLevel.REQUIRED,
      minimumImageCount: 2,
    });

    await service.createProductType(
      {
        categoryId: root.id,
        productFamilyId: brakeGroup.id,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        slug: 'brake-pad',
        brandRequirement: ProductTypeRequirementLevel.REQUIRED,
        identifierRequirement:
          ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
        gtinRequirement: ProductTypeRequirementLevel.REQUIRED,
        oemReferenceRequirement: ProductTypeRequirementLevel.REQUIRED,
        crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
        fitmentRequirement: ProductTypeRequirementLevel.REQUIRED,
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 2,
        maximumImageCount: 4,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
        priceRequirement: ProductTypeRequirementLevel.REQUIRED,
        stockRequirement: ProductTypeRequirementLevel.REQUIRED,
        conditionRequirement: ProductTypeRequirementLevel.REQUIRED,
        warrantyRequirement: ProductTypeRequirementLevel.OPTIONAL,
      },
      root.createdById,
    );

    expect(productType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brandRequirement: ProductTypeRequirementLevel.REQUIRED,
          identifierRequirement:
            ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
          gtinRequirement: ProductTypeRequirementLevel.REQUIRED,
          oemReferenceRequirement: ProductTypeRequirementLevel.REQUIRED,
          crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
          fitmentRequirement: ProductTypeRequirementLevel.REQUIRED,
          imageRequirement: ProductTypeRequirementLevel.REQUIRED,
          minimumImageCount: 2,
          maximumImageCount: 4,
          documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
          minimumDocumentCount: 0,
          priceRequirement: ProductTypeRequirementLevel.REQUIRED,
          stockRequirement: ProductTypeRequirementLevel.REQUIRED,
          conditionRequirement: ProductTypeRequirementLevel.REQUIRED,
          warrantyRequirement: ProductTypeRequirementLevel.OPTIONAL,
        }),
      }),
    );
  });

  it('rejects image maximum smaller than required minimum before creating a Product Type', async () => {
    category.findUnique.mockResolvedValue(root);
    await expect(service.createProductType({
      categoryId: root.id,
      productFamilyId: brakeGroup.id,
      code: 'BRAKE_PAD',
      name: 'Brake Pad',
      slug: 'brake-pad',
      imageRequirement: ProductTypeRequirementLevel.REQUIRED,
      minimumImageCount: 4,
      maximumImageCount: 3,
    }, root.createdById)).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_IMAGE_COUNT_RANGE_INVALID' },
    });
    expect(productType.create).not.toHaveBeenCalled();
  });

  it('rejects a Product Type when its Part Group belongs to another Category', async () => {
    category.findUnique.mockResolvedValue(root);
    productFamily.findUnique.mockResolvedValue({
      ...brakeGroup,
      categoryId: '66666666-6666-4666-8666-666666666666',
    });

    await expect(
      service.createProductType(
        {
          categoryId: root.id,
          productFamilyId: brakeGroup.id,
          code: 'BRAKE_PAD',
          name: 'Brake Pad',
          slug: 'brake-pad',
        },
        root.createdById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_PART_GROUP_CATEGORY_MISMATCH' },
    });
    expect(productType.create).not.toHaveBeenCalled();
  });

  it('rejects an Active Product Type under an inactive Part Group', async () => {
    category.findUnique.mockResolvedValue(root);
    productFamily.findUnique.mockResolvedValue({
      ...brakeGroup,
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.createProductType(
        {
          categoryId: root.id,
          productFamilyId: brakeGroup.id,
          code: 'BRAKE_PAD',
          name: 'Brake Pad',
          slug: 'brake-pad',
          status: MasterDataStatus.ACTIVE,
        },
        root.createdById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_PART_GROUP_NOT_ACTIVE' },
    });
    expect(productType.create).not.toHaveBeenCalled();
  });

  it('does not activate a product type beneath an inactive category', async () => {
    category.findUnique.mockResolvedValue({
      ...root,
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.createProductType(
        {
          categoryId: root.id,
          productFamilyId: brakeGroup.id,
          code: 'BRAKE_PAD',
          name: 'Brake Pad',
          slug: 'brake-pad',
          status: MasterDataStatus.ACTIVE,
        },
        root.createdById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE' },
    });
    expect(productType.create).not.toHaveBeenCalled();
  });

  it('rejects a stale product type update', async () => {
    productType.findUnique.mockResolvedValue({ ...brakePad, version: 2 });

    await expect(
      service.updateProductType(
        brakePad.id,
        { version: 1, name: 'Front Brake Pad' },
        root.updatedById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_VERSION_CONFLICT' },
    });
    expect(productType.update).not.toHaveBeenCalled();
  });


  it('does not let Product Type editing bypass lifecycle governance', async () => {
    productType.findUnique.mockResolvedValue(brakePad);

    await expect(
      service.updateProductType(
        brakePad.id,
        { version: 1, status: MasterDataStatus.ARCHIVED },
        root.updatedById,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED',
      },
    });

    expect(productTypeAttributeAssignment.findFirst).not.toHaveBeenCalled();
    expect(productType.update).not.toHaveBeenCalled();
  });

  it('updates product type fields while keeping the code immutable', async () => {
    const updated = {
      ...brakePad,
      name: 'Front Brake Pad',
      slug: 'front-brake-pad',
      version: 2,
    };
    productType.findUnique.mockResolvedValue(brakePad);
    category.findUnique.mockResolvedValue(root);
    productFamily.findUnique.mockResolvedValue(brakeGroup);
    productType.update.mockResolvedValue(updated);

    const result = await service.updateProductType(
      brakePad.id,
      {
        version: 1,
        name: ' Front Brake Pad ',
        slug: 'front-brake-pad',
      },
      root.updatedById,
    );

    expect(result).toMatchObject({
      code: 'BRAKE_PAD',
      name: 'Front Brake Pad',
      version: 2,
    });
    expect(productType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: brakePad.id, version: 1 },
        data: expect.not.objectContaining({ code: expect.anything() }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PRODUCT_TYPE_UPDATED' }),
      }),
    );
  });


  it('exports Product Types with canonical hierarchy codes and seller requirements', async () => {
    productType.findMany.mockResolvedValue([brakePad]);
    category.findMany.mockResolvedValue([{ id: root.id, code: root.code }]);
    productFamily.findMany.mockResolvedValue([
      { id: brakeGroup.id, code: brakeGroup.code },
    ]);

    const result = await service.exportProductTypesCsv({
      status: MasterDataStatus.ACTIVE,
      sortBy: ProductTypeAdminSortBy.CODE,
      sortDirection: AdminSortDirection.ASC,
    });

    expect(result.filename).toBe('lemekinaye-product-types.csv');
    expect(result.csv).toContain(
      'code,name,categoryCode,partGroupCode,description,sortOrder,brandRequirement,identifierRequirement,gtinRequirement',
    );
    expect(result.csv).toContain(
      'BRAKE_PAD,Brake Pad,SPARE_PARTS,DISC_BRAKES',
    );
    expect(result.csv).toContain(
      'OPTIONAL,ANY_PART_NUMBER,OPTIONAL,OPTIONAL,OPTIONAL,REQUIRED',
    );
  });

  it('previews a valid Product Type CSV without writing data', async () => {
    category.findMany.mockResolvedValue([
      {
        id: root.id,
        code: root.code,
        status: root.status,
        parentId: null,
        level: 0,
      },
    ]);
    productFamily.findMany.mockResolvedValue([
      {
        id: brakeGroup.id,
        code: brakeGroup.code,
        categoryId: root.id,
        status: brakeGroup.status,
      },
    ]);
    productType.findMany.mockResolvedValue([]);

    const preview = await service.previewProductTypeCsvImport({
      csv:
        'code,name,categoryCode,partGroupCode,description,sortOrder,brandRequirement,identifierRequirement,fitmentRequirement,imageRequirement,minimumImageCount,priceRequirement,stockRequirement,conditionRequirement,status\n' +
        'OIL_FILTER,Oil Filter,SPARE_PARTS,DISC_BRAKES,,10,OPTIONAL,ANY_PART_NUMBER,REQUIRED,REQUIRED,1,REQUIRED,REQUIRED,REQUIRED,DRAFT\n',
    });

    expect(preview).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    expect(preview.rows[0]).toMatchObject({
      code: 'OIL_FILTER',
      categoryCode: 'SPARE_PARTS',
      partGroupCode: 'DISC_BRAKES',
      errors: [],
    });
    expect(productType.create).not.toHaveBeenCalled();
  });

  it('returns hierarchy, duplicate and lifecycle errors in Product Type preview', async () => {
    category.findMany.mockResolvedValue([
      {
        id: root.id,
        code: root.code,
        status: MasterDataStatus.INACTIVE,
        parentId: null,
        level: 0,
      },
    ]);
    productFamily.findMany.mockResolvedValue([
      {
        id: brakeGroup.id,
        code: brakeGroup.code,
        categoryId: '99999999-9999-4999-8999-999999999999',
        status: MasterDataStatus.INACTIVE,
      },
    ]);
    productType.findMany.mockResolvedValue([
      { code: 'BRAKE_PAD', slug: 'brake-pad' },
    ]);

    const preview = await service.previewProductTypeCsvImport({
      csv:
        'code,name,categoryCode,partGroupCode,status\n' +
        'BRAKE_PAD,Brake Pad,SPARE_PARTS,DISC_BRAKES,ACTIVE\n',
    });

    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        'Part Group does not belong to the selected Category',
        'Product Type code already exists',
        'Generated Product Type slug already exists',
        'An Active Product Type requires an Active Category',
        'An Active Product Type requires an Active Part Group',
      ]),
    );
  });

  it('commits valid Product Type CSV rows atomically and audits each create', async () => {
    category.findMany.mockResolvedValue([
      {
        id: root.id,
        code: root.code,
        status: root.status,
        parentId: null,
        level: 0,
      },
    ]);
    productFamily.findMany.mockResolvedValue([
      {
        id: brakeGroup.id,
        code: brakeGroup.code,
        categoryId: root.id,
        status: brakeGroup.status,
      },
    ]);
    productType.findMany.mockResolvedValue([]);
    category.findUnique.mockResolvedValue(root);
    productFamily.findUnique.mockResolvedValue(brakeGroup);
    productType.create
      .mockResolvedValueOnce({
        ...brakePad,
        id: '44444444-4444-4444-8444-444444444444',
        code: 'OIL_FILTER',
        name: 'Oil Filter',
        slug: 'oil-filter',
        status: MasterDataStatus.DRAFT,
      })
      .mockResolvedValueOnce({
        ...brakePad,
        id: '55555555-5555-4555-8555-555555555555',
        code: 'AIR_FILTER',
        name: 'Air Filter',
        slug: 'air-filter',
        status: MasterDataStatus.DRAFT,
      });

    const result = await service.commitProductTypeCsvImport(
      {
        csv:
          'code,name,categoryCode,partGroupCode,status\n' +
          'OIL_FILTER,Oil Filter,SPARE_PARTS,DISC_BRAKES,DRAFT\n' +
          'AIR_FILTER,Air Filter,SPARE_PARTS,DISC_BRAKES,DRAFT\n',
      },
      root.createdById,
    );

    expect(result).toEqual({
      createdCount: 2,
      createdCodes: ['OIL_FILTER', 'AIR_FILTER'],
    });
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(productType.create).toHaveBeenCalledTimes(2);
    expect(auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('refuses to commit invalid Product Type CSV rows', async () => {
    category.findMany.mockResolvedValue([]);
    productFamily.findMany.mockResolvedValue([]);
    productType.findMany.mockResolvedValue([]);

    await expect(
      service.commitProductTypeCsvImport(
        {
          csv:
            'code,name,categoryCode,partGroupCode\n' +
            'OIL_FILTER,Oil Filter,MISSING,MISSING\n',
        },
        root.createdById,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_IMPORT_INVALID' },
    });
    expect(productType.create).not.toHaveBeenCalled();
  });


  it('lists external-standard mappings only for the selected Product Type', async () => {
    productType.findUnique.mockResolvedValue({ id: brakePad.id });
    externalStandardMapping.findMany.mockResolvedValue([
      {
        id: '77777777-7777-4777-8777-777777777777',
        entityType: 'ProductType',
        entityId: brakePad.id,
        provider: 'TecAlliance',
        standard: 'TecDoc',
        externalEntityType: 'GenericArticle',
        externalIdentifier: '402',
        externalVersion: null,
        notes: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await service.listProductTypeExternalMappings(brakePad.id);

    expect(result).toHaveLength(1);
    expect(result[0]?.externalIdentifier).toBe('402');
    expect(externalStandardMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'ProductType', entityId: brakePad.id },
      }),
    );
  });

  it('creates a Product Type external mapping and audits the canonical target', async () => {
    const mapping = {
      id: '77777777-7777-4777-8777-777777777777',
      entityType: 'ProductType',
      entityId: brakePad.id,
      provider: 'TecAlliance',
      standard: 'TecDoc',
      externalEntityType: 'GenericArticle',
      externalIdentifier: '402',
      externalVersion: null,
      notes: 'Brake pad generic article.',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    productType.findUnique.mockResolvedValue({
      id: brakePad.id,
      code: brakePad.code,
    });
    externalStandardMapping.create.mockResolvedValue(mapping);

    const result = await service.createProductTypeExternalMapping(
      brakePad.id,
      {
        provider: ' TecAlliance ',
        standard: 'TecDoc',
        externalEntityType: 'GenericArticle',
        externalIdentifier: '402',
        notes: 'Brake pad generic article.',
      },
      root.createdById,
    );

    expect(result).toEqual(mapping);
    expect(externalStandardMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'ProductType',
          entityId: brakePad.id,
          provider: 'TecAlliance',
          externalIdentifier: '402',
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'EXTERNAL_STANDARD_MAPPING_CREATED',
          entityType: 'ExternalStandardMapping',
        }),
      }),
    );
  });

  it('updates and removes Product Type external mappings with optimistic versions', async () => {
    const mappingId = '77777777-7777-4777-8777-777777777777';
    const current = {
      id: mappingId,
      entityType: 'ProductType',
      entityId: brakePad.id,
      provider: 'TecAlliance',
      standard: 'TecDoc',
      externalEntityType: 'GenericArticle',
      externalIdentifier: '402',
      externalVersion: null,
      notes: null,
      version: 2,
      createdAt: now,
      updatedAt: now,
    };
    productType.findUnique.mockResolvedValue({
      id: brakePad.id,
      code: brakePad.code,
    });
    externalStandardMapping.findUnique.mockResolvedValue(current);
    externalStandardMapping.update.mockResolvedValue({
      ...current,
      notes: 'Verified mapping.',
      version: 3,
    });
    externalStandardMapping.delete.mockResolvedValue(current);

    const updated = await service.updateProductTypeExternalMapping(
      brakePad.id,
      mappingId,
      { version: 2, notes: 'Verified mapping.' },
      root.updatedById,
    );
    expect(updated.version).toBe(3);
    expect(externalStandardMapping.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mappingId, version: 2 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );

    externalStandardMapping.findUnique.mockResolvedValue({
      ...current,
      version: 3,
    });
    await service.deleteProductTypeExternalMapping(
      brakePad.id,
      mappingId,
      3,
      root.updatedById,
    );
    expect(externalStandardMapping.delete).toHaveBeenCalledWith({
      where: { id: mappingId, version: 3 },
    });
  });


  it('lists localized Product Type content without duplicating the canonical record', async () => {
    productType.findUnique.mockResolvedValue({ id: brakePad.id });
    masterDataLocalization.findMany.mockResolvedValue([
      {
        id: '88888888-8888-4888-8888-888888888888',
        entityType: 'ProductType',
        entityId: brakePad.id,
        locale: 'am',
        name: 'የፍሬን ፓድ',
        description: 'የተተረጎመ የምርት አይነት ስም',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await service.listProductTypeLocalizations(brakePad.id);

    expect(result).toHaveLength(1);
    expect(result[0]?.locale).toBe('am');
    expect(masterDataLocalization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'ProductType', entityId: brakePad.id },
      }),
    );
  });

  it('creates a normalized locale translation and audits the canonical target', async () => {
    const localization = {
      id: '88888888-8888-4888-8888-888888888888',
      entityType: 'ProductType',
      entityId: brakePad.id,
      locale: 'am',
      name: 'የፍሬን ፓድ',
      description: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    productType.findUnique.mockResolvedValue({
      id: brakePad.id,
      code: brakePad.code,
    });
    masterDataLocalization.create.mockResolvedValue(localization);

    const result = await service.createProductTypeLocalization(
      brakePad.id,
      {
        locale: ' AM ',
        name: ' የፍሬን ፓድ ',
      },
      root.createdById,
    );

    expect(result.locale).toBe('am');
    expect(masterDataLocalization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'ProductType',
          entityId: brakePad.id,
          locale: 'am',
          name: 'የፍሬን ፓድ',
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MASTER_DATA_LOCALIZATION_CREATED',
          entityType: 'MasterDataLocalization',
        }),
      }),
    );
  });

  it('updates and removes localized Product Type content with optimistic versions', async () => {
    const localizationId = '88888888-8888-4888-8888-888888888888';
    const current = {
      id: localizationId,
      entityType: 'ProductType',
      entityId: brakePad.id,
      locale: 'am',
      name: 'የፍሬን ፓድ',
      description: null,
      version: 2,
      createdAt: now,
      updatedAt: now,
    };
    productType.findUnique.mockResolvedValue({
      id: brakePad.id,
      code: brakePad.code,
    });
    masterDataLocalization.findUnique.mockResolvedValue(current);
    masterDataLocalization.update.mockResolvedValue({
      ...current,
      description: 'የተዘመነ መግለጫ',
      version: 3,
    });
    masterDataLocalization.delete.mockResolvedValue(current);

    const updated = await service.updateProductTypeLocalization(
      brakePad.id,
      localizationId,
      { version: 2, description: 'የተዘመነ መግለጫ' },
      root.updatedById,
    );
    expect(updated.version).toBe(3);
    expect(masterDataLocalization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: localizationId, version: 2 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );

    masterDataLocalization.findUnique.mockResolvedValue({
      ...current,
      version: 3,
    });
    await service.deleteProductTypeLocalization(
      brakePad.id,
      localizationId,
      3,
      root.updatedById,
    );
    expect(masterDataLocalization.delete).toHaveBeenCalledWith({
      where: { id: localizationId, version: 3 },
    });
  });

});
