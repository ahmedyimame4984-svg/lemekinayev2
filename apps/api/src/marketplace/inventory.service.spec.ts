import {
  InventoryAvailabilityStatus,
  InventoryLocationType,
  InventoryMovementType,
  ProductStatus,
  ProductTypeRequirementLevel,
  SellerListingStatus,
  SellerStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerService } from './seller.service.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  const inventoryLocation = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };
  const inventory = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const inventoryMovement = { create: vi.fn() };
  const sellerListing = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const product = { findUnique: vi.fn() };
  const auditLog = { create: vi.fn() };
  const database = {
    inventoryLocation,
    inventory,
    inventoryMovement,
    sellerListing,
    product,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          inventoryLocation,
          inventory,
          inventoryMovement,
          sellerListing,
          product,
          auditLog,
        }),
    ),
  };
  const sellers = { requireOperationalSellerByUser: vi.fn() };
  const service = new InventoryService(
    database as unknown as DatabaseService,
    sellers as unknown as SellerService,
  );

  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const listingId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const productId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const locationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const inventoryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const now = new Date('2026-10-01T06:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    sellers.requireOperationalSellerByUser.mockResolvedValue({
      id: sellerId,
      status: SellerStatus.ACTIVE,
    });
    sellerListing.findFirst.mockResolvedValue({
      id: listingId,
      sellerProductId: '99999999-9999-4999-8999-999999999999',
      product: {
        schemaVersion: {
          snapshot: {
            offerRequirements: {
              stock: ProductTypeRequirementLevel.REQUIRED,
            },
          },
        },
      },
    });
    sellerListing.findUnique.mockResolvedValue({
      id: listingId,
      productId,
      status: SellerListingStatus.DRAFT,
      version: 1,
      inventories: [],
    });
    product.findUnique.mockResolvedValue({
      status: ProductStatus.ACTIVE,
    });
    inventoryLocation.findFirst.mockResolvedValue({ id: locationId });
    inventory.create.mockResolvedValue({ id: inventoryId });
    const persistedInventory = {
      id: inventoryId,
      listingId,
      locationId,
      quantityOnHand: 10,
      quantityReserved: 0,
      safetyStock: 2,
      lowStockThreshold: 3,
      availabilityStatus: InventoryAvailabilityStatus.IN_STOCK,
      version: 1,
      updatedAt: now,
    };
    inventory.findFirst.mockResolvedValue(persistedInventory);
    inventory.findUnique.mockResolvedValue(persistedInventory);
    auditLog.create.mockResolvedValue({});
    inventoryMovement.create.mockResolvedValue({});
  });

  it('blocks inventory when the immutable Offer policy marks stock not applicable', async () => {
    sellerListing.findFirst.mockResolvedValue({
      id: listingId,
      product: {
        schemaVersion: {
          snapshot: {
            offerRequirements: {
              stock: ProductTypeRequirementLevel.NOT_APPLICABLE,
            },
          },
        },
      },
    });

    await expect(
      service.createForSellerUser(
        listingId,
        {
          locationId,
          quantityOnHand: 1,
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'LISTING_INVENTORY_NOT_APPLICABLE' },
    });

    expect(inventory.create).not.toHaveBeenCalled();
  });

  it('creates Seller inventory and records the initial receipt movement', async () => {
    const result = await service.createForSellerUser(
      listingId,
      {
        locationId,
        quantityOnHand: 10,
        safetyStock: 2,
        lowStockThreshold: 3,
      },
      userId,
    );

    expect(inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId,
          locationId,
          quantityOnHand: 10,
          availabilityStatus: InventoryAvailabilityStatus.IN_STOCK,
        }),
      }),
    );
    expect(inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: InventoryMovementType.RECEIPT,
          quantityDelta: 10,
        }),
      }),
    );
    expect(result.quantityAvailable).toBe(8);
  });

  it('reserves only sellable quantity and audits the reservation movement', async () => {
    inventory.updateMany.mockResolvedValue({ count: 1 });
    inventory.findFirst
      .mockResolvedValueOnce({ id: inventoryId }) // online-fulfillment eligibility
      .mockResolvedValueOnce({
        id: inventoryId,
        listingId,
        locationId,
        quantityOnHand: 10,
        quantityReserved: 3,
        safetyStock: 2,
        lowStockThreshold: 3,
        availabilityStatus: InventoryAvailabilityStatus.LOW_STOCK,
        version: 2,
        updatedAt: now,
      });
    sellerListing.findUnique.mockResolvedValue({
      id: listingId,
      status: SellerListingStatus.DRAFT,
      version: 1,
      inventories: [],
    });

    const result = await service.reserveForSystem(
      inventoryId,
      3,
      userId,
      'Order',
      'ORDER-001',
    );

    expect(inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityReserved: 3,
        }),
      }),
    );
    expect(inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: InventoryMovementType.RESERVATION,
          reservedDelta: 3,
          referenceType: 'Order',
          referenceId: 'ORDER-001',
        }),
      }),
    );
    expect(result.quantityReserved).toBe(3);
  });

  it('rejects adjustments that would make stock negative', async () => {
    await expect(
      service.adjustForSellerUser(
        listingId,
        inventoryId,
        {
          version: 1,
          delta: -11,
          movementType: InventoryMovementType.ADJUSTMENT,
          reason: 'Cycle count correction',
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'INVENTORY_NEGATIVE_NOT_ALLOWED' },
    });
    expect(inventory.updateMany).not.toHaveBeenCalled();
  });

  it('keeps an OUT_OF_STOCK listing from reactivating when its Article is inactive', async () => {
    inventory.updateMany.mockResolvedValue({ count: 1 });
    sellerListing.findUnique.mockResolvedValue({
      id: listingId,
      productId,
      status: SellerListingStatus.OUT_OF_STOCK,
      version: 1,
      inventories: [
        {
          quantityOnHand: 10,
          quantityReserved: 0,
          safetyStock: 0,
          location: { onlineFulfillmentEnabled: true, status: 'ACTIVE' },
        },
      ],
    });
    product.findUnique.mockResolvedValue({
      status: ProductStatus.INACTIVE,
    });

    await expect(
      service.adjustForSellerUser(
        listingId,
        inventoryId,
        {
          version: 1,
          delta: 1,
          movementType: InventoryMovementType.ADJUSTMENT,
          reason: 'Restock count correction',
        },
        userId,
      ),
    ).resolves.toMatchObject({ id: inventoryId });

    expect(sellerListing.updateMany).not.toHaveBeenCalled();
  });

  it('automatically makes the first Location the default and keeps online fulfillment disabled', async () => {
    inventoryLocation.findFirst.mockResolvedValueOnce(null);
    inventoryLocation.create.mockResolvedValue({
      id: locationId, sellerId, code: 'MAIN', name: 'Main Store',
      type: InventoryLocationType.BRANCH,
      addressText: null, isDefault: true, onlineFulfillmentEnabled: false, version: 1,
    });
    await service.createLocationForSellerUser({
      code: 'MAIN',
      name: 'Main Store',
      type: InventoryLocationType.BRANCH,
    }, userId);
    expect(inventoryLocation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isDefault: true,
        onlineFulfillmentEnabled: false,
      }),
    }));
  });

  it('rejects online stock reservations at ineligible Locations', async () => {
    inventory.findFirst.mockResolvedValueOnce(null);
    await expect(service.reserveForSystem(
      inventoryId, 1, userId, 'Order', 'ORDER-001',
    )).rejects.toMatchObject({
      response: { code: 'ONLINE_FULFILLMENT_UNAVAILABLE' },
    });
    expect(inventory.updateMany).not.toHaveBeenCalled();
  });

  it('creates Seller inventory locations scoped to the Seller', async () => {
    inventoryLocation.create.mockResolvedValue({
      id: locationId,
      sellerId,
      code: 'MAIN',
      name: 'Main Warehouse',
      type: InventoryLocationType.WAREHOUSE,
      addressText: null,
      version: 1,
    });

    const result = await service.createLocationForSellerUser(
      {
        code: ' main ',
        name: ' Main Warehouse ',
        type: InventoryLocationType.WAREHOUSE,
      },
      userId,
    );

    expect(inventoryLocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId,
          code: 'MAIN',
          name: 'Main Warehouse',
        }),
      }),
    );
    expect(result.sellerId).toBe(sellerId);
  });
});
