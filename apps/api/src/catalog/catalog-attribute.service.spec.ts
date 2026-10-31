import {
  AttributeDataType,
  AttributeScope,
  AttributeValueSource,
  MasterDataStatus,
  type AttributeAllowedValue,
  type AttributeDefinition,
} from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import type { DatabaseService } from '../database/database.service.js';
import { AttributeAdminSortBy } from './dto/attribute.dto.js';
import { CatalogAttributeService } from './catalog-attribute.service.js';

describe('CatalogAttributeService', () => {
  const attributeDefinition = {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeGroup = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  };
  const attributeAllowedValue = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productTypeAttributeAssignment = { findFirst: vi.fn() };
  const auditLog = { create: vi.fn() };
  const adminImportJob = { create: vi.fn() };
  const database = {
    attributeDefinition,
    attributeGroup,
    attributeAllowedValue,
    productTypeAttributeAssignment,
    auditLog,
    adminImportJob,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          attributeDefinition,
          attributeGroup,
          attributeAllowedValue,
          productTypeAttributeAssignment,
          auditLog,
          adminImportJob,
        }),
    ),
  };
  const service = new CatalogAttributeService(
    database as unknown as DatabaseService,
  );
  const now = new Date('2026-09-27T15:00:00.000Z');
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const fuelType: AttributeDefinition = {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'ATTR_FUEL_TYPE',
    name: 'Fuel Type',
    dataType: AttributeDataType.SELECT,
    scope: AttributeScope.VEHICLE,
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
    description: 'Vehicle fuel type',
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const diesel: AttributeAllowedValue = {
    id: '66666666-6666-4666-8666-666666666666',
    attributeId: fuelType.id,
    code: 'DIESEL',
    label: 'Diesel',
    description: null,
    sortOrder: 1,
    status: MasterDataStatus.ACTIVE,
    version: 1,
    createdById: actorId,
    updatedById: actorId,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.create.mockResolvedValue({});
    adminImportJob.create.mockResolvedValue({});
    attributeGroup.findUnique.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      status: MasterDataStatus.ACTIVE,
    });
    attributeGroup.findMany.mockResolvedValue([]);
  });

  it('lists attributes with explicit master-data filters', async () => {
    attributeDefinition.findMany.mockResolvedValue([fuelType]);

    await expect(
      service.listAdminAttributes({
        status: MasterDataStatus.ACTIVE,
        dataType: AttributeDataType.SELECT,
        scope: AttributeScope.VEHICLE,
        valueSource: AttributeValueSource.STATIC,
      }),
    ).resolves.toEqual([fuelType]);

    expect(attributeDefinition.findMany).toHaveBeenCalledWith({
      where: {
        groupId: undefined,
        status: MasterDataStatus.ACTIVE,
        dataType: AttributeDataType.SELECT,
        scope: AttributeScope.VEHICLE,
        valueSource: AttributeValueSource.STATIC,
      },
      select: expect.any(Object),
      orderBy: [{ code: 'asc' }],
    });
  });

  it('pages Attributes with server-side filters and deterministic ordering', async () => {
    attributeDefinition.count.mockResolvedValue(76);
    attributeDefinition.findMany.mockResolvedValue([fuelType]);

    await expect(
      service.listAdminAttributesPage({
        status: MasterDataStatus.ACTIVE,
        dataType: AttributeDataType.SELECT,
        scope: AttributeScope.VEHICLE,
        search: 'fuel',
        page: 2,
        pageSize: 25,
        sortBy: AttributeAdminSortBy.UPDATED_AT,
        sortDirection: AdminSortDirection.DESC,
      }),
    ).resolves.toEqual({
      items: [fuelType],
      total: 76,
      page: 2,
      pageSize: 25,
      pageCount: 4,
    });

    const where = {
      groupId: undefined,
      status: MasterDataStatus.ACTIVE,
      dataType: AttributeDataType.SELECT,
      scope: AttributeScope.VEHICLE,
      valueSource: undefined,
      OR: [
        { name: { contains: 'fuel', mode: 'insensitive' } },
        { code: { contains: 'fuel', mode: 'insensitive' } },
        { description: { contains: 'fuel', mode: 'insensitive' } },
        { exampleValue: { contains: 'fuel', mode: 'insensitive' } },
        { unit: { contains: 'fuel', mode: 'insensitive' } },
      ],
    };

    expect(attributeDefinition.count).toHaveBeenCalledWith({ where });
    expect(attributeDefinition.findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: 25,
      take: 25,
    });
  });

  it('supports the Ungrouped Attribute queue without loading the library', async () => {
    attributeDefinition.count.mockResolvedValue(3);
    attributeDefinition.findMany.mockResolvedValue([fuelType]);

    await service.listAdminAttributesPage({
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

  it('summarizes Attribute counts by group in one grouped query', async () => {
    const groupId = '88888888-8888-4888-8888-888888888888';
    attributeDefinition.groupBy.mockResolvedValue([
      { groupId, _count: { _all: 12 } },
      { groupId: null, _count: { _all: 4 } },
    ]);

    await expect(service.getAdminAttributeSummary()).resolves.toEqual({
      total: 16,
      ungrouped: 4,
      groupCounts: { [groupId]: 12 },
    });
    expect(attributeDefinition.groupBy).toHaveBeenCalledWith({
      by: ['groupId'],
      _count: { _all: true },
    });
    expect(attributeDefinition.findMany).not.toHaveBeenCalled();
  });

  it('loads one Attribute directly instead of scanning the library', async () => {
    attributeDefinition.findUnique.mockResolvedValue(fuelType);

    await expect(service.getAdminAttribute(fuelType.id)).resolves.toEqual(
      fuelType,
    );
    expect(attributeDefinition.findUnique).toHaveBeenCalledWith({
      where: { id: fuelType.id },
      select: expect.any(Object),
    });
    expect(attributeDefinition.findMany).not.toHaveBeenCalled();
  });

  it('creates grouped V2 Attribute metadata and audits it', async () => {
    const groupId = '88888888-8888-4888-8888-888888888888';
    attributeDefinition.create.mockResolvedValue({
      ...fuelType,
      code: 'ATTR_TERMINAL_STYLE',
      name: 'Terminal Style',
      scope: AttributeScope.PRODUCT,
      groupId,
      exampleValue: 'Blade',
      repeatable: true,
      translatable: true,
    });

    const result = await service.createAttribute(
      {
        code: 'ATTR_TERMINAL_STYLE',
        name: ' Terminal Style ',
        groupId,
        dataType: AttributeDataType.SELECT,
        scope: AttributeScope.PRODUCT,
        valueSource: AttributeValueSource.STATIC,
        description: ' Electrical terminal style ',
        exampleValue: ' Blade ',
        repeatable: true,
        translatable: true,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      groupId,
      code: 'ATTR_TERMINAL_STYLE',
      exampleValue: 'Blade',
      repeatable: true,
      translatable: true,
    });
    expect(attributeGroup.findUnique).toHaveBeenCalledWith({
      where: { id: groupId },
      select: { id: true, status: true },
    });
    expect(attributeDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId,
        exampleValue: 'Blade',
        repeatable: true,
        translatable: true,
      }),
    });
  });

  it('creates an immutable-code attribute definition and audits it', async () => {
    attributeDefinition.create.mockResolvedValue({
      ...fuelType,
      code: 'ATTR_TERMINAL_STYLE',
      name: 'Terminal Style',
      scope: AttributeScope.PRODUCT,
      description: 'Electrical terminal style',
    });

    const result = await service.createAttribute(
      {
        code: 'ATTR_TERMINAL_STYLE',
        name: ' Terminal Style ',
        dataType: AttributeDataType.SELECT,
        scope: AttributeScope.PRODUCT,
        valueSource: AttributeValueSource.STATIC,
        description: ' Electrical terminal style ',
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      code: 'ATTR_TERMINAL_STYLE',
      name: 'Terminal Style',
      valueSource: AttributeValueSource.STATIC,
    });
    expect(result).not.toHaveProperty('createdById');
    expect(attributeDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'ATTR_TERMINAL_STYLE',
        name: 'Terminal Style',
        description: 'Electrical terminal style',
        createdById: actorId,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ATTRIBUTE_DEFINITION_CREATED',
        }),
      }),
    );
  });

  it('rejects nontechnical article and commerce fields as generic attributes', async () => {
    await expect(
      service.createAttribute(
        {
          code: 'ATTR_GTIN',
          name: 'GTIN',
          dataType: AttributeDataType.TEXT,
          scope: AttributeScope.PRODUCT,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTRIBUTE_NON_TECHNICAL_DOMAIN_RESERVED',
      }),
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects renaming a technical Attribute into a reserved commercial field', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...fuelType,
      code: 'ATTR_AMOUNT',
      name: 'Amount',
      scope: AttributeScope.PRODUCT,
    });

    await expect(
      service.updateAttribute(
        fuelType.id,
        { version: 1, name: 'Selling Price' },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTRIBUTE_NON_TECHNICAL_DOMAIN_RESERVED',
      }),
    });

    expect(attributeDefinition.update).not.toHaveBeenCalled();
  });

  it('moves an Attribute between V2 groups with optimistic versioning', async () => {
    const groupId = '88888888-8888-4888-8888-888888888888';
    const terminalStyle = {
      ...fuelType,
      code: 'ATTR_TERMINAL_STYLE',
      name: 'Terminal Style',
      scope: AttributeScope.PRODUCT,
      description: 'Electrical terminal style',
    };
    attributeDefinition.findUnique.mockResolvedValue(terminalStyle);
    attributeDefinition.update.mockResolvedValue({
      ...terminalStyle,
      groupId,
      exampleValue: 'Blade',
      version: 2,
    });

    const result = await service.updateAttribute(
      terminalStyle.id,
      {
        version: 1,
        groupId,
        exampleValue: ' Blade ',
      },
      actorId,
    );

    expect(result).toMatchObject({
      groupId,
      exampleValue: 'Blade',
      version: 2,
    });
    expect(attributeDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId,
          exampleValue: 'Blade',
        }),
      }),
    );
  });

  it('rejects a stale attribute definition update', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...fuelType,
      version: 2,
    });

    await expect(
      service.updateAttribute(
        fuelType.id,
        { version: 1, name: 'Fuel' },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_VERSION_CONFLICT' },
    });
    expect(attributeDefinition.update).not.toHaveBeenCalled();
  });

  it('routes Attribute retirement through the governed lifecycle endpoint', async () => {
    attributeDefinition.findUnique.mockResolvedValue(fuelType);

    await expect(
      service.updateAttribute(
        fuelType.id,
        { version: 1, status: MasterDataStatus.DEPRECATED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });
    expect(attributeAllowedValue.findFirst).not.toHaveBeenCalled();
    expect(attributeDefinition.update).not.toHaveBeenCalled();
  });


  it('does not let normal Attribute editing bypass lifecycle governance', async () => {
    attributeDefinition.findUnique.mockResolvedValue(fuelType);

    await expect(
      service.updateAttribute(
        fuelType.id,
        { version: 1, status: MasterDataStatus.ARCHIVED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED' },
    });

    expect(productTypeAttributeAssignment.findFirst).not.toHaveBeenCalled();
    expect(attributeDefinition.update).not.toHaveBeenCalled();
  });

  it('allows static allowed values only on STATIC attributes', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...fuelType,
      valueSource: AttributeValueSource.REFERENCE,
    });

    await expect(
      service.createAllowedValue(
        fuelType.id,
        { code: 'DIESEL', label: 'Diesel' },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_VALUES_NOT_STATIC' },
    });
    expect(attributeAllowedValue.create).not.toHaveBeenCalled();
  });

  it('requires an active attribute before activating an allowed value', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      ...fuelType,
      status: MasterDataStatus.DRAFT,
    });

    await expect(
      service.createAllowedValue(
        fuelType.id,
        {
          code: 'DIESEL',
          label: 'Diesel',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_NOT_ACTIVE' },
    });
  });

  it('creates a static allowed value and records audit evidence', async () => {
    attributeDefinition.findUnique.mockResolvedValue(fuelType);
    attributeAllowedValue.create.mockResolvedValue(diesel);

    const result = await service.createAllowedValue(
      fuelType.id,
      {
        code: 'DIESEL',
        label: ' Diesel ',
        sortOrder: 1,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(result).toMatchObject({
      attributeId: fuelType.id,
      code: 'DIESEL',
      label: 'Diesel',
    });
    expect(attributeAllowedValue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attributeId: fuelType.id,
        code: 'DIESEL',
        label: 'Diesel',
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ATTRIBUTE_ALLOWED_VALUE_CREATED',
        }),
      }),
    );
  });

  it('updates allowed values with optimistic versioning and immutable code', async () => {
    attributeDefinition.findUnique.mockResolvedValue(fuelType);
    attributeAllowedValue.findFirst.mockResolvedValue(diesel);
    attributeAllowedValue.update.mockResolvedValue({
      ...diesel,
      label: 'Diesel Fuel',
      version: 2,
    });

    const result = await service.updateAllowedValue(
      fuelType.id,
      diesel.id,
      { version: 1, label: ' Diesel Fuel ' },
      actorId,
    );

    expect(result).toMatchObject({ label: 'Diesel Fuel', version: 2 });
    expect(attributeAllowedValue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: diesel.id, version: 1 },
        data: expect.not.objectContaining({ code: expect.anything() }),
      }),
    );
  });

  it('exports the filtered Attribute library with canonical group codes', async () => {
    const groupId = '88888888-8888-4888-8888-888888888888';
    attributeDefinition.findMany.mockResolvedValue([
      { ...fuelType, groupId },
    ]);
    attributeGroup.findMany.mockResolvedValue([
      { id: groupId, code: 'VEHICLE_CORE' },
    ]);

    const result = await service.exportAttributesCsv({
      search: 'fuel',
      status: MasterDataStatus.ACTIVE,
      sortBy: AttributeAdminSortBy.CODE,
      sortDirection: AdminSortDirection.ASC,
    });

    expect(result.filename).toBe('lemekinaye-attributes.csv');
    expect(result.csv).toContain(
      'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status',
    );
    expect(result.csv).toContain(
      'ATTR_FUEL_TYPE,Fuel Type,VEHICLE_CORE,SELECT,VEHICLE,STATIC',
    );
    expect(attributeDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MasterDataStatus.ACTIVE,
          OR: expect.any(Array),
        }),
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('previews valid Attribute CSV rows without writing data', async () => {
    const groupId = '88888888-8888-4888-8888-888888888888';
    attributeGroup.findMany.mockResolvedValue([
      {
        id: groupId,
        code: 'VEHICLE_CORE',
        status: MasterDataStatus.ACTIVE,
      },
    ]);
    attributeDefinition.findMany.mockResolvedValue([]);

    const preview = await service.previewAttributeCsvImport({
      csv:
        'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status\n' +
        'ATTR_ENGINE_CODE,Engine Code,VEHICLE_CORE,TEXT,VEHICLE,NONE,,,2ZR-FE,false,false,DRAFT\n',
    });

    expect(preview).toEqual({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      rows: [
        expect.objectContaining({
          rowNumber: 2,
          code: 'ATTR_ENGINE_CODE',
          groupCode: 'VEHICLE_CORE',
          errors: [],
        }),
      ],
    });
    expect(attributeDefinition.create).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('marks nontechnical Attribute CSV rows invalid during preview', async () => {
    attributeGroup.findMany.mockResolvedValue([]);
    attributeDefinition.findMany.mockResolvedValue([]);

    const preview = await service.previewAttributeCsvImport({
      csv:
        'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status\n' +
        'ATTR_AMOUNT,Selling Price,,TEXT,PRODUCT,NONE,,,,false,false,DRAFT\n',
    });

    expect(preview).toMatchObject({
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
    });
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        'Pricing, inventory, identifiers and commercial terms are not generic technical attributes',
      ]),
    );
  });

  it('returns row-level duplicate, missing-group and validation errors', async () => {
    attributeGroup.findMany.mockResolvedValue([]);
    attributeDefinition.findMany.mockResolvedValue([
      { code: 'ATTR_DUPLICATE' },
    ]);

    const preview = await service.previewAttributeCsvImport({
      csv:
        'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status\n' +
        'ATTR_DUPLICATE,First,MISSING_GROUP,NOT_A_TYPE,VEHICLE,NONE,,,,false,false,DRAFT\n' +
        'ATTR_DUPLICATE,Second,,TEXT,VEHICLE,NONE,,,,false,false,DRAFT\n',
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.invalidRows).toBe(2);
    expect(preview.rows[0]?.errors).toEqual(
      expect.arrayContaining([
        'Attribute Group MISSING_GROUP was not found',
        'Attribute code is duplicated within this CSV',
        'Attribute code already exists',
      ]),
    );
    expect(preview.rows[0]?.errors.some((message) => message.includes('dataType'))).toBe(true);
    expect(preview.rows[1]?.errors).toEqual(
      expect.arrayContaining([
        'Attribute code is duplicated within this CSV',
        'Attribute code already exists',
      ]),
    );
  });

  it('rejects Active Attribute import when its group is not Active', async () => {
    attributeGroup.findMany.mockResolvedValue([
      {
        id: '88888888-8888-4888-8888-888888888888',
        code: 'DRAFT_GROUP',
        status: MasterDataStatus.DRAFT,
      },
    ]);
    attributeDefinition.findMany.mockResolvedValue([]);

    const preview = await service.previewAttributeCsvImport({
      csv:
        'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status\n' +
        'ATTR_TEST,Test,DRAFT_GROUP,TEXT,PRODUCT,NONE,,,,false,false,ACTIVE\n',
    });

    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]?.errors).toContain(
      'An Active Attribute requires an Active Attribute Group',
    );
  });

  it('commits valid Attribute CSV rows atomically and audits each create', async () => {
    attributeGroup.findMany.mockResolvedValue([]);
    attributeDefinition.findMany.mockResolvedValue([]);
    attributeDefinition.create
      .mockResolvedValueOnce({
        ...fuelType,
        id: '11111111-1111-4111-8111-111111111111',
        code: 'ATTR_ONE',
        name: 'One',
        dataType: AttributeDataType.TEXT,
        scope: AttributeScope.PRODUCT,
        valueSource: AttributeValueSource.NONE,
        status: MasterDataStatus.DRAFT,
      })
      .mockResolvedValueOnce({
        ...fuelType,
        id: '22222222-2222-4222-8222-222222222222',
        code: 'ATTR_TWO',
        name: 'Two',
        dataType: AttributeDataType.TEXT,
        scope: AttributeScope.PRODUCT,
        valueSource: AttributeValueSource.NONE,
        status: MasterDataStatus.DRAFT,
      });

    const result = await service.commitAttributeCsvImport(
      {
        csv:
          'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status\n' +
          'ATTR_ONE,One,,TEXT,PRODUCT,NONE,,,,false,false,DRAFT\n' +
          'ATTR_TWO,Two,,TEXT,PRODUCT,NONE,,,,false,false,DRAFT\n',
      },
      actorId,
    );

    expect(result).toEqual({
      createdCount: 2,
      createdCodes: ['ATTR_ONE', 'ATTR_TWO'],
    });
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(attributeDefinition.create).toHaveBeenCalledTimes(2);
    expect(auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('refuses to commit a CSV that fails preview validation', async () => {
    attributeGroup.findMany.mockResolvedValue([]);
    attributeDefinition.findMany.mockResolvedValue([
      { code: 'ATTR_FUEL_TYPE' },
    ]);

    await expect(
      service.commitAttributeCsvImport(
        {
          csv:
            'code,name,groupCode,dataType,scope,valueSource,unit,description,exampleValue,repeatable,translatable,status\n' +
            'ATTR_FUEL_TYPE,Fuel Type,,SELECT,VEHICLE,STATIC,,,,false,false,DRAFT\n',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_IMPORT_INVALID' },
    });
    expect(attributeDefinition.create).not.toHaveBeenCalled();
  });

});
