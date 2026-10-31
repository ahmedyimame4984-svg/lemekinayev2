import { ConflictException } from '@nestjs/common';
import { MasterDataStatus, ProductAssetType, ProductTypeRequirementLevel, Prisma } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';

/**
 * Product Type media policy is frozen on products at Article creation.
 * Images/documents meeting these policies are owned by the Seller Listing,
 * never by the shared canonical Article.
 */
export async function assertSellerListingMediaReady(
  database: DatabaseService | Prisma.TransactionClient, listingId: string,
): Promise<void> {
  const listing = await database.sellerListing.findUnique({
    where: { id: listingId },
    select: {
      product: { select: {
        imageRequirement: true, minimumImageCount: true, maximumImageCount: true,
        documentRequirement: true, minimumDocumentCount: true,
      } },
      assets: {
        where: { status: MasterDataStatus.ACTIVE, isPublished: true },
        select: { type: true, isPrimary: true },
      },
    },
  });
  if (!listing) throw new ConflictException('Listing not found for media review.');
  const imageCount = listing.assets.filter(x => x.type === ProductAssetType.IMAGE).length;
  const documentCount = listing.assets.filter(x => x.type === ProductAssetType.DOCUMENT).length;
  const requiredImages = listing.product.imageRequirement === ProductTypeRequirementLevel.REQUIRED
    ? Math.max(1, listing.product.minimumImageCount) : 0;
  const requiredDocuments = listing.product.documentRequirement === ProductTypeRequirementLevel.REQUIRED
    ? Math.max(1, listing.product.minimumDocumentCount) : 0;
  if (listing.product.imageRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && imageCount ||
      listing.product.documentRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && documentCount) {
    throw new ConflictException({
      code: 'SELLER_LISTING_MEDIA_NOT_APPLICABLE',
      message: 'Remove images or documents not permitted by the Article-bound Product Type policy.',
    });
  }
  if (imageCount > listing.product.maximumImageCount) {
    throw new ConflictException({
      code: 'SELLER_LISTING_IMAGE_LIMIT_EXCEEDED',
      message: `This Product Type permits at most ${listing.product.maximumImageCount} verified Listing image(s).`,
    });
  }
  if (imageCount < requiredImages || documentCount < requiredDocuments) {
    throw new ConflictException({
      code: 'SELLER_LISTING_MEDIA_REQUIRED',
      message: `Upload at least ${requiredImages} image(s) and ${requiredDocuments} document(s). Currently verified: ${imageCount} image(s), ${documentCount} document(s).`,
    });
  }
  if (requiredImages > 0 &&
      !listing.assets.some(x => x.type === ProductAssetType.IMAGE && x.isPrimary)) {
    throw new ConflictException({
      code: 'SELLER_LISTING_PRIMARY_IMAGE_REQUIRED',
      message: 'Choose a primary Seller Listing image before submission.',
    });
  }
}
