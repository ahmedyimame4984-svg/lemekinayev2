import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  ProductTypeAttributeAssignmentOrigin,
  ProductTypeAttributeDisplayMode,
  ProductTypeAttributeRequirement,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
  type AttributeDefinition,
  type ProductType,
  type ProductTypeAttributeAssignment,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { CatalogAttributeAssignmentService } from './catalog-attribute-assignment.service.js';

describe('CatalogAttributeAssignmentService', () => {
  const productType = {
    findUnique: vi.fn(),
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
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    productType,
    attributeDefinition,
    attributeUnit,
    productTypeAttributeAssignment,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          productType,
          attributeDefinition,
          attributeUnit,
          productTypeAttributeAssignment,
          auditLog,
        }),
    ),
  };
  const service = new CatalogAttributeAssignmentService(
    database as unknown as DatabaseService,
  );
  const now = new Date('2026-09-27T16:00:00.000Z');
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const brakePad: ProductType = {
    id: '33333333-3333-4333-8333-333333333333',
    categoryId: '11111111-1111-4111-8111-111111111111',
    productFamilyId: null,
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
    status: MasterDataStatus.ACTIVE,
    version: 1,
    currentSchemaVersionId: null,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const position: AttributeDefinition = {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'ATTR_POSITION',
    name: 'Position',
    dataType: AttributeDataType.SELECT,
    scope: AttributeScope.PRODUCT,
    valueSource: AttributeValueSource.STATIC,
    groupId: null,
    optionSetId: null,
    unitDimensionId: null,
    defaultUnitId: null,
    unit: null,
    exampleValue: null,
    validationRule: null,
    repeatable: false,
    translatable: false,
    description: null,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const assignment: ProductTypeAttributeAssignment = {
    id: '77777777-7777-4777-8777-777777777777',
    productTypeId: brakePad.id,
    attributeId: position.id,
    requirement: ProductTypeAttributeRequirement.MANDATORY,
    displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
    displayOrder: 10,
    validationRule: null,
    conditionalRule: null,
    defaultUnitId: null,
    searchable: true,
    filterable: true,
    comparable: false,
    variantDefining: false,
    marketplaceVisible: true,
    sellerEditable: true,
    origin: ProductTypeAttributeAssignmentOrigin.MANUAL,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    productType.findUnique.mockResolvedValue(brakePad);
    attributeDefinition.findUnique.mockResolvedValue(position);
    // Return the real Attribute identities requested by bulk validation.
    // Individual tests may override this for inactive, invalid or missing masters.
    attributeDefinition.findMany.mockImplementation(
      async (query: { where?: { id?: { in?: string[] } } }) =>
        (query.where?.id?.in ?? []).map((id) => ({ ...position, id })),
    );
    auditLog.create.mockResolvedValue({});
  });

  it('lists assigned attributes in display order with filters', async () => {
    const resolvedAssignment = { ...assignment, attribute: position };
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      resolvedAssignment,
    ]);

    await expect(
      service.listAdminAssignments(brakePad.id, {
        status: MasterDataStatus.ACTIVE,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
      }),
    ).resolves.toEqual([resolvedAssignment]);

    expect(productTypeAttributeAssignment.findMany).toHaveBeenCalledWith({
      where: {
        productTypeId: brakePad.id,
        status: MasterDataStatus.ACTIVE,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
      },
      select: expect.any(Object),
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('lists Attributes that are not yet assigned to the Product Type', async () => {
    attributeDefinition.findMany.mockResolvedValue([position]);

    await expect(
      service.listAvailableAttributes(brakePad.id),
    ).resolves.toEqual([position]);

    expect(productType.findUnique).toHaveBeenCalledWith({
      where: { id: brakePad.id },
      select: { id: true },
    });
    expect(attributeDefinition.findMany).toHaveBeenCalledWith({
      where: {
        status: MasterDataStatus.ACTIVE,
        scope: AttributeScope.PRODUCT,
        productTypeAssignments: {
          none: { productTypeId: brakePad.id },
        },
      },
      select: expect.any(Object),
      orderBy: [{ code: 'asc' }],
    });
  });

  it('pages unassigned Product Attributes with server-side search and group filters', async () => {
    attributeDefinition.count.mockResolvedValue(73);
    attributeDefinition.findMany.mockResolvedValue([position]);

    await expect(
      service.listAvailableAttributesPage(brakePad.id, {
        search: 'position',
        groupId: '99999999-9999-4999-8999-999999999999',
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [position],
      total: 73,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      scope: AttributeScope.PRODUCT,
      groupId: '99999999-9999-4999-8999-999999999999',
      productTypeAssignments: {
        none: { productTypeId: brakePad.id },
      },
      OR: [
        { name: { contains: 'position', mode: 'insensitive' } },
        { code: { contains: 'position', mode: 'insensitive' } },
        { description: { contains: 'position', mode: 'insensitive' } },
        { unit: { contains: 'position', mode: 'insensitive' } },
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

  it('supports the ungrouped Product Attribute candidate queue', async () => {
    attributeDefinition.count.mockResolvedValue(4);
    attributeDefinition.findMany.mockResolvedValue([position]);

    await service.listAvailableAttributesPage(brakePad.id, {
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

  it('summarizes unassigned Product Attributes by technical group', async () => {
    const groupId = '99999999-9999-4999-8999-999999999999';
    attributeDefinition.groupBy.mockResolvedValue([
      { groupId, _count: { _all: 11 } },
      { groupId: null, _count: { _all: 2 } },
    ]);

    await expect(
      service.getAvailableAttributeSummary(brakePad.id),
    ).resolves.toEqual({
      total: 13,
      ungrouped: 2,
      groupCounts: { [groupId]: 11 },
    });

    expect(attributeDefinition.groupBy).toHaveBeenCalledWith({
      by: ['groupId'],
      where: {
        status: MasterDataStatus.ACTIVE,
        scope: AttributeScope.PRODUCT,
        productTypeAssignments: {
          none: { productTypeId: brakePad.id },
        },
      },
      _count: { _all: true },
    });
  });

  it('creates an active assignment only between active master records and audits it', async () => {
    productTypeAttributeAssignment.create.mockResolvedValue(assignment);

    const result = await service.createAssignment(
      brakePad.id,
      {
        attributeId: position.id,
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        displayMode: ProductTypeAttributeDisplayMode.VISIBLE,
        displayOrder: 10,
        searchable: true,
        filterable: true,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      productTypeId: brakePad.id,
      attributeId: position.id,
      requirement: ProductTypeAttributeRequirement.MANDATORY,
      displayOrder: 10,
    });
    expect(productTypeAttributeAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productTypeId: brakePad.id,
        attributeId: position.id,
        createdById: actorId,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_ATTRIBUTE_ASSIGNED',
        }),
      }),
    );
  });

  it('rejects numeric range rules on non-numeric Attributes', async () => {
    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          validationRule: { min: 1 },
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_NUMERIC_RULE_NOT_ALLOWED' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('validates Product Type overrides against inherited master Attribute limits', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...position,
      dataType: AttributeDataType.DECIMAL,
      valueSource: AttributeValueSource.NONE,
      validationRule: { min: 10 },
    });

    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          validationRule: { max: 5 },
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_NUMERIC_RANGE_INVALID' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects inverted numeric ranges before persistence', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...position,
      dataType: AttributeDataType.DECIMAL,
      valueSource: AttributeValueSource.NONE,
    });

    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          validationRule: { min: 10, max: 2 },
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_NUMERIC_RANGE_INVALID' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('requires a default Unit before activating a unit-based criterion', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...position,
      dataType: AttributeDataType.MEASUREMENT,
      valueSource: AttributeValueSource.NONE,
      unitDimensionId: '99999999-9999-4999-8999-999999999999',
      defaultUnitId: null,
    });

    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_DEFAULT_UNIT_REQUIRED' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('requires a conditional-rule object for CONDITIONAL assignments', async () => {
    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          requirement: ProductTypeAttributeRequirement.CONDITIONAL,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_CONDITION_REQUIRED' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('accepts a structured conditional rule for conditional assignments', async () => {
    const conditional = {
      ...assignment,
      requirement: ProductTypeAttributeRequirement.CONDITIONAL,
      conditionalRule: { operator: 'EQUALS', value: 'YES' },
      status: MasterDataStatus.DRAFT,
    };
    productTypeAttributeAssignment.create.mockResolvedValue(conditional);

    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          requirement: ProductTypeAttributeRequirement.CONDITIONAL,
          conditionalRule: { operator: 'EQUALS', value: 'YES' },
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      requirement: ProductTypeAttributeRequirement.CONDITIONAL,
    });
  });

  it('rejects active assignments when the product type is not active', async () => {
    productType.findUnique.mockResolvedValue({
      ...brakePad,
      status: MasterDataStatus.DRAFT,
    });

    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'PRODUCT_TYPE_ATTRIBUTE_PRODUCT_TYPE_NOT_ACTIVE',
      },
    });
  });

  it('rejects active assignments when the attribute is not active', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...position,
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.createAssignment(
        brakePad.id,
        {
          attributeId: position.id,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'PRODUCT_TYPE_ATTRIBUTE_ATTRIBUTE_NOT_ACTIVE',
      },
    });
  });

  it('rejects non-Product scope Attributes for Product Type assignment', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...position,
      scope: AttributeScope.SELLER,
    });

    await expect(
      service.createAssignment(
        brakePad.id,
        { attributeId: position.id },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_SCOPE_INVALID' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('bulk assigns a selected Attribute set atomically with shared criteria', async () => {
    const side: AttributeDefinition = {
      ...position,
      id: '66666666-6666-4666-8666-666666666666',
      code: 'ATTR_SIDE',
      name: 'Side',
    };
    attributeDefinition.findMany.mockResolvedValue([position, side]);
    productTypeAttributeAssignment.findMany.mockResolvedValue([]);
    productTypeAttributeAssignment.create
      .mockResolvedValueOnce(assignment)
      .mockResolvedValueOnce({
        ...assignment,
        id: '88888888-8888-4888-8888-888888888888',
        attributeId: side.id,
        displayOrder: 21,
      });

    const result = await service.createAssignmentsBulk(
      brakePad.id,
      {
        attributeIds: [position.id, side.id],
        requirement: ProductTypeAttributeRequirement.MANDATORY,
        startDisplayOrder: 20,
        searchable: true,
        filterable: true,
        comparable: true,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toHaveLength(2);
    expect(productTypeAttributeAssignment.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          productTypeId: brakePad.id,
          attributeId: position.id,
          displayOrder: 20,
          comparable: true,
        }),
      }),
    );
    expect(productTypeAttributeAssignment.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          attributeId: side.id,
          displayOrder: 21,
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_ASSIGNED',
          metadata: expect.objectContaining({ count: 2 }),
        }),
      }),
    );
  });

  it('rejects the whole bulk request when any selected Attribute is already assigned', async () => {
    attributeDefinition.findMany.mockResolvedValue([position]);
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      { attributeId: position.id },
    ]);

    await expect(
      service.createAssignmentsBulk(
        brakePad.id,
        {
          attributeIds: [position.id],
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_ALREADY_ASSIGNED' },
    });

    expect(productTypeAttributeAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects conditional bulk assignment because each condition must be explicit', async () => {
    await expect(
      service.createAssignmentsBulk(
        brakePad.id,
        {
          attributeIds: [position.id],
          requirement: ProductTypeAttributeRequirement.CONDITIONAL,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_CONDITIONAL_UNSUPPORTED',
      },
    });
  });

  it('unassigns an Attribute atomically and records audit evidence', async () => {
    productTypeAttributeAssignment.findFirst.mockResolvedValue(assignment);
    productTypeAttributeAssignment.delete.mockResolvedValue(assignment);

    await expect(
      service.deleteAssignment(
        brakePad.id,
        assignment.id,
        assignment.version,
        actorId,
      ),
    ).resolves.toMatchObject({
      id: assignment.id,
      attributeId: assignment.attributeId,
    });

    expect(productTypeAttributeAssignment.delete).toHaveBeenCalledWith({
      where: { id: assignment.id, version: assignment.version },
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_ATTRIBUTE_UNASSIGNED',
          entityType: 'ProductTypeAttributeAssignment',
          entityId: assignment.id,
        }),
      }),
    );
  });

  it('rejects stale Attribute unassign requests', async () => {
    productTypeAttributeAssignment.findFirst.mockResolvedValue({
      ...assignment,
      version: 2,
    });

    await expect(
      service.deleteAssignment(brakePad.id, assignment.id, 1, actorId),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_VERSION_CONFLICT' },
    });

    expect(productTypeAttributeAssignment.delete).not.toHaveBeenCalled();
  });

  it('bulk updates selected Attribute behavior atomically', async () => {
    const second = {
      ...assignment,
      id: '88888888-8888-4888-8888-888888888888',
      attributeId: '66666666-6666-4666-8666-666666666666',
      requirement: ProductTypeAttributeRequirement.OPTIONAL,
    };
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      assignment,
      second,
    ]);
    productTypeAttributeAssignment.update
      .mockResolvedValueOnce({
        ...assignment,
        requirement: ProductTypeAttributeRequirement.OPTIONAL,
        version: 2,
      })
      .mockResolvedValueOnce({
        ...second,
        requirement: ProductTypeAttributeRequirement.OPTIONAL,
        version: 2,
      });

    await expect(
      service.updateAssignmentsBulk(
        brakePad.id,
        {
          assignments: [
            { id: assignment.id, version: 1 },
            { id: second.id, version: 1 },
          ],
          requirement: ProductTypeAttributeRequirement.OPTIONAL,
        },
        actorId,
      ),
    ).resolves.toHaveLength(2);

    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_UPDATED',
        }),
      }),
    );
  });

  it('saves independent settings on two Attributes in a single transaction', async () => {
    const second = { ...assignment, id: '88888888-8888-4888-8888-888888888888', requirement: ProductTypeAttributeRequirement.OPTIONAL, status: MasterDataStatus.DRAFT };
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment, second]);
    productTypeAttributeAssignment.update
      .mockResolvedValueOnce({ ...assignment, requirement: ProductTypeAttributeRequirement.OPTIONAL, filterable: false, version: 2 })
      .mockResolvedValueOnce({ ...second, requirement: ProductTypeAttributeRequirement.MANDATORY, searchable: false, version: 2 });
    await service.updateAssignmentsBulk(brakePad.id, { assignments: [
      { id: assignment.id, version: 1, requirement: ProductTypeAttributeRequirement.OPTIONAL, filterable: false },
      { id: second.id, version: 1, requirement: ProductTypeAttributeRequirement.MANDATORY, searchable: false },
    ] }, actorId);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(productTypeAttributeAssignment.update).toHaveBeenCalledTimes(2);
    expect(productTypeAttributeAssignment.update).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ data: expect.objectContaining({ requirement: 'OPTIONAL', filterable: false }) }));
    expect(productTypeAttributeAssignment.update).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ data: expect.objectContaining({ requirement: 'MANDATORY', searchable: false }) }));
  });

  it('rejects an out-of-scope Attribute in Save All before any write', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment]);
    attributeDefinition.findMany.mockResolvedValue([
      { ...position, scope: AttributeScope.VEHICLE },
    ]);

    await expect(
      service.updateAssignmentsBulk(
        brakePad.id,
        { assignments: [{ id: assignment.id, version: 1, searchable: false }] },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_SCOPE_INVALID' },
    });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a bulk change when an Active assignment has an inactive Product Type', async () => {
    productType.findUnique.mockResolvedValue({
      ...brakePad,
      status: MasterDataStatus.DRAFT,
    });
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment]);

    await expect(
      service.updateAssignmentsBulk(
        brakePad.id,
        { assignments: [{ id: assignment.id, version: 1, filterable: false }] },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_PRODUCT_TYPE_NOT_ACTIVE' },
    });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
  });

  it('rejects bulk editing an Active assignment with an inactive master Attribute', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment]);
    attributeDefinition.findMany.mockResolvedValue([
      { ...position, status: MasterDataStatus.INACTIVE },
    ]);

    await expect(
      service.updateAssignmentsBulk(
        brakePad.id,
        { assignments: [{ id: assignment.id, version: 1, comparable: true }] },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_ATTRIBUTE_NOT_ACTIVE' },
    });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
  });

  it('requires the configured Unit Dimension default for an Active assignment during Save All', async () => {
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment]);
    attributeDefinition.findMany.mockResolvedValue([
      { ...position, unitDimensionId: '99999999-9999-4999-8999-999999999999' },
    ]);

    await expect(
      service.updateAssignmentsBulk(
        brakePad.id,
        { assignments: [{ id: assignment.id, version: 1, displayOrder: 20 }] },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_DEFAULT_UNIT_REQUIRED' },
    });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
  });

  it('persists the validated master default Unit during bulk Save All', async () => {
    const dimensionId = '99999999-9999-4999-8999-999999999999';
    const unitId = '22222222-2222-4222-8222-222222222222';
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment]);
    attributeDefinition.findMany.mockResolvedValue([{
      ...position, unitDimensionId: dimensionId, defaultUnitId: unitId,
    }]);
    attributeUnit.findUnique.mockResolvedValue({
      id: unitId, dimensionId, status: MasterDataStatus.ACTIVE,
    });
    productTypeAttributeAssignment.update.mockResolvedValue({
      ...assignment, defaultUnitId: unitId, searchable: false, version: 2,
    });

    await service.updateAssignmentsBulk(
      brakePad.id,
      { assignments: [{ id: assignment.id, version: 1, searchable: false }] },
      actorId,
    );

    expect(attributeUnit.findUnique).toHaveBeenCalledWith({
      where: { id: unitId },
      select: { id: true, dimensionId: true, status: true },
    });
    expect(productTypeAttributeAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ defaultUnitId: unitId }),
      }),
    );
  });

  it('preserves an explicitly selected Unit instead of replacing it with the master default', async () => {
    const dimensionId = '99999999-9999-4999-8999-999999999999';
    const masterUnitId = '22222222-2222-4222-8222-222222222222';
    const assignmentUnitId = '33333333-3333-4333-8333-333333333333';
    productTypeAttributeAssignment.findMany.mockResolvedValue([{
      ...assignment, defaultUnitId: assignmentUnitId,
    }]);
    attributeDefinition.findMany.mockResolvedValue([{
      ...position, unitDimensionId: dimensionId, defaultUnitId: masterUnitId,
    }]);
    attributeUnit.findUnique.mockResolvedValue({
      id: assignmentUnitId, dimensionId, status: MasterDataStatus.ACTIVE,
    });
    productTypeAttributeAssignment.update.mockResolvedValue({
      ...assignment, defaultUnitId: assignmentUnitId, filterable: false,
      version: 2,
    });

    await service.updateAssignmentsBulk(
      brakePad.id,
      { assignments: [{ id: assignment.id, version: 1, filterable: false }] },
      actorId,
    );

    expect(attributeUnit.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: assignmentUnitId } }),
    );
    expect(productTypeAttributeAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ defaultUnitId: assignmentUnitId }),
      }),
    );
  });

  it('validates every Attribute before writing any row of a mixed Save All batch', async () => {
    const secondAttributeId = '66666666-6666-4666-8666-666666666666';
    const second = {
      ...assignment,
      id: '88888888-8888-4888-8888-888888888888',
      attributeId: secondAttributeId,
    };
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment, second]);
    attributeDefinition.findMany.mockResolvedValue([
      position,
      { ...position, id: secondAttributeId, scope: AttributeScope.VEHICLE },
    ]);

    await expect(
      service.updateAssignmentsBulk(
        brakePad.id,
        {
          assignments: [
            { id: assignment.id, version: 1, searchable: false },
            { id: second.id, version: 1, filterable: false },
          ],
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_SCOPE_INVALID' },
    });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects stale changes before any Attribute setting is written', async () => {
    const secondId = '88888888-8888-4888-8888-888888888888';
    productTypeAttributeAssignment.findMany.mockResolvedValue([assignment, { ...assignment, id: secondId, version: 2 }]);
    await expect(service.updateAssignmentsBulk(brakePad.id, { assignments: [
      { id: assignment.id, version: 1, searchable: false },
      { id: secondId, version: 1, filterable: false },
    ] }, actorId)).rejects.toMatchObject({ response: { code: 'PRODUCT_TYPE_ATTRIBUTE_VERSION_CONFLICT' } });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects empty settings changes and duplicate Attribute assignment IDs', async () => {
    await expect(service.updateAssignmentsBulk(brakePad.id, { assignments: [
      { id: assignment.id, version: 1 },
    ] }, actorId)).rejects.toMatchObject({ response: { code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_UPDATE_EMPTY' } });
    await expect(service.updateAssignmentsBulk(brakePad.id, { assignments: [
      { id: assignment.id, version: 1, searchable: false },
      { id: assignment.id, version: 1, filterable: true },
    ] }, actorId)).rejects.toMatchObject({ response: { code: 'PRODUCT_TYPE_ATTRIBUTE_BULK_DUPLICATE_ASSIGNMENTS' } });
    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
  });

  it('bulk unassigns selected Attributes atomically with audit evidence', async () => {
    const second = {
      ...assignment,
      id: '88888888-8888-4888-8888-888888888888',
      attributeId: '66666666-6666-4666-8666-666666666666',
    };
    productTypeAttributeAssignment.findMany.mockResolvedValue([
      assignment,
      second,
    ]);
    productTypeAttributeAssignment.deleteMany.mockResolvedValue({ count: 2 });

    await expect(
      service.deleteAssignmentsBulk(
        brakePad.id,
        {
          assignments: [
            { id: assignment.id, version: 1 },
            { id: second.id, version: 1 },
          ],
        },
        actorId,
      ),
    ).resolves.toHaveLength(2);

    expect(productTypeAttributeAssignment.deleteMany).toHaveBeenCalledWith({
      where: {
        productTypeId: brakePad.id,
        id: { in: [assignment.id, second.id] },
      },
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_ATTRIBUTES_BULK_UNASSIGNED',
        }),
      }),
    );
  });

  it('rejects stale assignment updates', async () => {
    productTypeAttributeAssignment.findFirst.mockResolvedValue({
      ...assignment,
      version: 2,
    });

    await expect(
      service.updateAssignment(
        brakePad.id,
        assignment.id,
        { version: 1, displayOrder: 20 },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_TYPE_ATTRIBUTE_VERSION_CONFLICT' },
    });

    expect(productTypeAttributeAssignment.update).not.toHaveBeenCalled();
  });

  it('updates assignment behavior with an atomic version predicate and audit evidence', async () => {
    productTypeAttributeAssignment.findFirst.mockResolvedValue(assignment);
    productTypeAttributeAssignment.update.mockResolvedValue({
      ...assignment,
      displayOrder: 20,
      searchable: false,
      version: 2,
    });

    const result = await service.updateAssignment(
      brakePad.id,
      assignment.id,
      { version: 1, displayOrder: 20, searchable: false },
      actorId,
    );

    expect(result).toMatchObject({
      displayOrder: 20,
      searchable: false,
      version: 2,
    });
    expect(productTypeAttributeAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: assignment.id, version: 1 },
        data: expect.objectContaining({
          displayOrder: 20,
          searchable: false,
          version: { increment: 1 },
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_TYPE_ATTRIBUTE_UPDATED',
        }),
      }),
    );
  });
});
