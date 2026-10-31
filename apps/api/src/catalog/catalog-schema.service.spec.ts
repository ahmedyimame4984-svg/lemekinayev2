import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { CatalogSchemaService } from './catalog-schema.service.js';

describe('CatalogSchemaService', () => {
  const productType = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const category = { findUnique: vi.fn(), update: vi.fn() };
  const productFamily = { findUnique: vi.fn(), update: vi.fn() };
  const productTypeAttributeAssignment = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  };
  const productTypeSchemaVersion = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    productType,
    productTypeAttributeAssignment,
    productTypeSchemaVersion,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          productType,
          category,
          productFamily,
          productTypeAttributeAssignment,
          productTypeSchemaVersion,
          auditLog,
        }),
    ),
  };
  const service = new CatalogSchemaService(
    database as unknown as DatabaseService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const productTypeId = '33333333-3333-4333-8333-333333333333';
  const partGroupId = '22222222-2222-4222-8222-222222222222';
  const attributeId = '55555555-5555-4555-8555-555555555555';
  const assignmentId = '77777777-7777-4777-8777-777777777777';
  const schemaId = '88888888-8888-4888-8888-888888888888';
  const publishedAt = new Date('2026-09-27T17:30:00.000Z');

  const activeProductType = {
    id: productTypeId,
    categoryId: '11111111-1111-4111-8111-111111111111',
    productFamilyId: partGroupId,
    code: 'BRAKE_PAD',
    name: 'Brake Pad',
    slug: 'brake-pad',
    brandRequirement: ProductTypeRequirementLevel.REQUIRED,
    identifierRequirement:
      ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
    gtinRequirement: ProductTypeRequirementLevel.REQUIRED,
    oemReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
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
    status: MasterDataStatus.ACTIVE,
    version: 4,
    currentSchemaVersionId: null,
  };

  const activeAssignment = {
    id: assignmentId,
    requirement: ProductTypeAttributeRequirement.MANDATORY,
    displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
    displayOrder: 10,
    validationRule: { minLength: 2 },
    conditionalRule: null,
    defaultUnitId: null,
    searchable: true,
    filterable: true,
    comparable: true,
    variantDefining: false,
    marketplaceVisible: true,
    sellerEditable: true,
    status: MasterDataStatus.ACTIVE,
    defaultUnit: null,
    attribute: {
      id: attributeId,
      groupId: '12121212-1212-4212-8212-121212121212',
      optionSetId: '13131313-1313-4313-8313-131313131313',
      unitDimensionId: null,
      defaultUnitId: null,
      code: 'ATTR_POSITION',
      name: 'Position',
      dataType: AttributeDataType.SELECT,
      scope: AttributeScope.PRODUCT,
      valueSource: AttributeValueSource.STATIC,
      unit: null,
      description: 'Installation position',
      exampleValue: null,
      validationRule: { maxLength: 12 },
      repeatable: false,
      translatable: false,
      status: MasterDataStatus.ACTIVE,
      group: {
        id: '12121212-1212-4212-8212-121212121212',
        code: 'POSITION',
        name: 'Position & Installation',
      },
      optionSet: {
        id: '13131313-1313-4313-8313-131313131313',
        code: 'POSITION',
        name: 'Vehicle Position',
        values: [
          {
            id: '14141414-1414-4414-8414-141414141414',
            code: 'FRONT',
            label: 'Front',
            description: null,
            sortOrder: 1,
          },
          {
            id: '15151515-1515-4515-8515-151515151515',
            code: 'REAR',
            label: 'Rear',
            description: null,
            sortOrder: 2,
          },
        ],
      },
      unitDimension: null,
      defaultUnit: null,
      aliases: [
        {
          alias: 'Installation Position',
          locale: 'en',
        },
      ],
      allowedValues: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'LEGACY_FRONT',
          label: 'Legacy Front',
          description: null,
          sortOrder: 1,
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    productType.findUnique.mockResolvedValue(activeProductType);
    category.findUnique.mockResolvedValue({
      id: activeProductType.categoryId,
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });
    productFamily.findUnique.mockResolvedValue({
      id: partGroupId,
      categoryId: activeProductType.categoryId,
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      activeAssignment,
    ]);
    productTypeSchemaVersion.findFirst.mockResolvedValue(null);
    productType.update.mockResolvedValue({});
    auditLog.create.mockResolvedValue({});
    productTypeSchemaVersion.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: schemaId,
        productTypeId,
        schemaVersion: data.schemaVersion,
        schemaHash: data.schemaHash,
        snapshot: data.snapshot,
        publishedById: actorId,
        publishedAt,
      }),
    );
  });

  it('publishes an immutable versioned snapshot of active assignment configuration', async () => {
    const result = await service.publish(
      productTypeId,
      { productTypeVersion: 4 },
      actorId,
    );

    expect(result).toMatchObject({
      id: schemaId,
      productTypeId,
      schemaVersion: 1,
      publishedAt,
    });
    expect(result.schemaHash).toMatch(/^[a-f0-9]{64}$/);

    expect(productTypeAttributeAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productTypeId,
          status: {
            in: [MasterDataStatus.ACTIVE, MasterDataStatus.DRAFT],
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      }),
    );

    expect(productTypeSchemaVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productTypeId,
        schemaVersion: 1,
        schemaHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        publishedById: actorId,
        snapshot: expect.objectContaining({
          productType: expect.objectContaining({
            id: productTypeId,
            code: 'BRAKE_PAD',
          }),
          schemaKind: 'PRODUCT_TYPE_SCHEMA',
          contractVersion: 2,
          articleRequirements: {
            brand: ProductTypeRequirementLevel.REQUIRED,
            identifier:
              ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
            gtin: ProductTypeRequirementLevel.REQUIRED,
            oeReference: ProductTypeRequirementLevel.OPTIONAL,
            crossReference: ProductTypeRequirementLevel.OPTIONAL,
            fitment: ProductTypeRequirementLevel.REQUIRED,
            image: ProductTypeRequirementLevel.REQUIRED,
            minimumImageCount: 2,
            maximumImageCount: 4,
            document: ProductTypeRequirementLevel.OPTIONAL,
            minimumDocumentCount: 0,
          },
          offerRequirements: {
            price: ProductTypeRequirementLevel.REQUIRED,
            stock: ProductTypeRequirementLevel.REQUIRED,
            condition: ProductTypeRequirementLevel.REQUIRED,
            warranty: ProductTypeRequirementLevel.OPTIONAL,
          },
          searchableAttributeCodes: ['ATTR_POSITION'],
          filterableAttributeCodes: ['ATTR_POSITION'],
          comparableAttributeCodes: ['ATTR_POSITION'],
          attributes: [
            expect.objectContaining({
              assignmentId,
              attributeId,
              code: 'ATTR_POSITION',
              requirement: ProductTypeAttributeRequirement.MANDATORY,
              group: expect.objectContaining({
                code: 'POSITION',
                name: 'Position & Installation',
              }),
              optionSet: expect.objectContaining({
                code: 'POSITION',
                name: 'Vehicle Position',
              }),
              comparable: true,
              aliases: [
                expect.objectContaining({
                  alias: 'Installation Position',
                  locale: 'en',
                }),
              ],
              validationRule: { maxLength: 12, minLength: 2 },
              controlledValues: [
                expect.objectContaining({ code: 'FRONT' }),
                expect.objectContaining({ code: 'REAR' }),
              ],
            }),
          ],
        }),
      }),
    });

    expect(productType.update).toHaveBeenCalledWith({
      where: { id: productTypeId, version: 4 },
      data: {
        status: MasterDataStatus.ACTIVE,
        currentSchemaVersionId: schemaId,
        version: { increment: 1 },
        updatedById: actorId,
      },
    });

    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_SCHEMA_PUBLISHED',
          entityType: 'ProductTypeSchemaVersion',
          entityId: schemaId,
        }),
      }),
    );
  });

  it('rejects conflicting inherited and Product Type validation ranges at publication', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      {
        ...activeAssignment,
        validationRule: { maxLength: 4 },
        attribute: {
          ...activeAssignment.attribute,
          validationRule: { minLength: 8 },
        },
      },
    ]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_LENGTH_RANGE_INVALID' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('requires every published Technical Attribute to belong to a group', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      {
        ...activeAssignment,
        attribute: {
          ...activeAssignment.attribute,
          groupId: null,
          group: null,
        },
      },
    ]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_ATTRIBUTE_GROUP_REQUIRED' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('requires active controlled values for STATIC select criteria', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      {
        ...activeAssignment,
        attribute: {
          ...activeAssignment.attribute,
          optionSet: {
            ...activeAssignment.attribute.optionSet,
            values: [],
          },
          allowedValues: [],
        },
      },
    ]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_ALLOWED_VALUES_REQUIRED' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('requires a default Unit for unit-based criteria before publication', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      {
        ...activeAssignment,
        defaultUnit: null,
        attribute: {
          ...activeAssignment.attribute,
          unitDimensionId: '99999999-9999-4999-8999-999999999999',
          unitDimension: {
            id: '99999999-9999-4999-8999-999999999999',
            code: 'LENGTH',
            name: 'Length',
          },
        },
      },
    ]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_DEFAULT_UNIT_REQUIRED' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('increments the immutable schema version after a configuration change', async () => {
    productTypeSchemaVersion.findFirst.mockResolvedValue({
      id: 'old-schema',
      schemaVersion: 3,
      schemaHash: '0'.repeat(64),
    });

    const result = await service.publish(
      productTypeId,
      { productTypeVersion: 4 },
      actorId,
    );

    expect(result.schemaVersion).toBe(4);
    expect(productTypeSchemaVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schemaVersion: 4 }),
      }),
    );
  });

  it('rejects stale Product Type versions before publishing', async () => {
    productType.findUnique.mockResolvedValue({
      ...activeProductType,
      version: 5,
    });

    await expect(
      service.publish(
        productTypeId,
        { productTypeVersion: 4 },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_VERSION_CONFLICT' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('requires a Part Group before publishing a Product Type schema', async () => {
    productType.findUnique.mockResolvedValue({
      ...activeProductType,
      productFamilyId: null,
    });

    await expect(
      service.publish(
        productTypeId,
        { productTypeVersion: 4 },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_PART_GROUP_REQUIRED' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('publishes a complete Draft hierarchy atomically', async () => {
    productType.findUnique.mockResolvedValue({
      ...activeProductType,
      status: MasterDataStatus.DRAFT,
    });
    category.findUnique.mockResolvedValue({
      id: activeProductType.categoryId,
      status: MasterDataStatus.DRAFT,
      version: 2,
    });
    productFamily.findUnique.mockResolvedValue({
      id: partGroupId,
      categoryId: activeProductType.categoryId,
      status: MasterDataStatus.DRAFT,
      version: 3,
    });
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      {
        ...activeAssignment,
        status: MasterDataStatus.DRAFT,
      },
    ]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).resolves.toMatchObject({ schemaVersion: 1 });

    expect(category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MasterDataStatus.ACTIVE }),
      }),
    );
    expect(productFamily.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: MasterDataStatus.ACTIVE }),
      }),
    );
    expect(productTypeAttributeAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productTypeId,
          status: MasterDataStatus.DRAFT,
        }),
        data: expect.objectContaining({
          status: MasterDataStatus.ACTIVE,
        }),
      }),
    );
  });

  it('requires at least one Draft or Active technical assignment', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_EMPTY' },
    });
  });

  it('rejects legacy non-Product scope assignments during publish', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      {
        ...activeAssignment,
        attribute: {
          ...activeAssignment.attribute,
          scope: AttributeScope.SELLER,
        },
      },
    ]);

    await expect(
      service.publish(productTypeId, { productTypeVersion: 4 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_ATTRIBUTE_SCOPE_INVALID' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('does not publish a duplicate version when configuration is unchanged', async () => {
    const first = await service.publish(
      productTypeId,
      { productTypeVersion: 4 },
      actorId,
    );

    vi.clearAllMocks();
    productType.findUnique.mockResolvedValue({
      ...activeProductType,
      version: 5,
      currentSchemaVersionId: schemaId,
    });
    category.findUnique.mockResolvedValue({
      id: activeProductType.categoryId,
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });
    productFamily.findUnique.mockResolvedValue({
      id: partGroupId,
      categoryId: activeProductType.categoryId,
      status: MasterDataStatus.ACTIVE,
      version: 1,
    });
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      activeAssignment,
    ]);
    productTypeSchemaVersion.findFirst.mockResolvedValue({
      id: schemaId,
      schemaVersion: 1,
      schemaHash: first.schemaHash,
    });

    await expect(
      service.publish(
        productTypeId,
        { productTypeVersion: 5 },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_SCHEMA_UNCHANGED' },
    });

    expect(productTypeSchemaVersion.create).not.toHaveBeenCalled();
  });

  it('returns the current published schema only for an active Product Type', async () => {
    productType.findFirst.mockResolvedValue({
      currentSchemaVersionId: schemaId,
    });
    productTypeSchemaVersion.findUnique.mockResolvedValue({
      id: schemaId,
      productTypeId,
      schemaVersion: 2,
      schemaHash: 'a'.repeat(64),
      snapshot: { attributes: [] },
      publishedAt,
    });

    await expect(
      service.getCurrentPublishedSchema(productTypeId),
    ).resolves.toMatchObject({
      id: schemaId,
      productTypeId,
      schemaVersion: 2,
    });

    expect(productType.findFirst).toHaveBeenCalledWith({
      where: {
        id: productTypeId,
        status: MasterDataStatus.ACTIVE,
        currentSchemaVersionId: { not: null },
      },
      select: { currentSchemaVersionId: true },
    });
  });

  it('keeps exact historical schema versions readable', async () => {
    productTypeSchemaVersion.findUnique.mockResolvedValue({
      id: schemaId,
      productTypeId,
      schemaVersion: 1,
      schemaHash: 'b'.repeat(64),
      snapshot: {
        productType: { id: productTypeId, name: 'Brake Pad' },
        attributes: [{ code: 'ATTR_POSITION', name: 'Old Position Label' }],
      },
      publishedAt,
    });

    await expect(
      service.getPublishedSchemaVersion(productTypeId, 1),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      snapshot: expect.objectContaining({
        attributes: [
          expect.objectContaining({ name: 'Old Position Label' }),
        ],
      }),
    });

    expect(productTypeSchemaVersion.findUnique).toHaveBeenCalledWith({
      where: {
        productTypeId_schemaVersion: {
          productTypeId,
          schemaVersion: 1,
        },
      },
      select: expect.any(Object),
    });
  });
});
