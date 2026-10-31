import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { ListingService } from './listing.service.js';
import { AdminListingReviewService } from './admin-listing-review.service.js';

const listingId = '11111111-1111-4111-8111-111111111111';
const sellerId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const proposedId = '44444444-4444-4444-8444-444444444444';

function createReview(revision: unknown = null) {
  const listing = { id: listingId, sellerId, productId, sellerSku: 'BRK-001', status: 'SUBMITTED' };
  const records = {
    seller: { findUnique: vi.fn().mockResolvedValue({ id: sellerId, displayName: 'Supplier' }) },
    product: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id, attributeValues: [], compatibilities: [] })),
    },
    sellerListingRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
    sellerListing: { findUnique: vi.fn().mockResolvedValue({
      inventories: [{ id: 'allocation', quantityOnHand: 5, location: { name: 'Main shop' } }],
      assets: [{ type: 'IMAGE', isPrimary: true }],
    }) }, 
  };
  const listings = { getAdmin: vi.fn().mockResolvedValue(listing) };
  const review = new AdminListingReviewService(
    records as unknown as DatabaseService,
    listings as unknown as ListingService,
  );
  return { records, listings, review };
}

describe('Admin full Listing review', () => {
  it('loads the seller and complete current Product Article without a pending revision', async () => {
    const { review, records } = createReview();
    const result = await review.get(listingId);
    expect(result).toMatchObject({
      listing: { sellerSku: 'BRK-001' },
      seller: { displayName: 'Supplier' },
      article: { id: productId },
      pendingRevision: null,
      proposedArticle: null,
      mediaSummary: { verifiedImageCount: 1, verifiedDocumentCount: 0, hasPrimaryImage: true },
    });
    expect(result.inventoryLocations).toHaveLength(1);
    expect(records.product.findUnique).toHaveBeenCalledTimes(1);
  });

  it('includes pending changes and a separate proposed Article without mutating published data', async () => {
    const revision = {
      id: 'revision-1', proposedProductId: proposedId,
      changes: { sellerTitle: 'Updated title' },
      status: 'PENDING',
    };
    const { review, records } = createReview(revision);
    const result = await review.get(listingId);
    expect(result.pendingRevision?.changes).toEqual({ sellerTitle: 'Updated title' });
    expect(result.article?.id).toBe(productId);
    expect(result.proposedArticle?.id).toBe(proposedId);
    expect(records.product.findUnique).toHaveBeenCalledTimes(2);
  });

  it('preserves the existing NotFound behavior for an unknown Listing', async () => {
    const { review, listings, records } = createReview();
    listings.getAdmin.mockRejectedValueOnce(new Error('Listing not found'));
    await expect(review.get(listingId)).rejects.toThrow('Listing not found');
    expect(records.seller.findUnique).not.toHaveBeenCalled();
    expect(records.product.findUnique).not.toHaveBeenCalled();
    expect(records.sellerListing.findUnique).not.toHaveBeenCalled();
  });
});
