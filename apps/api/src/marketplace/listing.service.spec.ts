import {
  ArticleSource,
  ProductCondition,
  ProductStatus,
  ProductTypeRequirementLevel,
  SellerApprovalStatus,
  SellerListingStatus,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerService } from './seller.service.js';
import { ListingService } from './listing.service.js';

describe('ListingService', () => {
  const sellerListing = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const listingPrice = {
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const product = { findFirst: vi.fn(), findUnique: vi.fn() };
  const inventoryLocation = { findFirst: vi.fn() };
  const sellerProduct = { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  const inventory = { updateMany: vi.fn(), upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() };
  const inventoryMovement = { create: vi.fn() };
  const auditLog = { create: vi.fn() };
  const database = {
    sellerListing,
    listingPrice,
    product,
    inventoryLocation,
    sellerProduct,
    inventory,
    inventoryMovement,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          sellerListing, listingPrice, product, inventoryLocation, sellerProduct,
          inventory, inventoryMovement, auditLog,
        }),
    ),
  };
  const sellers = {
    requireOperationalSellerByUser: vi.fn(),
  };
  const service = new ListingService(
    database as unknown as DatabaseService,
    sellers as unknown as SellerService,
  );

  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const productId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const listingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const priceId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const now = new Date('2026-10-01T06:00:00.000Z');

  const persisted = {
    id: listingId,
    sellerId,
    productId,
    sellerProductId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    sellerSku: 'SKU-001',
    condition: ProductCondition.NEW,
    sellerTitle: null,
    sellerDescription: null,
    warrantyInformation: null,
    deliveryInformation: null,
    commercialTerms: null,
    status: SellerListingStatus.DRAFT,
    reviewIntent: false,
    rejectionReason: null,
    version: 1,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
    price: {
      id: priceId,
      basePrice: 900,
      sellingPrice: 1000,
      promotionalPrice: null,
      currency: 'ETB',
      minOrderQuantity: 1,
      version: 1,
    },
    inventories: [],
    product: {
      schemaVersion: { snapshot: {
        offerRequirements: {
          price: ProductTypeRequirementLevel.REQUIRED,
          stock: ProductTypeRequirementLevel.REQUIRED,
          condition: ProductTypeRequirementLevel.REQUIRED,
          warranty: ProductTypeRequirementLevel.OPTIONAL,
        },
      } },
    },
  };

  const offerSnapshot = {
    offerRequirements: {
      price: ProductTypeRequirementLevel.REQUIRED,
      stock: ProductTypeRequirementLevel.REQUIRED,
      condition: ProductTypeRequirementLevel.REQUIRED,
      warranty: ProductTypeRequirementLevel.OPTIONAL,
    },
  };

  beforeEach(() => {
    // A prior test may enqueue findFirst/findUnique one-shot results. Clearing
    // call history alone retains them and corrupts the next approval scenario.
    vi.resetAllMocks();
    database.$transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          sellerListing, listingPrice, product, inventoryLocation, sellerProduct,
          inventory, inventoryMovement, auditLog,
        }),
    );
    sellers.requireOperationalSellerByUser.mockResolvedValue({
      id: sellerId,
      status: SellerStatus.ACTIVE,
    });
    product.findFirst.mockResolvedValue({
      id: productId,
      schemaVersion: { snapshot: offerSnapshot },
    });
    product.findUnique.mockResolvedValue({
      id: productId,
      name: 'Test brake disc',
      status: ProductStatus.ACTIVE,
      articleSource: ArticleSource.APPROVED_CATALOG_IMPORT,
      sourceSellerId: null,
      schemaVersion: { snapshot: offerSnapshot },
    });
    sellerListing.create.mockResolvedValue({ id: listingId });
    inventoryLocation.findFirst.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    sellerProduct.findFirst.mockResolvedValue(null);
    sellerProduct.findUnique.mockResolvedValue(null);
    sellerProduct.create.mockResolvedValue({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
    inventory.updateMany.mockResolvedValue({ count: 0 });
    inventory.upsert.mockResolvedValue({});
    inventory.findUniqueOrThrow.mockResolvedValue({ id: 'inventory-id' });
    inventory.update.mockResolvedValue({});
    inventoryMovement.create.mockResolvedValue({});
    listingPrice.create.mockResolvedValue({ id: priceId });
    sellerListing.findFirst.mockResolvedValue(persisted);
    sellerListing.findUnique.mockResolvedValue({
      product: {
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 1,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
      },
      assets: [{ type: 'IMAGE', isPrimary: true }],
    });
    auditLog.create.mockResolvedValue({});
  });

  it('creates a DRAFT Seller Listing against an ACTIVE Product Master', async () => {
    const result = await service.createForSellerUser(
      {
        productId,
        sellerSku: ' SKU-001 ',
        condition: ProductCondition.NEW,
        basePrice: 900,
        sellingPrice: 1000,
        currency: 'etb',
      },
      userId,
    );

    expect(product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId },
      }),
    );
    expect(sellerListing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId,
          productId,
          sellerSku: 'SKU-001',
          status: SellerListingStatus.DRAFT,
        }),
      }),
    );
    expect(listingPrice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellingPrice: 1000,
          currency: 'ETB',
        }),
      }),
    );
    expect(result.id).toBe(listingId);
  });

  it('allows a clean Draft Offer without fake price or condition when policy marks them not applicable', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      status: ProductStatus.ACTIVE,
      articleSource: ArticleSource.APPROVED_CATALOG_IMPORT,
      sourceSellerId: null,
      schemaVersion: {
        snapshot: {
          offerRequirements: {
            price: ProductTypeRequirementLevel.NOT_APPLICABLE,
            stock: ProductTypeRequirementLevel.NOT_APPLICABLE,
            condition: ProductTypeRequirementLevel.NOT_APPLICABLE,
            warranty: ProductTypeRequirementLevel.OPTIONAL,
          },
        },
      },
    });

    await expect(
      service.createForSellerUser(
        {
          productId,
          sellerSku: 'SKU-NONSTOCK-001',
        },
        userId,
      ),
    ).resolves.toMatchObject({ id: listingId });

    expect(sellerListing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          condition: null,
        }),
      }),
    );
    expect(listingPrice.create).not.toHaveBeenCalled();
  });

  it('lets a Seller prepare a Draft Offer against their own Draft Article submission', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      status: ProductStatus.DRAFT,
      articleSource: ArticleSource.SELLER_SUBMISSION,
      sourceSellerId: sellerId,
      schemaVersion: { snapshot: offerSnapshot },
    });

    await expect(
      service.createForSellerUser(
        {
          productId,
          sellerSku: 'SKU-DRAFT-001',
          condition: ProductCondition.NEW,
          basePrice: 900,
          sellingPrice: 1000,
          currency: 'ETB',
        },
        userId,
      ),
    ).resolves.toMatchObject({ id: listingId });

    expect(sellerListing.create).toHaveBeenCalled();
  });

  it('does not copy selected Store stock into the default Store during Listing First', async () => {
    const selectedLocationId = '22222222-2222-4222-8222-222222222222';
    inventoryLocation.findFirst
      .mockResolvedValueOnce({ id: '11111111-1111-4111-8111-111111111111' })
      .mockResolvedValueOnce({ id: selectedLocationId });
    await service.createForSellerUser({
      productId, sellerSku: 'STORE-001', selectedLocationId,
      openingQuantity: 5, basePrice: 0, sellingPrice: 500, currency: 'ETB',
    }, userId);
    expect(inventory.upsert).toHaveBeenCalledTimes(2);
    expect(inventory.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantityOnHand: 5 }),
    }));
    expect(inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        quantityDelta: 5,
        type: 'RECEIPT',
      }),
    }));
  });

  it('updates a draft Listing without resetting its state', async () => {
    sellerListing.findFirst
      .mockResolvedValueOnce({ ...persisted, status: SellerListingStatus.DRAFT })
      .mockResolvedValueOnce({ ...persisted, status: SellerListingStatus.DRAFT, version: 2 });
    sellerListing.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.updateForSellerUser(
      listingId, { version: 1, sellerDescription: 'Updated shipping offer' }, userId,
    );
    expect(result.status).toBe(SellerListingStatus.DRAFT);
    expect(sellerListing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SellerListingStatus.DRAFT }),
    }));
  });

  it('requires inventory before a Seller can submit a Listing', async () => {
    await expect(
      service.submitForSellerUser(listingId, { version: 1 }, userId),
    ).rejects.toMatchObject({
      response: { code: 'LISTING_INVENTORY_REQUIRED' },
    });
  });

  it('rechecks the Manufacturer Article inside Seller submission transaction', async () => {
    sellerListing.findFirst.mockResolvedValue({
      ...persisted,
      price: { ...persisted.price, sellingPrice: 1000 },
      inventories: [{ id: 'inventory-id' }],
    });
    product.findFirst.mockResolvedValue({
      id: productId,
      schemaVersion: { snapshot: offerSnapshot },
    });
    product.findUnique.mockResolvedValue({
      id: productId,
      status: ProductStatus.INACTIVE,
    });
    sellerListing.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.submitForSellerUser(listingId, { version: 1 }, userId),
    ).rejects.toMatchObject({
      response: { code: 'LISTING_PRODUCT_NOT_ACTIVE' },
    });

    expect(sellerListing.updateMany).not.toHaveBeenCalled();
  });

  it('enforces warranty from the immutable Product Type offer policy', async () => {
    sellerListing.findFirst.mockResolvedValue({
      ...persisted,
      condition: ProductCondition.NEW,
      warrantyInformation: null,
      inventories: [{ id: 'inventory-id' }],
    });
    product.findFirst.mockResolvedValue({
      id: productId,
      schemaVersion: {
        snapshot: {
          offerRequirements: {
            ...offerSnapshot.offerRequirements,
            warranty: ProductTypeRequirementLevel.REQUIRED,
          },
        },
      },
    });

    await expect(
      service.submitForSellerUser(listingId, { version: 1 }, userId),
    ).rejects.toMatchObject({
      response: { code: 'LISTING_WARRANTY_REQUIRED' },
    });
  });

  it('approves a submitted Listing as OUT_OF_STOCK when no sellable quantity exists', async () => {
    sellerListing.findUnique
      .mockResolvedValueOnce({
        id: listingId,
        version: 1,
        status: SellerListingStatus.SUBMITTED,
        productId,
        seller: {
          status: SellerStatus.ACTIVE,
          approvalStatus: SellerApprovalStatus.APPROVED,
          verificationStatus: SellerVerificationStatus.VERIFIED,
        },
        condition: ProductCondition.NEW,
        warrantyInformation: null,
        price: { sellingPrice: 1000 },
        inventories: [
          {
            quantityOnHand: 4, quantityReserved: 0, safetyStock: 4,
            location: { onlineFulfillmentEnabled: true, status: 'ACTIVE' },
          },
        ],
      })
      .mockResolvedValueOnce({
        product: {
          imageRequirement: ProductTypeRequirementLevel.REQUIRED,
          minimumImageCount: 1,
          documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
          minimumDocumentCount: 0,
        },
        assets: [{ type: 'IMAGE', isPrimary: true }],
      })
      .mockResolvedValueOnce({
        ...persisted,
        status: SellerListingStatus.OUT_OF_STOCK,
        version: 2,
      });
    sellerListing.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.approveAdmin(
      listingId,
      { version: 1 },
      userId,
    );

    expect(sellerListing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SellerListingStatus.OUT_OF_STOCK,
        }),
      }),
    );
    expect(result.status).toBe(SellerListingStatus.OUT_OF_STOCK);
  });
  it('finishes a complete Listing and submits automatically when the Article is ACTIVE', async () => {
    const withStock = { ...persisted, inventories: [{
      id: 'stock-row',
      quantityOnHand: 5, quantityReserved: 0, safetyStock: 0,
      location: { onlineFulfillmentEnabled: true, status: 'ACTIVE' },
    }] };
    sellerListing.findFirst
      .mockResolvedValueOnce(withStock)
      .mockResolvedValueOnce({ ...withStock, version: 2, reviewIntent: true })
      .mockResolvedValueOnce({ ...withStock, version: 2, reviewIntent: true })
      .mockResolvedValueOnce({ ...withStock, version: 2, reviewIntent: true })
      .mockResolvedValueOnce({ ...withStock, version: 3, status: SellerListingStatus.SUBMITTED, reviewIntent: true });
    const media = {
      product: {
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 1,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
      },
      assets: [{ type: 'IMAGE', isPrimary: true }],
    };
    sellerListing.findUnique.mockResolvedValue(media);
    sellerListing.updateMany.mockResolvedValue({ count: 1 });
    await service.finishCreationForSellerUser(listingId, userId);
    expect(sellerListing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reviewIntent: true }),
    }));
    expect(sellerListing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SellerListingStatus.SUBMITTED }),
    }));
  });

  it('remains a private Draft with review intent when the Article is awaiting Admin approval', async () => {
    const withStock = { ...persisted, inventories: [{
      id: 'stock-row',
      quantityOnHand: 5, quantityReserved: 0, safetyStock: 0,
      location: { onlineFulfillmentEnabled: true, status: 'ACTIVE' },
    }] };
    sellerListing.findFirst
      .mockResolvedValueOnce(withStock)
      .mockResolvedValueOnce({ ...withStock, reviewIntent: true, version: 2 });
    product.findUnique.mockResolvedValue({
      status: ProductStatus.DRAFT, articleSource: ArticleSource.SELLER_SUBMISSION,
      sourceSellerId: sellerId, schemaVersion: { snapshot: offerSnapshot },
    });
    sellerListing.findUnique.mockResolvedValue({
      product: {
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 1,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
      },
      assets: [{ type: 'IMAGE', isPrimary: true }],
    });
    sellerListing.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.finishCreationForSellerUser(listingId, userId);
    expect(result.status).toBe(SellerListingStatus.DRAFT);
    expect(result.reviewIntent).toBe(true);
    expect(sellerListing.updateMany).toHaveBeenCalledTimes(1);
  });

  it('will not set review intent until required Seller images are verified', async () => {
    sellerListing.findFirst.mockResolvedValue({
      ...persisted, inventories: [{ id: 'stock-row' }],
    });
    sellerListing.findUnique.mockResolvedValue({
      product: {
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 2,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
      },
      assets: [],
    });
    await expect(service.finishCreationForSellerUser(listingId, userId))
      .rejects.toMatchObject({ response: expect.objectContaining({
        code: 'SELLER_LISTING_MEDIA_REQUIRED',
      }) });
    expect(sellerListing.updateMany).not.toHaveBeenCalled();
  });

});
