import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  it('pages newest-first Audit History with server-side filters', async () => {
    const createdAt = new Date('2026-10-05T12:00:00.000Z');
    const count = vi.fn().mockResolvedValue(61);
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        action: 'PRODUCT_TYPE_SCHEMA_PUBLISHED',
        entityType: 'ProductTypeSchemaVersion',
        entityId: '22222222-2222-4222-8222-222222222222',
        metadata: { result: 'success' },
        createdAt,
        actor: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Catalog Admin',
          email: 'catalog@example.com',
        },
      },
    ]);
    const database = {
      auditLog: { count, findMany },
    } as unknown as DatabaseService;
    const service = new AuditService(database);

    await expect(
      service.listAdminAuditLogs({
        search: 'schema',
        action: 'PRODUCT_TYPE_SCHEMA_PUBLISHED',
        entityType: 'ProductTypeSchemaVersion',
        actor: 'catalog',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-06T00:00:00.000Z',
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      total: 61,
      page: 2,
      pageSize: 25,
      pageCount: 3,
      items: [
        {
          action: 'PRODUCT_TYPE_SCHEMA_PUBLISHED',
          entityType: 'ProductTypeSchemaVersion',
          createdAt,
        },
      ],
    });

    expect(count).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.any(Object),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 25,
        take: 25,
      }),
    );
    expect(findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      action: 'PRODUCT_TYPE_SCHEMA_PUBLISHED',
      entityType: 'ProductTypeSchemaVersion',
      createdAt: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-06T00:00:00.000Z'),
      },
    });
  });

  it('redacts secret-like Audit metadata recursively before returning it', async () => {
    const database = {
      auditLog: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: '11111111-1111-4111-8111-111111111111',
            action: 'SECURITY_EVENT',
            entityType: 'Authentication',
            entityId: null,
            metadata: {
              password: 'never-return',
              schemaHash: 'safe-hash',
              nested: {
                refreshToken: 'never-return',
                sourceIpHash: 'safe-source-hash',
              },
              entries: [{ secret: 'never-return', result: 'failure' }],
            },
            createdAt: new Date('2026-10-05T12:00:00.000Z'),
            actor: null,
          },
        ]),
      },
    } as unknown as DatabaseService;
    const service = new AuditService(database);

    const result = await service.listAdminAuditLogs({
      page: 1,
      pageSize: 50,
    });

    expect(result.items[0]?.metadata).toEqual({
      password: '[REDACTED]',
      schemaHash: 'safe-hash',
      nested: {
        refreshToken: '[REDACTED]',
        sourceIpHash: 'safe-source-hash',
      },
      entries: [{ secret: '[REDACTED]', result: 'failure' }],
    });
  });

  it('rejects a reversed Audit History date range before querying', async () => {
    const count = vi.fn();
    const findMany = vi.fn();
    const database = {
      auditLog: { count, findMany },
    } as unknown as DatabaseService;
    const service = new AuditService(database);

    await expect(
      service.listAdminAuditLogs({
        from: '2026-10-06T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
        page: 1,
        pageSize: 50,
      }),
    ).rejects.toMatchObject({
      response: { code: 'AUDIT_DATE_RANGE_INVALID' },
    });

    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('builds an entity version timeline with related Article identity and fitment events', async () => {
    const createdAt = new Date('2026-10-06T12:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        action: 'PRODUCT_MASTER_UPDATED',
        entityType: 'Product',
        entityId: 'product-1',
        metadata: {
          before: { version: 2, status: 'DRAFT', name: 'Old' },
          after: { version: 3, status: 'ACTIVE', name: 'New' },
        },
        createdAt,
        actor: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Catalog Admin',
          email: 'catalog@example.com',
        },
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        action: 'PART_NUMBER_UPDATED',
        entityType: 'PartNumber',
        entityId: 'part-number-1',
        metadata: {
          productId: 'product-1',
          before: { version: 1, status: 'DRAFT' },
          after: { version: 2, status: 'ACTIVE' },
        },
        createdAt,
        actor: null,
      },
    ]);
    const database = {
      auditLog: { findMany },
    } as unknown as DatabaseService;
    const service = new AuditService(database);

    const result = await service.getEntityHistory(
      'Product',
      'product-1',
      { includeRelated: true, limit: 100 },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        scope: 'SELF',
        versionBefore: 2,
        versionAfter: 3,
        lifecycleBefore: 'DRAFT',
        lifecycleAfter: 'ACTIVE',
        changedFields: ['name', 'status', 'version'],
      }),
      expect.objectContaining({
        scope: 'RELATED',
        versionBefore: 1,
        versionAfter: 2,
      }),
    ]);
  });

});
