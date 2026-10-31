import { describe, expect, it, vi } from 'vitest';
import {
  ProductStatus, ProductTypeRequirementLevel, SellerApprovalStatus, SellerListingStatus,
  SellerStatus, SellerVerificationStatus, type Prisma,
} from '@prisma/client';
import { submitListingsWaitingForArticle } from './seller-listing-article-activation.js';

const articleId = '11111111-1111-4111-8111-111111111111';
const listingId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const listing = {
  id: listingId, version: 2,
  condition: 'NEW', warrantyInformation: null,
  price: { sellingPrice: 500 },
  inventories: [{ id: 'inventory' }],
  seller: {
    status: SellerStatus.ACTIVE,
    approvalStatus: SellerApprovalStatus.APPROVED,
    verificationStatus: SellerVerificationStatus.VERIFIED,
  },
};
const activeArticle = {
  status: ProductStatus.ACTIVE,
  priceRequirement: ProductTypeRequirementLevel.REQUIRED,
  stockRequirement: ProductTypeRequirementLevel.REQUIRED,
  conditionRequirement: ProductTypeRequirementLevel.REQUIRED,
  warrantyRequirement: ProductTypeRequirementLevel.OPTIONAL,
};
function setup() {
  const mock = {
    product: { findUnique: vi.fn().mockResolvedValue(activeArticle) },
    sellerListing: {
      findMany: vi.fn().mockResolvedValue([listing]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        product: {
          imageRequirement: ProductTypeRequirementLevel.REQUIRED,
          minimumImageCount: 1, maximumImageCount: 2,
          documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
          minimumDocumentCount: 0,
        },
        assets: [{ type: 'IMAGE', isPrimary: true }],
      }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return { mock, tx: mock as unknown as Prisma.TransactionClient };
}
describe('Article activation → Seller Listing review handoff', () => {
  it('submits only completed Listings for separate Admin approval', async () => {
    const { tx, mock } = setup();
    await expect(submitListingsWaitingForArticle(tx, articleId, actorId)).resolves.toBe(1);
    expect(mock.sellerListing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ reviewIntent: true }),
      data: expect.objectContaining({ status: SellerListingStatus.SUBMITTED }),
    }));
    expect(mock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'SELLER_LISTING_SUBMITTED_AFTER_ARTICLE_ACTIVATION' }),
    }));
  });

  it('never submits a Listing without its Product Article being Active', async () => {
    const { tx, mock } = setup();
    mock.product.findUnique.mockResolvedValue({ ...activeArticle, status: ProductStatus.DRAFT });
    expect(await submitListingsWaitingForArticle(tx, articleId, actorId)).toBe(0);
    expect(mock.sellerListing.findMany).not.toHaveBeenCalled();
  });

  it('leaves missing-image Listings in Draft without bypassing Admin review', async () => {
    const { tx, mock } = setup();
    mock.sellerListing.findUnique.mockResolvedValue({
      product: {
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 2, maximumImageCount: 4,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
      },
      assets: [{ type: 'IMAGE', isPrimary: true }],
    });
    expect(await submitListingsWaitingForArticle(tx, articleId, actorId)).toBe(0);
    expect(mock.sellerListing.updateMany).not.toHaveBeenCalled();
  });

  it('does not submit a Seller that has lost verification', async () => {
    const { tx, mock } = setup();
    mock.sellerListing.findMany.mockResolvedValue([{
      ...listing,
      seller: { ...listing.seller, verificationStatus: SellerVerificationStatus.REJECTED },
    }]);
    expect(await submitListingsWaitingForArticle(tx, articleId, actorId)).toBe(0);
  });

  it('rejects concurrent changes instead of approving a stale Listing version', async () => {
    const { tx, mock } = setup();
    mock.sellerListing.updateMany.mockResolvedValue({ count: 0 });
    await expect(submitListingsWaitingForArticle(tx, articleId, actorId)).rejects.toThrow('changed');
    expect(mock.auditLog.create).not.toHaveBeenCalled();
  });
});
