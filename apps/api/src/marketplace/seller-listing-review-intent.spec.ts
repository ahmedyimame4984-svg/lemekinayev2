import { describe, expect, it, vi } from 'vitest';
import {
  MasterDataStatus, ProductAssetType, ProductStatus, ProductTypeRequirementLevel,
  SellerApprovalStatus, SellerListingStatus, SellerStatus, SellerVerificationStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { submitWaitingListingsAfterArticleApproval } from './seller-listing-review-intent.js';

const id = '11111111-1111-4111-8111-111111111111';
const articleId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
function fixture(input: { active?: boolean; hasImage?: boolean; sellerApproved?: boolean } = {}) {
  const listing = {
    id, version: 2, condition: 'NEW', warrantyInformation: null,
    price: { sellingPrice: 900 },
    inventories: [{ id: 'stock-row' }],
    seller: {
      status: SellerStatus.ACTIVE,
      approvalStatus: input.sellerApproved === false
        ? SellerApprovalStatus.PENDING : SellerApprovalStatus.APPROVED,
      verificationStatus: SellerVerificationStatus.VERIFIED,
    },
    product: {
      status: input.active === false ? ProductStatus.DRAFT : ProductStatus.ACTIVE,
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
  const tx = {
    sellerListing: {
      findUnique: vi.fn().mockResolvedValue({
        product: {
          imageRequirement: ProductTypeRequirementLevel.REQUIRED,
          minimumImageCount: 1,
          documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
          minimumDocumentCount: 0,
        },
        assets: input.hasImage === false ? [] : [{
          type: ProductAssetType.IMAGE, isPrimary: true, status: MasterDataStatus.ACTIVE,
        }],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    product: { findUnique: vi.fn().mockResolvedValue({ status: ProductStatus.ACTIVE }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-id' }) },
  };
  const db = {
    sellerListing: { findMany: vi.fn().mockResolvedValue([listing]) },
    $transaction: vi.fn(async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { db, tx };
}
describe('Automatic Listing review after Article approval', () => {
  it('submits only explicit waiting Drafts with valid Article, offer, media and Seller', async () => {
    const { db, tx } = fixture();
    expect(await submitWaitingListingsAfterArticleApproval(
      db as unknown as DatabaseService, articleId, actorId,
    )).toEqual({ submitted: 1, blocked: 0 });
    expect(db.sellerListing.findMany).toHaveBeenCalledWith({
      where: {
        productId: articleId, status: SellerListingStatus.DRAFT, reviewIntent: true,
      },
      select: expect.any(Object),
    });
    expect(tx.sellerListing.updateMany).toHaveBeenCalledWith({
      where: {
        id, version: 2, status: SellerListingStatus.DRAFT, reviewIntent: true,
      },
      data: {
        status: SellerListingStatus.SUBMITTED, version: { increment: 1 },
        updatedById: actorId,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'SELLER_LISTING_AUTO_SUBMITTED_AFTER_ARTICLE_APPROVAL',
    }) });
  });
  it('never submits a Listing without required images', async () => {
    const { db, tx } = fixture({ hasImage: false });
    expect(await submitWaitingListingsAfterArticleApproval(
      db as unknown as DatabaseService, articleId, actorId,
    )).toEqual({ submitted: 0, blocked: 1 });
    expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
  });
  it('never submits when the Seller is unapproved or Article inactive', async () => {
    for (const options of [{ sellerApproved: false }, { active: false }]) {
      const { db, tx } = fixture(options);
      expect(await submitWaitingListingsAfterArticleApproval(
        db as unknown as DatabaseService, articleId, actorId,
      )).toEqual({ submitted: 0, blocked: 1 });
      expect(tx.sellerListing.updateMany).not.toHaveBeenCalled();
    }
  });
});
