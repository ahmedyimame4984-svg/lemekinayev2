import {
  ProductStatus, ProductTypeRequirementLevel, Prisma,
  SellerListingStatus, SellerStatus, SellerApprovalStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertSellerListingMediaReady } from './seller-listing-media-readiness.js';

/**
 * Called inside the Product activation transaction, after Article evidence is
 * activated. A Seller may have finished Create Listing while its Article was
 * still in catalog review. Submission is never treated as Admin publication.
 */
export async function submitListingsWaitingForArticle(
  tx: Prisma.TransactionClient,
  productId: string,
  actorId: string,
): Promise<number> {
  const article = await tx.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      priceRequirement: true, stockRequirement: true,
      conditionRequirement: true, warrantyRequirement: true,
    },
  });
  if (article?.status !== ProductStatus.ACTIVE) return 0;

  // Listing approval is still a separate human/Admin decision. Never auto-approve.
  const queued = await tx.sellerListing.findMany({
    where: {
      productId, reviewIntent: true,
      status: { in: [SellerListingStatus.DRAFT, SellerListingStatus.REJECTED] },
    },
    take: 200,
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, version: true, condition: true, warrantyInformation: true,
      price: { select: { sellingPrice: true } },
      inventories: { select: { id: true } },
      seller: { select: {
        status: true, approvalStatus: true, verificationStatus: true,
      } },
    },
  });

  let submitted = 0;
  for (const listing of queued) {
    if (listing.seller.status !== SellerStatus.ACTIVE ||
        listing.seller.approvalStatus !== SellerApprovalStatus.APPROVED ||
        listing.seller.verificationStatus !== SellerVerificationStatus.VERIFIED) continue;
    const checks = [
      { level: article.priceRequirement, present: !!listing.price && Number(listing.price.sellingPrice) > 0 },
      { level: article.stockRequirement, present: listing.inventories.length > 0 },
      { level: article.conditionRequirement, present: !!listing.condition },
      { level: article.warrantyRequirement, present: !!listing.warrantyInformation?.trim() },
    ];
    if (checks.some(check =>
      (check.level === ProductTypeRequirementLevel.REQUIRED && !check.present) ||
      (check.level === ProductTypeRequirementLevel.NOT_APPLICABLE && check.present))) continue;
    try {
      await assertSellerListingMediaReady(tx, listing.id);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        // Seller can correct the Draft. Never promote it without required images.
        continue;
      }
      throw error;
    }

    const updated = await tx.sellerListing.updateMany({
      where: {
        id: listing.id, version: listing.version, productId,
        status: { in: [SellerListingStatus.DRAFT, SellerListingStatus.REJECTED] },
        reviewIntent: true,
      },
      data: {
        status: SellerListingStatus.SUBMITTED, version: { increment: 1 },
        updatedById: actorId, rejectionReason: null,
      },
    });
    if (updated.count !== 1) throw new ConflictException('Listing changed during Article activation.');
    await tx.auditLog.create({
      data: {
        actorId, action: 'SELLER_LISTING_SUBMITTED_AFTER_ARTICLE_ACTIVATION',
        entityType: 'SellerListing', entityId: listing.id,
        metadata: { productId, articleActivated: true },
      },
    });
    submitted++;
  }
  return submitted;
}
