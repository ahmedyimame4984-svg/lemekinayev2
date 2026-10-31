import {
  MasterDataStatus,
  Prisma,
} from '@prisma/client';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { CatalogAttributeMasterV2Service } from './catalog-attribute-master-v2.service.js';

describe('CatalogAttributeMasterV2Service', () => {
  const now = new Date('2026-10-03T09:00:00.000Z');
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const dimensionId = '11111111-1111-4111-8111-111111111111';
  const unitId = '22222222-2222-4222-8222-222222222222';
  const optionSetId = '33333333-3333-4333-8333-333333333333';
  const attributeId = '44444444-4444-4444-8444-444444444444';

  const attributeGroup = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeOptionSet = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeOptionValue = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const unitDimension = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeUnit = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeAlias = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const attributeDefinition = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const productTypeAttributeAssignment = {
    findFirst: vi.fn(),
  };
  const productAttributeValue = {
    findFirst: vi.fn(),
  };
  const auditLog = {
    create: vi.fn(),
  };

  const tx = {
    attributeGroup,
    attributeOptionSet,
    attributeOptionValue,
    unitDimension,
    attributeUnit,
    attributeAlias,
    attributeDefinition,
    productTypeAttributeAssignment,
    productAttributeValue,
    auditLog,
  };

  const database = {
    ...tx,
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };

  const service = new CatalogAttributeMasterV2Service(
    database as unknown as DatabaseService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('creates and audits an Attribute Group', async () => {
    attributeGroup.create.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      code: 'DIMENSIONS',
      name: 'Dimensions & Physical',
      description: null,
      sortOrder: 10,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdById: actorId,
      updatedById: actorId,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.createGroup(
        {
          code: 'DIMENSIONS',
          name: ' Dimensions & Physical ',
          sortOrder: 10,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      code: 'DIMENSIONS',
      name: 'Dimensions & Physical',
      status: MasterDataStatus.ACTIVE,
    });

    expect(attributeGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'DIMENSIONS',
        name: 'Dimensions & Physical',
        createdById: actorId,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ATTRIBUTE_GROUP_CREATED',
        }),
      }),
    );
  });

  it('rejects nontechnical Attribute Groups', async () => {
    await expect(
      service.createGroup(
        {
          code: 'PRICING',
          name: 'Pricing',
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTRIBUTE_GROUP_NON_TECHNICAL_DOMAIN_RESERVED',
      }),
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects technical-looking Attribute Groups with commercial names', async () => {
    await expect(
      service.createGroup(
        {
          code: 'SELLER_DATA',
          name: 'Pricing & Inventory',
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ATTRIBUTE_GROUP_NON_TECHNICAL_DOMAIN_RESERVED',
      }),
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('blocks Attribute Group deactivation while an active Attribute uses it', async () => {
    attributeGroup.findUnique.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      code: 'DIMENSIONS',
      name: 'Dimensions',
      description: null,
      sortOrder: 0,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdById: actorId,
      updatedById: actorId,
      createdAt: now,
      updatedAt: now,
    });
    attributeDefinition.findFirst.mockResolvedValue({ id: attributeId });

    await expect(
      service.updateGroup(
        '55555555-5555-4555-8555-555555555555',
        { version: 1, status: MasterDataStatus.INACTIVE },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_GROUP_IN_USE' },
    });

    expect(attributeGroup.update).not.toHaveBeenCalled();
  });

  it('requires an active Option Set before activating an Option Value', async () => {
    attributeOptionSet.findUnique.mockResolvedValue({
      id: optionSetId,
      status: MasterDataStatus.DRAFT,
    });

    await expect(
      service.createOptionValue(
        optionSetId,
        {
          code: 'DIESEL',
          label: 'Diesel',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_OPTION_SET_NOT_ACTIVE' },
    });

    expect(attributeOptionValue.create).not.toHaveBeenCalled();
  });

  it('enforces base-unit conversion identity', async () => {
    unitDimension.findUnique.mockResolvedValue({
      id: dimensionId,
      status: MasterDataStatus.ACTIVE,
    });

    await expect(
      service.createUnit(
        dimensionId,
        {
          code: 'MM',
          name: 'Millimetre',
          symbol: 'mm',
          isBase: true,
          factorToBase: '0.001',
          offsetToBase: '0',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_BASE_UNIT_CONVERSION_INVALID' },
    });

    expect(attributeUnit.create).not.toHaveBeenCalled();
  });

  it('allows only one base unit per Unit Dimension', async () => {
    unitDimension.findUnique.mockResolvedValue({
      id: dimensionId,
      status: MasterDataStatus.ACTIVE,
    });
    attributeUnit.findFirst.mockResolvedValue({ id: unitId });

    await expect(
      service.createUnit(
        dimensionId,
        {
          code: 'M',
          name: 'Metre',
          symbol: 'm',
          isBase: true,
          factorToBase: '1',
          offsetToBase: '0',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'UNIT_DIMENSION_BASE_UNIT_EXISTS' },
    });
  });

  it('blocks Unit deactivation when product values still reference it', async () => {
    unitDimension.findUnique.mockResolvedValue({
      id: dimensionId,
      status: MasterDataStatus.ACTIVE,
    });
    attributeUnit.findFirst.mockResolvedValueOnce({
      id: unitId,
      dimensionId,
      code: 'MM',
      name: 'Millimetre',
      symbol: 'mm',
      isBase: false,
      factorToBase: new Prisma.Decimal('0.001'),
      offsetToBase: new Prisma.Decimal('0'),
      sortOrder: 1,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdById: actorId,
      updatedById: actorId,
      createdAt: now,
      updatedAt: now,
    });
    attributeDefinition.findFirst.mockResolvedValue(null);
    productTypeAttributeAssignment.findFirst.mockResolvedValue(null);
    productAttributeValue.findFirst.mockResolvedValue({ id: 'product-value-1' });

    await expect(
      service.updateUnit(
        dimensionId,
        unitId,
        { version: 1, status: MasterDataStatus.INACTIVE },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTRIBUTE_UNIT_IN_USE' },
    });

    expect(attributeUnit.update).not.toHaveBeenCalled();
  });

  it('normalizes aliases for duplicate detection while preserving display text', async () => {
    attributeDefinition.findUnique.mockResolvedValue({
      id: attributeId,
      status: MasterDataStatus.ACTIVE,
    });
    attributeAlias.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: '66666666-6666-4666-8666-666666666666',
        ...data,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const result = await service.createAlias(
      attributeId,
      {
        alias: '  Outside   Diameter  ',
        locale: 'en',
      },
      actorId,
    );

    expect(result).toMatchObject({
      alias: 'Outside   Diameter',
      normalizedAlias: 'outside diameter',
      locale: 'en',
    });
    expect(attributeAlias.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attributeId,
        alias: 'Outside   Diameter',
        normalizedAlias: 'outside diameter',
      }),
    });
  });
});
