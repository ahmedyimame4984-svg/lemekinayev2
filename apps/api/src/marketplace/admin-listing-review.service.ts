import { Injectable } from '@nestjs/common';
import { MasterDataStatus, SellerListingRevisionStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { ListingService } from './listing.service.js';

/**
 * Admin-only review read model. Keep the seller ownership check on the
 * Seller API; this service is exposed exclusively by the permission-guarded
 * AdminListingController.
 */
@Injectable()
export class AdminListingReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly listings: ListingService,
  ) {}

  private article(productId: string) {
    return this.database.product.findUnique({
      where: { id: productId },
      select: {
        id: true, name: true, status: true, productTypeId: true,
        brandId: true, schemaVersionId: true, articleSource: true,
        shortDescription: true, description: true, manufacturerNotes: true,
        unitOfMeasure: { select: { code: true } }, packQuantity: true,
        sourceReference: true, version: true, publishedAt: true,
        brand: { select: { name: true } },
        productType: { select: { name: true } },
        imageRequirement: true, minimumImageCount: true, maximumImageCount: true,
        documentRequirement: true, minimumDocumentCount: true,
        partNumbers: { select: { type: true, partNumber: true, issuerBrandId: true } },
        articleIdentifiers: { select: { type: true, value: true } },
        attributeValues: {
          select: {
            attribute: { select: { code: true, name: true } },
            valueString: true, valueNumeric: true, valueBoolean: true,
            valueReferenceId: true, valueJson: true, unit: true,
          },
        },
        compatibilities: {
          select: {
            vehicleConfigurationId: true, fitmentType: true,
            status: true, verificationStatus: true,
            steeringSide: true, driveType: true, yearFrom: true, yearTo: true,
            position: true, conditions: true, notes: true, source: true,
            vehicleConfiguration: {
              select: {
                id: true, code: true, identityCode: true, modelYear: true,
                make: { select: { name: true } },
                model: { select: { name: true } },
                generation: { select: { name: true } },
                trim: { select: { name: true } },
                engine: { select: { name: true } },
                transmission: { select: { code: true } },
                bodyType: { select: { name: true } },
                market: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }

  async get(id: string) {
    // Reuse the Listing read model, including current stock and price, rather
    // than duplicating quantity calculations or weakening approval checks.
    const listing = await this.listings.getAdmin(id);
    const [seller, article, pendingRevision, stockAndMedia] = await Promise.all([
      this.database.seller.findUnique({
        where: { id: listing.sellerId },
        select: {
          id: true, sellerCode: true, businessName: true, displayName: true,
          status: true, approvalStatus: true, verificationStatus: true,
        },
      }),
      this.article(listing.productId),
      this.database.sellerListingRevision.findFirst({
        where: { listingId: id, status: SellerListingRevisionStatus.PENDING },
        select: {
          id: true, sourceVersion: true, proposedProductId: true,
          changes: true, proposedMedia: true, createdAt: true, status: true,
        },
      }),
      this.database.sellerListing.findUnique({
        where: { id },
        select: {
          inventories: {
            select: {
              id: true, quantityOnHand: true, quantityReserved: true,
              safetyStock: true, availabilityStatus: true,
              location: {
                select: {
                  name: true, code: true, addressText: true,
                  status: true, onlineFulfillmentEnabled: true,
                },
              },
            },
          },
          assets: {
            where: { status: MasterDataStatus.ACTIVE, isPublished: true },
            select: { type: true, isPrimary: true },
          },
        },
      }),
    ]);
    const proposedMedia = pendingRevision?.proposedMedia &&
      typeof pendingRevision.proposedMedia === 'object' &&
      !Array.isArray(pendingRevision.proposedMedia)
      ? pendingRevision.proposedMedia : null;
    const proposedArticle = pendingRevision?.proposedProductId &&
      pendingRevision.proposedProductId !== listing.productId
      ? await this.article(pendingRevision.proposedProductId)
      : null;
    const verifiedImages = stockAndMedia?.assets.filter(asset => asset.type === 'IMAGE') ?? [];
    const verifiedDocuments = stockAndMedia?.assets.filter(asset => asset.type === 'DOCUMENT') ?? [];
    const proposedIds = proposedMedia && Array.isArray(proposedMedia.assetIds)
      ? proposedMedia.assetIds.filter((id): id is string => typeof id === 'string') : [];
    const proposedMediaAssets = proposedIds.length ? await this.database.sellerListingAsset.findMany({
      where: {
        listingId: id, id: { in: proposedIds }, status: MasterDataStatus.ACTIVE,
        OR: [{ isPublished: true }, { stagedForRevisionId: pendingRevision!.id }],
      },
      select: {
        id: true, type: true, originalName: true, mimeType: true,
        isPublished: true, isPrimary: true,
      },
    }) : [];
    return {
      listing, seller, article, pendingRevision, proposedArticle,
      proposedMediaAssets: proposedIds.map(assetId => proposedMediaAssets.find(asset => asset.id === assetId)).filter(asset => asset !== undefined),
      inventoryLocations: stockAndMedia?.inventories ?? [],
      mediaSummary: {
        verifiedImageCount: verifiedImages.length,
        verifiedDocumentCount: verifiedDocuments.length,
        hasPrimaryImage: verifiedImages.some(asset => asset.isPrimary),
      },
    };
  }
}
