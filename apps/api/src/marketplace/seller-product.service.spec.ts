import { MasterDataStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { InventoryService } from './inventory.service.js';
import type { SellerService } from './seller.service.js';
import { SellerProductService } from './seller-product.service.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const defaultId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const shopId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const productId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function setup() {
  const tx = {
    sellerProduct: {
      create: vi.fn().mockResolvedValue({ id: productId }),
    },
    inventory: {
      create: vi.fn().mockResolvedValue({ id: 'stock-id' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'stock-id' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const persisted = {
    id: productId,
    sellerId,
    productId: null,
    sku: 'SKU-001',
    name: 'Oil Filter',
    condition: 'NEW',
    packageQuantity: 1,
    packageUnit: 'PIECE',
    status: MasterDataStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    listing: null,
    inventories: [],
  };
  const database = {
    inventoryLocation: {
      findFirst: vi.fn().mockResolvedValue({ id: defaultId }),
    },
    sellerProduct: {
      findFirst: vi.fn().mockResolvedValue(persisted),
      findMany: vi.fn().mockResolvedValue([persisted]),
    },
    product: { findFirst: vi.fn().mockResolvedValue({ id: 'article-id', name: 'Canonical Oil Filter' }) },
    inventory: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const sellers = {
    requireOperationalSellerByUser: vi.fn().mockResolvedValue({ id: sellerId }),
  };
  const inventory = { syncListingAvailability: vi.fn().mockResolvedValue(undefined) };
  const service = new SellerProductService(
    database as unknown as DatabaseService,
    sellers as unknown as SellerService,
    inventory as unknown as InventoryService,
  );
  return { service, database, tx, sellers, inventory };
}

describe('Seller Product inventory-first workflows', () => {
  it('creates default Store association at zero and selected Location with opening stock', async () => {
    const { service, database, tx } = setup();
    vi.mocked(database.inventoryLocation.findFirst)
      .mockResolvedValueOnce({ id: shopId } as never)
      .mockResolvedValueOnce({ id: defaultId } as never);
    await service.create({
      productId: 'article-id',
      sku: ' SKU-001 ',
      locationId: shopId,
      openingQuantity: 7,
    }, userId);

    expect(tx.inventory.create).toHaveBeenCalledTimes(2);
    const rows = (tx.inventory.create.mock.calls as unknown as Array<[{
      data: { locationId: string; quantityOnHand: number };
    }]>).map(([call]) => call);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ data: expect.objectContaining({ locationId: defaultId, quantityOnHand: 0 }) }),
      expect.objectContaining({ data: expect.objectContaining({ locationId: shopId, quantityOnHand: 7 }) }),
    ]));
    expect(tx.sellerProduct.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'article-id', name: 'Canonical Oil Filter' }),
    }));
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        quantityDelta: 7,
        reason: 'Opening stock',
      }),
    }));
  });

  it('rejects an Inventory request without an Article ID, even if a caller bypasses the UI', async () => {
    const { service, tx } = setup();
    await expect(service.create({ productId: '' }, userId)).rejects.toMatchObject({
      response: { code: 'MANUFACTURER_ARTICLE_REQUIRED' },
    });
    expect(tx.sellerProduct.create).not.toHaveBeenCalled();
  });

  it('rejects adding products before a Default Store exists', async () => {
    const { service, database, tx } = setup();
    vi.mocked(database.inventoryLocation.findFirst).mockResolvedValue(null);
    await expect(service.create({ productId: 'article-id' }, userId)).rejects.toMatchObject({
      response: { code: 'DEFAULT_LOCATION_REQUIRED' },
    });
    expect(tx.sellerProduct.create).not.toHaveBeenCalled();
  });

  it('denies Seller Product creation with an unrelated Manufacturer Article', async () => {
    const { service, database, tx } = setup();
    vi.mocked(database.product.findFirst).mockResolvedValue(null);
    await expect(service.create({ productId: 'article-id' }, userId))
      .rejects.toMatchObject({ response: { code: 'MANUFACTURER_ARTICLE_UNAVAILABLE' } });
    expect(tx.sellerProduct.create).not.toHaveBeenCalled();
  });

  it('ignores a client-provided name and derives it from the selected Article', async () => {
    const { service, tx } = setup();
    await service.create({ productId: 'article-id', name: 'Fake Product Name' }, userId);
    expect(tx.sellerProduct.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Canonical Oil Filter' }),
    }));
  });

  it('rejects stock reductions below existing reservations', async () => {
    const { service, database, tx } = setup();
    vi.mocked(database.inventory.findFirst).mockResolvedValue({
      id: 'stock-id',
      version: 1,
      quantityOnHand: 10,
      quantityReserved: 7,
      safetyStock: 0,
      lowStockThreshold: 0,
      listingId: null,
    } as never);
    await expect(service.adjustStock(productId, {
      locationId: shopId, version: 1, delta: -4, reason: 'Cycle count',
    }, userId)).rejects.toMatchObject({ response: { code: 'STOCK_BELOW_RESERVATIONS' } });
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('reuses the same canonical Article for separate Sellers without creating another Article', async () => {
    const first = setup();
    const second = setup();
    second.sellers.requireOperationalSellerByUser.mockResolvedValue({ id: 'other-seller' });
    await first.service.create({ productId: 'shared-article' }, userId);
    await second.service.create({ productId: 'shared-article' }, userId);
    expect(first.tx.sellerProduct.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'shared-article', sellerId }),
    }));
    expect(second.tx.sellerProduct.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'shared-article', sellerId: 'other-seller' }),
    }));
    expect(first.database.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'shared-article', OR: [
        { status: 'ACTIVE' }, { status: 'DRAFT', sourceSellerId: sellerId },
      ] },
    }));
  });

  it('returns only the signed-in Seller\'s own products', async () => {
    const { service, database, sellers } = setup();
    await service.list(userId);
    expect(sellers.requireOperationalSellerByUser).toHaveBeenCalledWith(userId);
    expect(database.sellerProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sellerId }) }),
    );
  });
});
