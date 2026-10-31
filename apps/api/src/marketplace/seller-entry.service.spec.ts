import { createHash } from 'node:crypto';
import {
  ArticleSource, ProductStatus, ProductTypeRequirementLevel,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerArticleIdentityResolver } from './seller-article-identity-resolver.service.js';
import { ConflictException } from '@nestjs/common';
import { SellerEntryService } from './seller-entry.service.js';
import { SellerEntryKind, type SaveSellerEntryDto } from './dto/seller-entry.dto.js';
import type { SellerService } from './seller.service.js';
import type { SellerProductService } from './seller-product.service.js';
import type { ListingService } from './listing.service.js';

const sellerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const articleId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const productTypeId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const locationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const vehicleId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function setup(fitment: ProductTypeRequirementLevel = ProductTypeRequirementLevel.NOT_APPLICABLE) {
  const productRecord = {
    id: articleId, status: ProductStatus.ACTIVE,
    articleSource: ArticleSource.SELLER_SUBMISSION,
    sourceSellerId: sellerId, catalogReviewSubmittedAt: null,
    schemaVersion: { snapshot: { articleRequirements: { fitment } } },
  };
  const tx = {
    sellerProduct: { findUnique: vi.fn().mockResolvedValue(null), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'stock-record', sku: 'SKU-TEST' }), findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    product: {
      findUnique: vi.fn().mockResolvedValue(productRecord),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        ...productRecord, productTypeId, brandId: null,
      }),
    },
    productType: { findFirst: vi.fn().mockResolvedValue({
      id: productTypeId, name: 'Brake Pads',
      currentSchemaVersion: { schemaVersion: 3 },
    }) },
    brand: { findUnique: vi.fn().mockResolvedValue({ name: 'Parts Brand' }) },
    partNumber: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'part-id' }) },
    articleIdentifier: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'identifier-id' }) },
    vehicleCompatibility: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'compatibility-id' }),
    },
    vehicleConfiguration: { findMany: vi.fn().mockResolvedValue([{
      id: vehicleId, makeId: 'make', modelId: 'model',
      generationId: null, trimId: null, engineId: null,
      transmissionId: null, bodyTypeId: null, marketId: null,
      steeringSide: null, transmission: null,
    }]) },
    productVehicleArticle: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => operation(tx)),
  };
  const sellers = { requireOperationalSellerByUser: vi.fn().mockResolvedValue({ id: sellerId }) };
  const identities = {
    resolve: vi.fn().mockResolvedValue({ articleId, created: true }),
  };
  const stock = {
    create: vi.fn().mockResolvedValue('stock-record'),
    get: vi.fn().mockResolvedValue({ id: 'stock-record', sku: 'SKU-TEST' }),
  };
  const listings = {
    createForSellerUser: vi.fn().mockResolvedValue('listing-record'),
    getForSellerUser: vi.fn().mockResolvedValue({ id: 'listing-record', status: 'DRAFT' }),
  };
  const service = new SellerEntryService(
    database as unknown as DatabaseService,
    sellers as unknown as SellerService,
    identities as unknown as SellerArticleIdentityResolver,
    stock as unknown as SellerProductService,
    listings as unknown as ListingService,
  );
  const inventoryInput: SaveSellerEntryDto = {
    kind: SellerEntryKind.INVENTORY, articleId,
    locationId, sku: 'SKU-TEST', openingQuantity: 4, packageQuantity: 1,
  };
  return { service, tx, database, stock, identities, listings, inventoryInput };
}

describe('Seller unified Article + Inventory/Listing Save', () => {
  it('uses the existing Article and creates stock in the same transaction', async () => {
    const { service, tx, database, stock, identities, inventoryInput } = setup();
    const result = await service.save(inventoryInput, userId);
    expect(result).toMatchObject({
      kind: SellerEntryKind.INVENTORY, articleId, articleCreated: false,
      recordId: 'stock-record', replayed: false,
    });
    expect(stock.create).toHaveBeenCalledWith(expect.objectContaining({
      productId: articleId, locationId, openingQuantity: 4,
    }), userId, tx);
    expect(identities.resolve).not.toHaveBeenCalled();
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'SELLER_ENTRY_COMMITTED' }),
    }));
  });

  it('creates a Draft Article and configured-vehicle fitment before creating Inventory', async () => {
    const { service, tx, identities, stock, inventoryInput } = setup(ProductTypeRequirementLevel.REQUIRED);
    tx.product.findUnique.mockResolvedValue({
      id: articleId, status: ProductStatus.DRAFT,
      articleSource: ArticleSource.SELLER_SUBMISSION,
      sourceSellerId: sellerId, catalogReviewSubmittedAt: null,
      schemaVersion: { snapshot: { articleRequirements: {
        fitment: ProductTypeRequirementLevel.REQUIRED,
      } } },
    });
    const result = await service.save({
      ...inventoryInput,
      articleId: undefined,
      article: { productTypeId, values: { MATERIAL: 'CERAMIC' } },
      vehicleConfigurationIds: [vehicleId],
    }, userId);
    expect(result).toMatchObject({ articleCreated: true });
    expect(identities.resolve).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        article: expect.objectContaining({ productTypeId, values: { MATERIAL: 'CERAMIC' } }),
        vehicleConfigurationIds: [vehicleId],
      }),
      sellerId,
      userId,
    );
    expect(stock.create).toHaveBeenCalledTimes(1);
  });

  it('rejects missing required fitment and never creates stock', async () => {
    const { service, tx, stock, inventoryInput } = setup(ProductTypeRequirementLevel.REQUIRED);
    await expect(service.save(inventoryInput, userId))
      .rejects.toThrow('configured-vehicle fitment evidence');
    expect(stock.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('creates a Draft Listing directly from an existing Article with no separate Inventory save', async () => {
    const { service, tx, stock, listings, inventoryInput } = setup();
    const result = await service.save({
      ...inventoryInput, kind: SellerEntryKind.LISTING, sellingPrice: 950,
      sellerTitle: 'Bosch Brake Pads',
    }, userId);
    expect(result).toMatchObject({ recordId: 'listing-record', articleCreated: false });
    expect(listings.createForSellerUser).toHaveBeenCalledWith(expect.objectContaining({
      productId: articleId, selectedLocationId: locationId, sellingPrice: 950,
      sellerTitle: 'Bosch Brake Pads',
    }), userId, tx);
    expect(stock.create).not.toHaveBeenCalled();
  });

  it('replays the identical Save without creating a second Inventory record', async () => {
    const { service, tx, stock, inventoryInput } = setup();
    await service.save(inventoryInput, userId);
    const hash = createHash('sha256')
      .update(JSON.stringify({ ...inventoryInput, sku: 'SKU-TEST' }))
      .digest('hex');
    tx.sellerProduct.findUnique.mockResolvedValue({
      id: 'stock-record', productId: articleId, listing: null,
    });
    tx.auditLog.findFirst.mockResolvedValue({ metadata: { requestHash: hash } });
    const result = await service.save(inventoryInput, userId);
    expect(result).toMatchObject({ recordId: 'stock-record', replayed: true });
    expect(stock.create).toHaveBeenCalledTimes(1);
  });

  it('lists an existing Inventory SKU and safely replays an identical Save', async () => {
    const { service, tx, listings, inventoryInput } = setup();
    const input: SaveSellerEntryDto = {
      ...inventoryInput,
      kind: SellerEntryKind.LISTING,
      sellerProductId: 'stock-record',
      sellingPrice: 950,
    };
    tx.sellerProduct.findUnique.mockResolvedValue({
      id: 'stock-record', productId: articleId, listing: null,
    });
    tx.sellerProduct.findFirst.mockResolvedValue({
      productId: articleId, sku: 'SKU-TEST',
    });

    const first = await service.save(input, userId);
    expect(first).toMatchObject({ recordId: 'listing-record', replayed: false });
    expect(listings.createForSellerUser).toHaveBeenCalledWith(
      expect.objectContaining({ sellerProductId: 'stock-record', sellerSku: 'SKU-TEST' }),
      userId,
      tx,
    );

    const requestHash = createHash('sha256')
      .update(JSON.stringify({ ...input, sku: 'SKU-TEST' }))
      .digest('hex');
    tx.sellerProduct.findUnique.mockResolvedValue({
      id: 'stock-record', productId: articleId,
      listing: { id: 'listing-record' },
    });
    tx.auditLog.findFirst.mockResolvedValue({ metadata: { requestHash } });

    const replay = await service.save(input, userId);
    expect(replay).toMatchObject({ recordId: 'listing-record', replayed: true });
    expect(listings.createForSellerUser).toHaveBeenCalledTimes(1);
  });

  it('rejects a different Listing request for an already listed Inventory SKU', async () => {
    const { service, tx, listings, inventoryInput } = setup();
    tx.sellerProduct.findUnique.mockResolvedValue({
      id: 'stock-record', productId: articleId,
      listing: { id: 'listing-record' },
    });
    tx.auditLog.findFirst.mockResolvedValue({
      metadata: { requestHash: 'an-earlier-request-hash' },
    });

    await expect(service.save({
      ...inventoryInput,
      kind: SellerEntryKind.LISTING,
      sellerProductId: 'stock-record',
      sellingPrice: 1200,
    }, userId)).rejects.toThrow('SKU already exists for another request');
    expect(listings.createForSellerUser).not.toHaveBeenCalled();
  });

  it('does not accept a SKU that belongs to another selected Inventory record', async () => {
    const { service, tx, listings, inventoryInput } = setup();
    tx.sellerProduct.findUnique.mockResolvedValue({
      id: 'different-stock-record', productId: articleId, listing: null,
    });

    await expect(service.save({
      ...inventoryInput,
      kind: SellerEntryKind.LISTING,
      sellerProductId: 'stock-record',
      sellingPrice: 950,
    }, userId)).rejects.toThrow('selected Inventory SKU does not match');
    expect(listings.createForSellerUser).not.toHaveBeenCalled();
  });

  it('preserves identity resolver conflicts and never creates stock', async () => {
    const { service, identities, stock, inventoryInput } = setup();
    identities.resolve.mockRejectedValue(new ConflictException(
      'A different Product Type or Brand cannot reuse this identity.',
    ));
    await expect(service.save({
      ...inventoryInput, articleId: undefined,
      article: {
        productTypeId, brandId: 'brand', manufacturerPartNumber: 'BR-123',
        values: {},
      },
    }, userId)).rejects.toThrow('different Product Type or Brand');
    expect(stock.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed request with two Article sources', async () => {
    const { service, tx, inventoryInput } = setup();
    await expect(service.save({
      ...inventoryInput, article: { productTypeId, values: {} },
    }, userId)).rejects.toThrow('Choose one existing Article');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
