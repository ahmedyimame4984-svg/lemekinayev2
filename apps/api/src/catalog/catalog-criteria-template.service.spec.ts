import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { CatalogCriteriaTemplateService } from './catalog-criteria-template.service.js';

describe('CatalogCriteriaTemplateService', () => {
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const familyId = '11111111-1111-4111-8111-111111111111';
  const templateId = '22222222-2222-4222-8222-222222222222';
  const productTypeId = '33333333-3333-4333-8333-333333333333';
  const attributeAId = '44444444-4444-4444-8444-444444444444';
  const attributeBId = '55555555-5555-4555-8555-555555555555';
  const now = new Date('2026-10-03T10:00:00.000Z');

  const productFamily = {
    findUnique: vi.fn(),
  };
  const productType = {
    findUnique: vi.fn(),
  };
  const productTypeCriteriaTemplate = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productTypeCriteriaTemplateItem = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeDefinition = {
    count: vi.fn(),
    groupBy: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  };
  const attributeUnit = {
    findUnique: vi.fn(),
  };
  const productTypeAttributeAssignment = {
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const auditLog = {
    create: vi.fn(),
  };

  const tx = {
    productFamily,
    productType,
    productTypeCriteriaTemplate,
    productTypeCriteriaTemplateItem,
    attributeDefinition,
    attributeUnit,
    productTypeAttributeAssignment,
    auditLog,
  };

  const database = {
    ...tx,
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };

  const service = new CatalogCriteriaTemplateService(
    database as unknown as DatabaseService,
  );

  const attributeA = {
    id: attributeAId,
    groupId: null,
    optionSetId: null,
    unitDimensionId: null,
    defaultUnitId: null,
    code: 'ATTR_BRAKE_DISC_DIAMETER',
    name: 'Brake Disc Diameter',
    dataType: AttributeDataType.MEASUREMENT,
    scope: AttributeScope.PRODUCT,
    valueSource: AttributeValueSource.NONE,
    unit: 'mm',
    description: null,
    exampleValue: null,
    validationRule: null,
    repeatable: false,
    translatable: false,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const attributeB = {
    ...attributeA,
    id: attributeBId,
    code: 'ATTR_BRAKE_DISC_THICKNESS',
    name: 'Brake Disc Thickness',
  };

  const templateRecord = {
    id: templateId,
    productFamilyId: familyId,
    code: 'BRAKE_DISC_STANDARD',
    name: 'Brake Disc Standard Criteria',
    description: null,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const templateView = {
    ...templateRecord,
    _count: { items: 2 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    productFamily.findUnique.mockResolvedValue({
      id: familyId,
      status: MasterDataStatus.ACTIVE,
    });
    productType.findUnique.mockResolvedValue({
      id: productTypeId,
      productFamilyId: familyId,
      status: MasterDataStatus.ACTIVE,
    });
    attributeDefinition.findUnique.mockResolvedValue(attributeA);
    auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('pages the Criteria Template library with server-side search and applicability filters', async () => {
    productTypeCriteriaTemplate.count.mockResolvedValue(87);
    productTypeCriteriaTemplate.findMany.mockResolvedValue([templateView]);

    await expect(
      service.listTemplatesPage({
        search: 'brake',
        productFamilyId: familyId,
        status: MasterDataStatus.ACTIVE,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: templateId,
          code: 'BRAKE_DISC_STANDARD',
          itemCount: 2,
        }),
      ],
      total: 87,
      page: 2,
      pageSize: 25,
      pageCount: 4,
    });

    const applicability = [
      { productFamilyId: familyId },
      {
        productFamilyId: null,
        targets: { none: {} },
      },
    ];
    const searchCriteria = [
      { name: { contains: 'brake', mode: 'insensitive' } },
      { code: { contains: 'brake', mode: 'insensitive' } },
      { description: { contains: 'brake', mode: 'insensitive' } },
    ];
    const where = {
      status: MasterDataStatus.ACTIVE,
      AND: [{ OR: applicability }, { OR: searchCriteria }],
    };

    expect(productTypeCriteriaTemplate.count).toHaveBeenCalledWith({ where });
    expect(productTypeCriteriaTemplate.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      skip: 25,
      take: 25,
    });
  });

  it('creates and audits an active reusable Criteria Template for an active Product Family', async () => {
    productTypeCriteriaTemplate.create.mockResolvedValue(templateView);

    await expect(
      service.createTemplate(
        {
          code: 'BRAKE_DISC_STANDARD',
          name: ' Brake Disc Standard Criteria ',
          productFamilyId: familyId,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      code: 'BRAKE_DISC_STANDARD',
      itemCount: 2,
      status: MasterDataStatus.ACTIVE,
    });

    expect(productTypeCriteriaTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'BRAKE_DISC_STANDARD',
          name: 'Brake Disc Standard Criteria',
          productFamilyId: familyId,
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_CREATED',
        }),
      }),
    );
  });

  it('returns assigned Template criteria with embedded Attribute metadata', async () => {
    productTypeCriteriaTemplate.findUnique.mockResolvedValue(templateRecord);
    const resolvedItem = {
      id: '61616161-6161-4616-8616-616161616161',
      templateId,
      attributeId: attributeAId,
      requirement: ProductTypeAttributeRequirement.MANDATORY,
      displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
      displayOrder: 10,
      validationRule: null,
      conditionalRule: null,
      defaultUnitId: null,
      searchable: false,
      filterable: true,
      comparable: true,
      variantDefining: false,
      marketplaceVisible: true,
      sellerEditable: true,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      attribute: attributeA,
    };
    productTypeCriteriaTemplateItem.findMany.mockResolvedValue([resolvedItem]);

    await expect(service.listItems(templateId)).resolves.toEqual([resolvedItem]);
    expect(productTypeCriteriaTemplateItem.findMany).toHaveBeenCalledWith({
      where: { templateId },
      select: expect.any(Object),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('pages unassigned Criteria Template Attributes with server-side search and group filters', async () => {
    const groupId = '99999999-9999-4999-8999-999999999999';
    productTypeCriteriaTemplate.findUnique.mockResolvedValue(templateRecord);
    attributeDefinition.count.mockResolvedValue(64);
    attributeDefinition.findMany.mockResolvedValue([attributeA]);

    await expect(
      service.listAvailableAttributesPage(templateId, {
        search: 'disc',
        groupId,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [attributeA],
      total: 64,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      scope: AttributeScope.PRODUCT,
      groupId,
      criteriaTemplateItems: {
        none: { templateId },
      },
      OR: [
        { name: { contains: 'disc', mode: 'insensitive' } },
        { code: { contains: 'disc', mode: 'insensitive' } },
        { description: { contains: 'disc', mode: 'insensitive' } },
        { unit: { contains: 'disc', mode: 'insensitive' } },
      ],
    };

    expect(attributeDefinition.count).toHaveBeenCalledWith({ where });
    expect(attributeDefinition.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      skip: 25,
      take: 25,
    });
  });

  it('supports the ungrouped Criteria Template Attribute candidate queue', async () => {
    productTypeCriteriaTemplate.findUnique.mockResolvedValue(templateRecord);
    attributeDefinition.count.mockResolvedValue(2);
    attributeDefinition.findMany.mockResolvedValue([attributeA]);

    await service.listAvailableAttributesPage(templateId, {
      ungrouped: true,
      page: 1,
      pageSize: 50,
    });

    expect(attributeDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: null }),
        skip: 0,
        take: 50,
      }),
    );
  });

  it('summarizes unassigned Criteria Template Attributes by technical group', async () => {
    const groupId = '99999999-9999-4999-8999-999999999999';
    productTypeCriteriaTemplate.findUnique.mockResolvedValue(templateRecord);
    attributeDefinition.groupBy.mockResolvedValue([
      { groupId, _count: { _all: 9 } },
      { groupId: null, _count: { _all: 3 } },
    ]);

    await expect(
      service.getAvailableAttributeSummary(templateId),
    ).resolves.toEqual({
      total: 12,
      ungrouped: 3,
      groupCounts: { [groupId]: 9 },
    });

    expect(attributeDefinition.groupBy).toHaveBeenCalledWith({
      by: ['groupId'],
      where: {
        status: MasterDataStatus.ACTIVE,
        scope: AttributeScope.PRODUCT,
        criteriaTemplateItems: {
          none: { templateId },
        },
      },
      _count: { _all: true },
    });
  });

  it('requires active parents before an active criterion is created', async () => {
    productTypeCriteriaTemplate.findUnique.mockResolvedValue({
      ...templateRecord,
      status: MasterDataStatus.DRAFT,
    });

    await expect(
      service.createItem(
        templateId,
        {
          attributeId: attributeAId,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_NOT_ACTIVE' },
    });

    expect(productTypeCriteriaTemplateItem.create).not.toHaveBeenCalled();
  });

  it('bulk adds canonical Attributes to a Template atomically with shared criteria', async () => {
    productTypeCriteriaTemplate.findUnique.mockResolvedValue(templateRecord);
    attributeDefinition.findMany.mockResolvedValue([attributeA, attributeB]);
    productTypeCriteriaTemplateItem.findMany.mockResolvedValue([]);
    productTypeCriteriaTemplateItem.create
      .mockResolvedValueOnce({
        id: '61616161-6161-4616-8616-616161616161',
        templateId,
        attributeId: attributeAId,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        displayOrder: 10,
        validationRule: null,
        conditionalRule: null,
        defaultUnitId: null,
        searchable: false,
        filterable: true,
        comparable: true,
        variantDefining: false,
        marketplaceVisible: true,
        sellerEditable: true,
        status: MasterDataStatus.ACTIVE,
        version: 1,
        createdById: actorId,
        updatedById: actorId,
        createdAt: now,
        updatedAt: now,
      })
      .mockResolvedValueOnce({
        id: '62626262-6262-4626-8626-626262626262',
        templateId,
        attributeId: attributeBId,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        displayOrder: 11,
        validationRule: null,
        conditionalRule: null,
        defaultUnitId: null,
        searchable: false,
        filterable: true,
        comparable: true,
        variantDefining: false,
        marketplaceVisible: true,
        sellerEditable: true,
        status: MasterDataStatus.ACTIVE,
        version: 1,
        createdById: actorId,
        updatedById: actorId,
        createdAt: now,
        updatedAt: now,
      });

    const result = await service.createItemsBulk(
      templateId,
      {
        attributeIds: [attributeAId, attributeBId],
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        startDisplayOrder: 10,
        filterable: true,
        comparable: true,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toHaveLength(2);
    expect(productTypeCriteriaTemplateItem.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          attributeId: attributeAId,
          displayOrder: 10,
          comparable: true,
        }),
      }),
    );
    expect(productTypeCriteriaTemplateItem.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          attributeId: attributeBId,
          displayOrder: 11,
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_ITEMS_BULK_CREATED',
          metadata: expect.objectContaining({ count: 2 }),
        }),
      }),
    );
  });

  it('applies only missing active criteria and preserves existing Product Type assignments', async () => {
    productTypeCriteriaTemplate.findUnique.mockResolvedValue({
      ...templateRecord,
      items: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          templateId,
          attributeId: attributeAId,
          requirement: ProductTypeAttributeRequirement.MANDATORY,
          displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
          displayOrder: 10,
          validationRule: null,
          conditionalRule: null,
          defaultUnitId: null,
          searchable: false,
          filterable: true,
          comparable: true,
          variantDefining: false,
          marketplaceVisible: true,
          sellerEditable: true,
          status: MasterDataStatus.ACTIVE,
          version: 1,
          createdById: actorId,
          updatedById: actorId,
          createdAt: now,
          updatedAt: now,
          attribute: attributeA,
        },
        {
          id: '77777777-7777-4777-8777-777777777777',
          templateId,
          attributeId: attributeBId,
          requirement: ProductTypeAttributeRequirement.MANDATORY,
          displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
          displayOrder: 20,
          validationRule: null,
          conditionalRule: null,
          defaultUnitId: null,
          searchable: false,
          filterable: true,
          comparable: true,
          variantDefining: false,
          marketplaceVisible: true,
          sellerEditable: true,
          status: MasterDataStatus.ACTIVE,
          version: 1,
          createdById: actorId,
          updatedById: actorId,
          createdAt: now,
          updatedAt: now,
          attribute: attributeB,
        },
      ],
    });
    productTypeAttributeAssignment.findMany
      .mockResolvedValueOnce([
        { attributeId: attributeAId, displayOrder: 10 },
      ])
      .mockResolvedValueOnce([{ displayOrder: 10 }]);
    productTypeAttributeAssignment.create.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
    });

    const result = await service.applyTemplate(
      productTypeId,
      templateId,
      { assignmentStatus: MasterDataStatus.ACTIVE },
      actorId,
    );

    expect(result).toEqual({
      templateId,
      productTypeId,
      createdCount: 1,
      createdAssignmentIds: ['88888888-8888-4888-8888-888888888888'],
      skippedAttributeIds: [attributeAId],
    });
    expect(productTypeAttributeAssignment.create).toHaveBeenCalledOnce();
    expect(productTypeAttributeAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productTypeId,
        attributeId: attributeBId,
        displayOrder: 30,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        comparable: true,
        status: MasterDataStatus.ACTIVE,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_APPLIED',
          metadata: expect.objectContaining({
            createdCount: 1,
            skippedAttributeIds: [attributeAId],
          }),
        }),
      }),
    );
  });

  it('rejects a family-specific Template when Product Type belongs to another Product Family', async () => {
    productType.findUnique.mockResolvedValue({
      id: productTypeId,
      productFamilyId: '99999999-9999-4999-8999-999999999999',
      status: MasterDataStatus.ACTIVE,
    });
    productTypeCriteriaTemplate.findUnique.mockResolvedValue({
      ...templateRecord,
      items: [
        {
          attributeId: attributeAId,
          status: MasterDataStatus.ACTIVE,
          attribute: attributeA,
        },
      ],
    });

    await expect(
      service.applyTemplate(productTypeId, templateId, {}, actorId),
    ).rejects.toMatchObject({
      response: {
        code: 'PRODUCT_TYPE_CRITERIA_TEMPLATE_FAMILY_MISMATCH',
      },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('lists exact targeted, family, and universal Templates for a Product Type', async () => {
    productTypeCriteriaTemplate.findMany.mockResolvedValue([]);

    await service.listTemplates({
      productTypeId,
      status: MasterDataStatus.ACTIVE,
    });

    expect(productType.findUnique).toHaveBeenCalledWith({
      where: { id: productTypeId },
      select: { id: true, productFamilyId: true },
    });
    expect(productTypeCriteriaTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: MasterDataStatus.ACTIVE,
          OR: [
            {
              targets: {
                some: { productTypeId },
              },
            },
            { productFamilyId: familyId },
            { productFamilyId: null, targets: { none: {} } },
          ],
        },
      }),
    );
  });

  it('lists global Templates together with family-specific Templates', async () => {
    productTypeCriteriaTemplate.findMany.mockResolvedValue([]);

    await service.listTemplates({
      productFamilyId: familyId,
      status: MasterDataStatus.ACTIVE,
    });

    expect(productTypeCriteriaTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: MasterDataStatus.ACTIVE,
          OR: [
            { productFamilyId: familyId },
            { productFamilyId: null, targets: { none: {} } },
          ],
        },
      }),
    );
  });
});
