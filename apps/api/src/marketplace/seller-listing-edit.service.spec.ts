import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductAssetType } from '@prisma/client';
import {
  ProductStatus, ProductTypeRequirementLevel, SellerListingRevisionStatus, SellerListingStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerService } from './seller.service.js';
import type { SellerArticleIdentityResolver } from './seller-article-identity-resolver.service.js';
import type { SellerArticleService } from './seller-article.service.js';
import type { SellerR2StorageService } from './seller-r2-storage.service.js';
import { SellerListingEditService } from './seller-listing-edit.service.js';

const listingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const articleId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const replacementId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const revisionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

describe('Seller Listing unified Save', () => {
  const listing = {
    id: listingId, sellerId, version: 2, status: SellerListingStatus.DRAFT,
    productId: articleId, sellerProductId: 'stock-1',
    sellerTitle: 'Brake Pads', sellerDescription: 'Original',
    warrantyInformation: null, deliveryInformation: null,
    price: { id: 'price-1', version: 3, sellingPrice: 800 },
  };
  const tx = {
    sellerListing: {
      findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(),
    },
    sellerProduct: { updateMany: vi.fn() },
    sellerListingRevision: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    sellerListingAsset: { findMany: vi.fn(), updateMany: vi.fn() },
    listingPrice: { updateMany: vi.fn(), create: vi.fn() },
    product: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const database = {
    $transaction: vi.fn(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx)),
    sellerListing: { findFirst: vi.fn() },
    sellerListingRevision: { findFirst: vi.fn(), findMany: vi.fn() },
  };
  const sellers = { requireOperationalSellerByUser: vi.fn() };
  const identities = { resolve: vi.fn() };
  const articles = { submitForReview: vi.fn() };
  const storage = { remove: vi.fn().mockResolvedValue(undefined) };
  const service = new SellerListingEditService(
    database as unknown as DatabaseService,
    sellers as unknown as SellerService,
    identities as unknown as SellerArticleIdentityResolver,
    articles as unknown as SellerArticleService,
    storage as unknown as SellerR2StorageService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    database.$transaction.mockImplementation(async work => work(tx));
    sellers.requireOperationalSellerByUser.mockResolvedValue({ id: sellerId });
    tx.sellerListing.findFirst.mockResolvedValue(listing);
    tx.sellerListing.updateMany.mockResolvedValue({ count: 1 });
    tx.sellerProduct.updateMany.mockResolvedValue({ count: 1 });
    tx.listingPrice.updateMany.mockResolvedValue({ count: 1 });
    tx.product.findUniqueOrThrow.mockResolvedValue({ priceRequirement: ProductTypeRequirementLevel.REQUIRED });
    tx.product.findUnique.mockResolvedValue({ status: ProductStatus.ACTIVE });
    tx.sellerListingRevision.findFirst.mockResolvedValue(null);
    tx.sellerListingRevision.create.mockResolvedValue({ id: revisionId });
    tx.sellerListingRevision.updateMany.mockResolvedValue({ count: 1 });
    tx.sellerListingAsset.findMany.mockResolvedValue([]);
    tx.sellerListingAsset.updateMany.mockResolvedValue({ count: 1 });
    storage.remove.mockResolvedValue(undefined);
    tx.auditLog.create.mockResolvedValue({});
    identities.resolve.mockResolvedValue({ articleId: replacementId, created: false });
    articles.submitForReview.mockResolvedValue({ articleId: replacementId });
  });

  it('returns a JSON-safe envelope when no Listing revision is pending', async () => {
    database.sellerListing.findFirst.mockResolvedValue({ id: listingId });
    database.sellerListingRevision.findFirst.mockResolvedValue(null);

    await expect(service.getPending(listingId, userId)).resolves.toEqual({ revision: null });
    expect(database.sellerListingRevision.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { listingId, status: SellerListingRevisionStatus.PENDING },
    }));
  });

  it('returns pending revision details in the same response shape', async () => {
    const revision = { id: revisionId, sourceVersion: 3, status: SellerListingRevisionStatus.PENDING };
    database.sellerListing.findFirst.mockResolvedValue({ id: listingId });
    database.sellerListingRevision.findFirst.mockResolvedValue(revision);

    await expect(service.getPending(listingId, userId)).resolves.toEqual({ revision });
  });

  it('does not disclose pending revisions for another Seller Listing', async () => {
    database.sellerListing.findFirst.mockResolvedValue(null);

    await expect(service.getPending(listingId, userId)).rejects.toThrow('Listing not found.');
    expect(database.sellerListingRevision.findFirst).not.toHaveBeenCalled();
  });

  it('updates Draft selling details and price in one transaction', async () => {
    const result = await service.save(listingId, {
      version: 2, sellerTitle: 'Updated Brake Pads', sellingPrice: 900, priceVersion: 3,
    }, userId);
    expect(result).toMatchObject({ status: 'APPLIED', version: 3 });
    expect(tx.listingPrice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'price-1', version: 3 },
      data: expect.objectContaining({ sellingPrice: 900 }),
    }));
    expect(tx.sellerListing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sellerTitle: 'Updated Brake Pads' }),
    }));
    expect(tx.sellerListingRevision.create).not.toHaveBeenCalled();
  });

  it('preserves the live Listing and stages reviewed content while applying a price change', async () => {
    tx.sellerListing.findFirst.mockResolvedValue({ ...listing, status: SellerListingStatus.ACTIVE });
    const result = await service.save(listingId, {
      version: 2, sellerDescription: 'Aftermarket pads', sellingPrice: 920, priceVersion: 3,
    }, userId);
    expect(result.status).toBe('PENDING_REVIEW');
    expect(tx.sellerListingRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        proposedProductId: null,
        status: SellerListingRevisionStatus.PENDING,
        changes: { sellerDescription: 'Aftermarket pads' },
      }),
    }));
    const [update] = tx.sellerListing.updateMany.mock.calls[0];
    expect(update.data).not.toHaveProperty('sellerDescription');
    expect(update.data).not.toHaveProperty('status');
    expect(tx.listingPrice.updateMany).toHaveBeenCalledTimes(1);
  });

  it('saves a complete verified media set as an Admin-only revision without changing published assets', async () => {
    const stagedId = '11111111-1111-4111-8111-111111111111';
    tx.sellerListing.findFirst.mockResolvedValue({ ...listing, status: SellerListingStatus.ACTIVE });
    tx.product.findUnique.mockResolvedValue({
      status: ProductStatus.ACTIVE,
      imageRequirement: ProductTypeRequirementLevel.REQUIRED,
      minimumImageCount: 1, maximumImageCount: 2,
      documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
      minimumDocumentCount: 0,
    });
    tx.sellerListingAsset.findMany.mockResolvedValue([{
      id: stagedId, type: ProductAssetType.IMAGE, isPublished: false,
      stagedForRevisionId: null,
    }]);
    const result = await service.save(listingId, {
      version: 2, mediaAssetIds: [stagedId], primaryMediaId: stagedId,
    }, userId);
    expect(result.status).toBe('PENDING_REVIEW');
    expect(tx.sellerListingRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        proposedMedia: { assetIds: [stagedId], primaryId: stagedId },
      }),
    }));
    expect(tx.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { stagedForRevisionId: revisionId },
    }));
    const [update] = tx.sellerListing.updateMany.mock.calls[0];
    expect(update.data).not.toHaveProperty('productId');
    expect(update.data).not.toHaveProperty('status');
  });

  it('archives rejected staged images without affecting the currently published set', async () => {
    tx.sellerListingRevision.findFirst.mockResolvedValue({
      id: revisionId, listingId, proposedProductId: null,
      proposedMedia: { assetIds: [], primaryId: null },
      status: SellerListingRevisionStatus.PENDING, changes: {},
    });
    tx.sellerListing.findUnique.mockResolvedValue({
      sellerId, sellerProductId: 'stock-1', productId: articleId,
      status: SellerListingStatus.ACTIVE, version: 3,
    });
    tx.sellerListingAsset.findMany.mockResolvedValue([{ storageKey: 'seller-listings/safe-key.webp' }]);
    await expect(service.review(listingId, revisionId, userId, 'REJECT', 'Wrong image'))
      .resolves.toMatchObject({ status: 'REJECTED' });
    expect(tx.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stagedForRevisionId: revisionId, isPublished: false }),
      data: expect.objectContaining({ status: 'ARCHIVED' }),
    }));
    expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it('does not submit a revision for unchanged content', async () => {
    tx.sellerListing.findFirst.mockResolvedValue({ ...listing, status: SellerListingStatus.ACTIVE });
    const result = await service.save(listingId, {
      version: 2, sellerTitle: listing.sellerTitle, sellerDescription: listing.sellerDescription,
    }, userId);
    expect(result.status).toBe('UNCHANGED');
    expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
    expect(tx.sellerListingRevision.create).not.toHaveBeenCalled();
  });

  it('rejects stale versions without writing', async () => {
    await expect(service.save(listingId, { version: 1, sellerTitle: 'Stale' }, userId))
      .rejects.toThrow('Listing changed');
    expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
  });

  it('rejects access to another Seller Listing', async () => {
    tx.sellerListing.findFirst.mockResolvedValue(null);
    await expect(service.save(listingId, { version: 2 }, userId)).rejects.toThrow('Listing not found');
    expect(tx.sellerListingRevision.create).not.toHaveBeenCalled();
  });

  it('updates only this Seller Inventory reference when switching Draft products', async () => {
    const result = await service.save(listingId, {
      version: 2, articleId: replacementId,
    }, userId);
    expect(result.articleId).toBe(replacementId);
    expect(tx.sellerProduct.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'stock-1', sellerId, productId: articleId },
      data: expect.objectContaining({ productId: replacementId }),
    }));
  });

  it('blocks a second pending revision', async () => {
    tx.sellerListing.findFirst.mockResolvedValue({ ...listing, status: SellerListingStatus.ACTIVE });
    tx.sellerListingRevision.findFirst.mockResolvedValue({ id: revisionId });
    await expect(service.save(listingId, { version: 2, sellerDescription: 'Another change' }, userId))
      .rejects.toThrow('awaiting Admin review');
    expect(tx.sellerListingRevision.create).not.toHaveBeenCalled();
  });

  it('rejects a reviewed Article switch until catalog approval', async () => {
    tx.sellerListingRevision.findFirst.mockResolvedValue({
      id: revisionId, listingId, proposedProductId: replacementId,
      status: SellerListingRevisionStatus.PENDING, changes: {},
    });
    tx.sellerListing.findUnique.mockResolvedValue({
      sellerId, sellerProductId: 'stock-1', productId: articleId,
      status: SellerListingStatus.ACTIVE, version: 3,
    });
    tx.product.findUnique.mockResolvedValue({ status: ProductStatus.DRAFT });
    await expect(service.review(listingId, revisionId, userId, 'APPROVE'))
      .rejects.toThrow('complete catalog approval');
    expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a review request without changing published Listing', async () => {
    tx.sellerListingRevision.findFirst.mockResolvedValue({
      id: revisionId, listingId, proposedProductId: null,
      status: SellerListingRevisionStatus.PENDING, changes: { sellerDescription: 'New' },
    });
    tx.sellerListing.findUnique.mockResolvedValue({
      sellerId, sellerProductId: 'stock-1', productId: articleId,
      status: SellerListingStatus.ACTIVE, version: 3,
    });
    const result = await service.review(listingId, revisionId, userId, 'REJECT', 'Wrong product specifications');
    expect(result.status).toBe('REJECTED');
    expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
    expect(tx.sellerListingRevision.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SellerListingRevisionStatus.REJECTED }),
    }));
  });
});
