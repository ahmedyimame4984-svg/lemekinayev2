import { describe, expect, it, vi } from 'vitest';
import { MasterDataStatus, ProductStatus } from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import type { DatabaseService } from '../database/database.service.js';
import { SupplierAdminSortBy } from './dto/supplier.dto.js';
import { SourcingService } from './sourcing.service.js';

const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const supplierId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const productId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const offerId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('SourcingService', () => {
  it('pages Supplier Master with server-side search and filters', async () => {
    const supplier = {
      id: supplierId,
      code: 'BOSCH_ET',
      name: 'Bosch Ethiopia',
      supplierType: 'DISTRIBUTOR',
      countryCode: 'ET',
      contactEmail: 'sales@example.com',
      website: null,
      notes: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: new Date('2026-10-05T00:00:00.000Z'),
      updatedAt: new Date('2026-10-05T00:00:00.000Z'),
    };
    const count = vi.fn().mockResolvedValue(61);
    const findMany = vi.fn().mockResolvedValue([supplier]);
    const database = {
      supplier: { count, findMany },
    } as unknown as DatabaseService;

    const service = new SourcingService(database);

    await expect(
      service.listSuppliersPage({
        search: 'bosch',
        status: MasterDataStatus.ACTIVE,
        supplierType: 'DISTRIBUTOR',
        countryCode: 'ET',
        page: 2,
        pageSize: 25,
        sortBy: SupplierAdminSortBy.UPDATED_AT,
        sortDirection: AdminSortDirection.DESC,
      }),
    ).resolves.toEqual({
      items: [supplier],
      total: 61,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      status: MasterDataStatus.ACTIVE,
      countryCode: 'ET',
      supplierType: 'DISTRIBUTOR',
      OR: [
        { name: { contains: 'bosch', mode: 'insensitive' } },
        { code: { contains: 'bosch', mode: 'insensitive' } },
        { contactEmail: { contains: 'bosch', mode: 'insensitive' } },
      ],
    };

    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith({
      where,
      select: expect.any(Object),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: 25,
      take: 25,
    });
  });

  it('updates selected Supplier lifecycle atomically in bulk', async () => {
    const now = new Date('2026-10-05T00:00:00.000Z');
    const secondSupplierId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const first = {
      id: supplierId,
      code: 'BOSCH_ET',
      name: 'Bosch Ethiopia',
      supplierType: 'DISTRIBUTOR',
      countryCode: 'ET',
      contactEmail: null,
      website: null,
      notes: null,
      status: MasterDataStatus.DRAFT,
      version: 2,
      createdAt: now,
      updatedAt: now,
    };
    const second = {
      ...first,
      id: secondSupplierId,
      code: 'DENSO_ET',
      name: 'Denso Ethiopia',
      version: 3,
    };
    const findMany = vi.fn().mockResolvedValue([first, second]);
    const update = vi.fn()
      .mockResolvedValueOnce({
        ...first,
        status: MasterDataStatus.ACTIVE,
        version: 3,
      })
      .mockResolvedValueOnce({
        ...second,
        status: MasterDataStatus.ACTIVE,
        version: 4,
      });
    const offerFindFirst = vi.fn().mockResolvedValue(null);
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit' });
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        supplier: { findMany, update },
        supplierOffer: { findFirst: offerFindFirst },
        auditLog: { create: auditCreate },
      }),
    );
    const database = {
      $transaction: transaction,
    } as unknown as DatabaseService;
    const service = new SourcingService(database);

    await expect(
      service.bulkUpdateSupplierStatus(
        {
          items: [
            { id: supplierId, version: 2 },
            { id: secondSupplierId, version: 3 },
          ],
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      updated: 2,
      items: [
        { id: supplierId, status: MasterDataStatus.ACTIVE, version: 3 },
        { id: secondSupplierId, status: MasterDataStatus.ACTIVE, version: 4 },
      ],
    });

    expect(update).toHaveBeenCalledTimes(2);
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(offerFindFirst).not.toHaveBeenCalled();
  });

  it('blocks the whole Supplier bulk lifecycle change on Active Offers', async () => {
    const now = new Date('2026-10-05T00:00:00.000Z');
    const activeSupplier = {
      id: supplierId,
      code: 'BOSCH_ET',
      name: 'Bosch Ethiopia',
      supplierType: 'DISTRIBUTOR',
      countryCode: 'ET',
      contactEmail: null,
      website: null,
      notes: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const findMany = vi.fn().mockResolvedValue([activeSupplier]);
    const update = vi.fn();
    const offerFindFirst = vi.fn().mockResolvedValue({ supplierId });
    const auditCreate = vi.fn();
    const database = {
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          supplier: { findMany, update },
          supplierOffer: { findFirst: offerFindFirst },
          auditLog: { create: auditCreate },
        }),
      ),
    } as unknown as DatabaseService;
    const service = new SourcingService(database);

    await expect(
      service.bulkUpdateSupplierStatus(
        {
          items: [{ id: supplierId, version: 1 }],
          status: MasterDataStatus.INACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SUPPLIER_BULK_HAS_ACTIVE_OFFERS' },
    });

    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('blocks all Supplier bulk writes when a selected version is stale', async () => {
    const now = new Date('2026-10-05T00:00:00.000Z');
    const current = {
      id: supplierId,
      code: 'BOSCH_ET',
      name: 'Bosch Ethiopia',
      supplierType: 'DISTRIBUTOR',
      countryCode: 'ET',
      contactEmail: null,
      website: null,
      notes: null,
      status: MasterDataStatus.ACTIVE,
      version: 2,
      createdAt: now,
      updatedAt: now,
    };
    const findMany = vi.fn().mockResolvedValue([current]);
    const update = vi.fn();
    const auditCreate = vi.fn();
    const database = {
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          supplier: { findMany, update },
          supplierOffer: { findFirst: vi.fn() },
          auditLog: { create: auditCreate },
        }),
      ),
    } as unknown as DatabaseService;
    const service = new SourcingService(database);

    await expect(
      service.bulkUpdateSupplierStatus(
        {
          items: [{ id: supplierId, version: 1 }],
          status: MasterDataStatus.ARCHIVED,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SUPPLIER_VERSION_CONFLICT' },
    });

    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('blocks Active Supplier Offers when the Supplier is not Active', async () => {
    const database = {
      supplier: {
        findUnique: vi.fn().mockResolvedValue({
          id: supplierId,
          status: MasterDataStatus.DRAFT,
        }),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: productId,
          status: ProductStatus.ACTIVE,
        }),
      },
    } as unknown as DatabaseService;

    const service = new SourcingService(database);

    await expect(
      service.createOffer(
        {
          supplierId,
          productId,
          unitCost: 24.5,
          currency: 'USD',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'SUPPLIER_OFFER_SUPPLIER_NOT_ACTIVE',
      },
    });
  });

  it('rechecks the Manufacturer Article inside Active Supplier Offer creation', async () => {
    const create = vi.fn();
    const auditCreate = vi.fn();
    const productFindUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: productId,
        status: ProductStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: productId,
        status: ProductStatus.INACTIVE,
      });
    const database = {
      supplier: {
        findUnique: vi.fn().mockResolvedValue({
          id: supplierId,
          status: MasterDataStatus.ACTIVE,
        }),
      },
      product: { findUnique: productFindUnique },
      $transaction: vi.fn(
        async (callback: (tx: unknown) => unknown) =>
          callback({
            product: { findUnique: productFindUnique },
            supplierOffer: { create },
            auditLog: { create: auditCreate },
          }),
      ),
    } as unknown as DatabaseService;
    const service = new SourcingService(database);

    await expect(
      service.createOffer(
        {
          supplierId,
          productId,
          unitCost: 24.5,
          currency: 'USD',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SUPPLIER_OFFER_ARTICLE_NOT_ACTIVE' },
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects reversed lead-time ranges before persistence', async () => {
    const database = {
      supplier: {
        findUnique: vi.fn().mockResolvedValue({
          id: supplierId,
          status: MasterDataStatus.ACTIVE,
        }),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: productId,
          status: ProductStatus.ACTIVE,
        }),
      },
    } as unknown as DatabaseService;

    const service = new SourcingService(database);

    await expect(
      service.createOffer(
        {
          supplierId,
          productId,
          unitCost: 24.5,
          currency: 'USD',
          leadTimeDaysMin: 10,
          leadTimeDaysMax: 5,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'SUPPLIER_OFFER_LEAD_TIME_INVALID',
      },
    });
  });

  it('creates a Draft Supplier Offer with audited commercial terms', async () => {
    const create = vi.fn().mockResolvedValue({
      id: offerId,
      supplierId,
      productId,
      supplierSku: 'SUP-001',
      unitCost: { toString: () => '24.5000', valueOf: () => 24.5 },
      currency: 'USD',
      minOrderQuantity: 10,
      orderMultiple: 1,
      availableQuantity: 120,
      leadTimeDaysMin: 3,
      leadTimeDaysMax: 5,
      incoterm: 'FOB',
      originCountryCode: 'AE',
      validFrom: null,
      validTo: null,
      notes: null,
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: new Date('2026-10-05T00:00:00.000Z'),
      updatedAt: new Date('2026-10-05T00:00:00.000Z'),
    });
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit' });
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        supplierOffer: { create },
        auditLog: { create: auditCreate },
      }),
    );

    const database = {
      supplier: {
        findUnique: vi.fn().mockResolvedValue({
          id: supplierId,
          status: MasterDataStatus.ACTIVE,
        }),
      },
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: productId,
          status: ProductStatus.DRAFT,
        }),
      },
      $transaction: transaction,
    } as unknown as DatabaseService;

    const service = new SourcingService(database);
    const result = await service.createOffer(
      {
        supplierId,
        productId,
        supplierSku: 'SUP-001',
        unitCost: 24.5,
        currency: 'USD',
        minOrderQuantity: 10,
        availableQuantity: 120,
        leadTimeDaysMin: 3,
        leadTimeDaysMax: 5,
        incoterm: 'FOB',
        originCountryCode: 'AE',
        status: MasterDataStatus.DRAFT,
      },
      actorId,
    );

    expect(result).toMatchObject({
      id: offerId,
      supplierId,
      productId,
      unitCost: 24.5,
      currency: 'USD',
      minOrderQuantity: 10,
      status: MasterDataStatus.DRAFT,
    });
    expect(create).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });
});
