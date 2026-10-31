import { Logger } from '@nestjs/common';
import {
  Prisma, ProductStatus, ProductTypeRequirementLevel,
  SellerApprovalStatus, SellerListingStatus, SellerStatus, SellerVerificationStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { assertSellerListingMediaReady } from './seller-listing-media-readiness.js';

const logger = new Logger('SellerListingReviewIntent');

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function required(value: unknown, defaultRequired: boolean): boolean {
  return value === ProductTypeRequirementLevel.REQUIRED ||
    (value !== ProductTypeRequirementLevel.OPTIONAL &&
      value !== ProductTypeRequirementLevel.NOT_APPLICABLE && defaultRequired);
}

/**
 * Triggered only after a Seller Article has been activated by Admin.
 * Existing Draft Listings without explicit reviewIntent remain untouched.
 * Failed eligibility checks leave a recoverable private Draft, never an
 * automatically published or falsely submitted Listing.
 */
export async function submitWaitingListingsAfterArticleApproval(
  database: DatabaseService, articleId: string, adminId: string,
): Promise<{ submitted: number; blocked: number }> {
  const waiting = await database.sellerListing.findMany({
    where: {
      productId: articleId,
      status: SellerListingStatus.DRAFT,
      reviewIntent: true,
    },
    select: {
      id: true, version: true, condition: true, warrantyInformation: true,
      price: { select: { sellingPrice: true } },
      inventories: { select: { id: true } },
      seller: { select: { status: true, approvalStatus: true, verificationStatus: true } },
      product: { select: { status: true, schemaVersion: { select: { snapshot: true } } } },
    },
  });
  let submitted = 0;
  let blocked = 0;
  for (const listing of waiting) {
    try {
      if (listing.product.status !== ProductStatus.ACTIVE ||
          listing.seller.status !== SellerStatus.ACTIVE ||
          listing.seller.approvalStatus !== SellerApprovalStatus.APPROVED ||
          listing.seller.verificationStatus !== SellerVerificationStatus.VERIFIED) {
        blocked++;
        continue;
      }
      const snapshot = asObject(listing.product.schemaVersion.snapshot);
      const legacy = asObject(snapshot?.requirements);
      const policy = asObject(snapshot?.offerRequirements) ?? asObject(legacy?.listing) ?? {};
      const levels = [policy.price, policy.stock, policy.condition, policy.warranty];
      const values = [
        Boolean(listing.price && Number(listing.price.sellingPrice) > 0),
        listing.inventories.length > 0,
        listing.condition !== null,
        Boolean(listing.warrantyInformation?.trim()),
      ];
      const defaultRequired = [true, true, true, false];
      if (levels.some((level, i) =>
        (required(level, defaultRequired[i]!) && !values[i]) ||
        (level === ProductTypeRequirementLevel.NOT_APPLICABLE && values[i])
      )) {
        blocked++;
        continue;
      }
      await database.$transaction(async tx => {
        // Review readiness and state transition share a serializable transaction.
        // If an asset or Listing changes concurrently this transaction must retry.
        await assertSellerListingMediaReady(tx, listing.id);
        const article = await tx.product.findUnique({
          where: { id: articleId }, select: { status: true },
        });
        if (article?.status !== ProductStatus.ACTIVE) {
          throw new Error('Article is no longer Active.');
        }
        const changed = await tx.sellerListing.updateMany({
          where: {
            id: listing.id, version: listing.version, reviewIntent: true,
            status: SellerListingStatus.DRAFT,
          },
          data: {
            status: SellerListingStatus.SUBMITTED,
            version: { increment: 1 },
            updatedById: adminId,
          },
        });
        if (changed.count !== 1) throw new Error('Listing changed before automated review.');
        await tx.auditLog.create({ data: {
          actorId: adminId, action: 'SELLER_LISTING_AUTO_SUBMITTED_AFTER_ARTICLE_APPROVAL',
          entityType: 'SellerListing', entityId: listing.id,
          metadata: { productId: articleId },
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      submitted++;
    } catch (error) {
      blocked++;
      logger.warn(`Listing ${listing.id} could not auto-submit after Article approval: ${error instanceof Error ? error.message : 'validation failed'}`);
    }
  }
  return { submitted, blocked };
}
