import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ArticleSource, Prisma, ProductStatus, ProductTypeRequirementLevel,
  SellerListingRevisionStatus, SellerListingStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type { SaveSellerListingEditDto } from './dto/seller-listing-edit.dto.js';
import { SellerArticleIdentityResolver } from './seller-article-identity-resolver.service.js';
import { SellerService } from './seller.service.js';
import { SellerArticleService } from './seller-article.service.js';
import { SellerR2StorageService } from './seller-r2-storage.service.js';
import { assertSellerListingMediaReady } from './seller-listing-media-readiness.js';
import { parseProposedMedia, publishProposedMedia, validateProposedMedia } from './seller-listing-media-revision.js';

type ListingSaveOutcome = {
  listingId: string;
  version: number;
  status: 'UNCHANGED' | 'APPLIED' | 'PENDING_REVIEW' | 'PRICE_UPDATED';
  articleId: string;
  proposedArticleId?: string;
  newArticle?: boolean;
};

type SellingFields = 'sellerTitle' | 'sellerDescription' | 'warrantyInformation' | 'deliveryInformation';
const FIELDS: readonly SellingFields[] = [
  'sellerTitle', 'sellerDescription', 'warrantyInformation', 'deliveryInformation',
];

function offeredFields(input: SaveSellerListingEditDto): Partial<Record<SellingFields, string | null>> {
  const result: Partial<Record<SellingFields, string | null>> = {};
  for (const key of FIELDS) {
    if (input[key] !== undefined) result[key] = input[key]?.trim() || null;
  }
  return result;
}

function isEditableDraft(status: SellerListingStatus): boolean {
  return status === SellerListingStatus.DRAFT || status === SellerListingStatus.REJECTED;
}

function isLive(status: SellerListingStatus): boolean {
  return status === SellerListingStatus.ACTIVE ||
    status === SellerListingStatus.OUT_OF_STOCK || status === SellerListingStatus.PAUSED;
}

@Injectable()
export class SellerListingEditService {
  private readonly logger = new Logger(SellerListingEditService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
    private readonly identities: SellerArticleIdentityResolver,
    private readonly articles: SellerArticleService,
    private readonly storage: SellerR2StorageService,
  ) {}

  async getPending(id: string, userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const listing = await this.database.sellerListing.findFirst({
      where: { id, sellerId: seller.id }, select: { id: true },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    // NestJS can serialize a bare null as an empty HTTP 200 response.
    // Always return a JSON object, including when there is no pending revision.
    const revision = await this.database.sellerListingRevision.findFirst({
      where: { listingId: id, status: SellerListingRevisionStatus.PENDING },
      select: {
        id: true, sourceVersion: true, proposedProductId: true,
        changes: true, proposedMedia: true, status: true, createdAt: true,
      },
    });
    return { revision };
  }

  async save(id: string, input: SaveSellerListingEditDto, userId: string) {
    if (input.article && input.articleId) {
      throw new BadRequestException('Choose an existing product or enter new product specifications, not both.');
    }
    if (input.mediaAssetIds === undefined && input.primaryMediaId !== undefined) {
      throw new BadRequestException('Choose the complete media set when changing the primary image.');
    }
    if (!input.article && (input.identifiers || input.vehicleConfigurationIds)) {
      throw new BadRequestException('Identifiers and fitments require complete product specifications.');
    }
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    try {
      const outcome = await this.database.$transaction(async (tx): Promise<ListingSaveOutcome> => {
        const listing = await tx.sellerListing.findFirst({
          where: { id, sellerId: seller.id },
          select: {
            id: true, version: true, status: true, productId: true,
            sellerProductId: true, sellerTitle: true, sellerDescription: true,
            warrantyInformation: true, deliveryInformation: true,
            price: { select: { id: true, version: true, sellingPrice: true } },
          },
        });
        if (!listing) throw new NotFoundException('Listing not found.');
        if (listing.version !== input.version) {
          throw new ConflictException('Listing changed. Reload before saving.');
        }
        if (!isEditableDraft(listing.status) && !isLive(listing.status)) {
          throw new ConflictException('This Listing cannot be edited in its current review or suspension state.');
        }
        let productId = listing.productId;
        let newArticle = false;
        if (input.article) {
          const result = await this.identities.resolve(tx, {
            article: input.article, identifiers: input.identifiers,
            vehicleConfigurationIds: input.vehicleConfigurationIds,
          }, seller.id, userId);
          productId = result.articleId;
          newArticle = result.created;
        } else if (input.articleId) {
          productId = input.articleId;
        }
        if (productId !== listing.productId) {
          const selected = await tx.product.findUnique({
            where: { id: productId },
            select: {
              status: true, articleSource: true, sourceSellerId: true,
            },
          });
          if (!selected || !(selected.status === ProductStatus.ACTIVE ||
            (selected.status === ProductStatus.DRAFT &&
              selected.articleSource === ArticleSource.SELLER_SUBMISSION &&
              selected.sourceSellerId === seller.id))) {
            throw new BadRequestException('Choose an Active product or your own Draft product.');
          }
        }
        const changes = offeredFields(input);
        for (const field of FIELDS) {
          if (changes[field] === listing[field]) delete changes[field];
        }
        const mediaChanged = input.mediaAssetIds !== undefined;
        if (mediaChanged && isLive(listing.status)) {
          const policy = await tx.product.findUniqueOrThrow({
            where: { id: productId }, select: {
              imageRequirement: true, minimumImageCount: true, maximumImageCount: true,
              documentRequirement: true, minimumDocumentCount: true,
            },
          });
          await validateProposedMedia(tx, id, {
            assetIds: input.mediaAssetIds!, primaryId: input.primaryMediaId ?? null,
          }, policy);
        }
        const contentChanged = Object.keys(changes).length > 0 || productId !== listing.productId ||
          (mediaChanged && isLive(listing.status));
        const priceChanged = input.sellingPrice !== undefined &&
          Number(listing.price?.sellingPrice ?? 0) !== input.sellingPrice;
        if (priceChanged && listing.price && input.priceVersion !== listing.price.version) {
          throw new ConflictException('Price changed. Reload before saving.');
        }
        if (!contentChanged && !priceChanged) {
          return { listingId: id, version: listing.version, status: 'UNCHANGED', articleId: productId };
        }
        if (priceChanged) {
          const product = await tx.product.findUniqueOrThrow({
            where: { id: isLive(listing.status) ? listing.productId : productId }, select: { priceRequirement: true },
          });
          if (product.priceRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE) {
            throw new BadRequestException('This Product Type does not permit pricing.');
          }
          if (listing.price) {
            const updated = await tx.listingPrice.updateMany({
              where: { id: listing.price.id, version: input.priceVersion },
              data: { sellingPrice: input.sellingPrice!, version: { increment: 1 } },
            });
            if (updated.count !== 1) throw new ConflictException('Price changed. Reload before saving.');
          } else {
            await tx.listingPrice.create({ data: {
              listingId: id, basePrice: 0, sellingPrice: input.sellingPrice!, currency: 'ETB',
            } });
          }
          await tx.auditLog.create({ data: {
            actorId: userId, action: 'SELLER_LISTING_PRICE_UPDATED',
            entityType: 'SellerListing', entityId: id,
            metadata: { oldValue: listing.price ? Number(listing.price.sellingPrice) : null,
              newValue: input.sellingPrice },
          } });
        }
        const updated = await tx.sellerListing.updateMany({
          where: { id, sellerId: seller.id, version: input.version },
          data: {
            ...(isEditableDraft(listing.status) && contentChanged
              ? { ...changes, productId, ...(listing.status === SellerListingStatus.REJECTED
                ? { status: SellerListingStatus.DRAFT, rejectionReason: null, reviewIntent: false }
                : {}) } : {}),
            version: { increment: 1 }, updatedById: userId,
          },
        });
        if (updated.count !== 1) throw new ConflictException('Listing changed. Reload before saving.');
        if (isEditableDraft(listing.status)) {
          if (productId !== listing.productId && listing.sellerProductId) {
            const stockUpdated = await tx.sellerProduct.updateMany({
              where: { id: listing.sellerProductId, sellerId: seller.id, productId: listing.productId },
              data: { productId, updatedById: userId },
            });
            if (stockUpdated.count !== 1) throw new ConflictException('Inventory product changed. Reload.');
          }
          await tx.auditLog.create({ data: {
            actorId: userId, action: 'SELLER_LISTING_UNIFIED_EDIT_SAVED',
            entityType: 'SellerListing', entityId: id,
            metadata: { articleChanged: productId !== listing.productId, newArticle,
              changedFields: Object.keys(changes), priceChanged },
          } });
          return { listingId: id, version: listing.version + 1, status: 'APPLIED',
            articleId: productId, newArticle };
        }
        if (contentChanged) {
          const alreadyPending = await tx.sellerListingRevision.findFirst({
            where: { listingId: id, status: SellerListingRevisionStatus.PENDING },
            select: { id: true },
          });
          if (alreadyPending) {
            throw new ConflictException('A Listing edit is already awaiting Admin review.');
          }
          const revision = await tx.sellerListingRevision.create({ data: {
            listingId: id, sourceVersion: listing.version + 1,
            proposedProductId: productId !== listing.productId ? productId : null,
            changes: changes as Prisma.InputJsonObject,
            ...(mediaChanged ? { proposedMedia: {
              assetIds: input.mediaAssetIds!,
              primaryId: input.primaryMediaId ?? null,
            } } : {}),
            createdById: userId, status: SellerListingRevisionStatus.PENDING,
          }, select: { id: true } });
          if (mediaChanged) {
            const staged = await tx.sellerListingAsset.findMany({
              where: {
                listingId: id, id: { in: input.mediaAssetIds! },
                isPublished: false, status: 'ACTIVE', stagedForRevisionId: null,
              }, select: { id: true },
            });
            if (staged.length) {
              const claimed = await tx.sellerListingAsset.updateMany({
                where: {
                  listingId: id, id: { in: staged.map(asset => asset.id) },
                  isPublished: false, status: 'ACTIVE', stagedForRevisionId: null,
                },
                data: { stagedForRevisionId: revision.id },
              });
              if (claimed.count !== staged.length) {
                throw new ConflictException('An image changed while saving. Reload the Listing.');
              }
            }
          }
          await tx.auditLog.create({ data: {
            actorId: userId, action: 'SELLER_LISTING_REVISION_REQUESTED',
            entityType: 'SellerListing', entityId: id,
            metadata: { originalArticleId: listing.productId,
              proposedArticleId: productId, newArticle, changedFields: Object.keys(changes) },
          } });
        }
        return { listingId: id, version: listing.version + 1,
          status: contentChanged ? 'PENDING_REVIEW' : 'PRICE_UPDATED',
          articleId: listing.productId, proposedArticleId: contentChanged ? productId : undefined,
          newArticle };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
      if (!outcome.newArticle) return outcome;
      const articleId = outcome.proposedArticleId ?? outcome.articleId;
      // Article review is a separately validated catalog transition. It cannot
      // join the original transaction because readiness inspects committed data.
      // Never turn a committed Listing Save into a misleading "Save failed" UI.
      try {
        await this.articles.submitForReview(articleId, userId);
        return { ...outcome, articleReview: 'SUBMITTED' as const };
      } catch (error) {
        const message = error instanceof BadRequestException || error instanceof ConflictException
          ? error.message : 'Product information was saved, but automatic catalog review could not complete.';
        return {
          ...outcome,
          articleReview: 'NEEDS_ATTENTION' as const,
          articleReviewMessage: message,
        };
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034')) {
        throw new ConflictException('This product or Listing was changed by another request. Reload and retry.');
      }
      throw error;
    }
  }

  async listPendingAdmin() {
    return this.database.sellerListingRevision.findMany({
      where: { status: SellerListingRevisionStatus.PENDING },
      select: {
        id: true, listingId: true, sourceVersion: true,
        proposedProductId: true, changes: true, proposedMedia: true, createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
  }

  async review(id: string, revisionId: string, actorId: string, action: 'APPROVE' | 'REJECT', reason?: string) {
    if (action === 'REJECT' && (!reason || reason.trim().length < 3)) {
      throw new BadRequestException('Enter a reason for rejection.');
    }
    const decision = await this.database.$transaction(async tx => {
      const cleanupKeys: string[] = [];
      const revision = await tx.sellerListingRevision.findFirst({
        where: { id: revisionId, listingId: id, status: SellerListingRevisionStatus.PENDING },
      });
      if (!revision) throw new NotFoundException('Pending revision not found.');
      const listing = await tx.sellerListing.findUnique({
        where: { id }, select: {
          sellerId: true, sellerProductId: true, productId: true,
          status: true, version: true, condition: true, warrantyInformation: true,
          price: { select: { sellingPrice: true } },
          inventories: { select: { id: true } },
          seller: { select: { status: true, approvalStatus: true, verificationStatus: true } },
        },
      });
      if (!listing || !isLive(listing.status)) {
        throw new ConflictException('Only live Listings can receive reviewed revisions.');
      }
      if (action === 'APPROVE') {
        if (listing.seller.status !== 'ACTIVE' ||
            listing.seller.approvalStatus !== 'APPROVED' ||
            listing.seller.verificationStatus !== 'VERIFIED') {
          throw new ConflictException('Listing Seller is no longer eligible for approval.');
        }
        const proposedArticleId = revision.proposedProductId ?? listing.productId;
        const article = await tx.product.findUnique({
          where: { id: proposedArticleId },
          select: {
            status: true, priceRequirement: true, stockRequirement: true,
            conditionRequirement: true, warrantyRequirement: true,
            imageRequirement: true, minimumImageCount: true, maximumImageCount: true,
            documentRequirement: true, minimumDocumentCount: true,
          },
        });
        if (article?.status !== ProductStatus.ACTIVE) {
          throw new ConflictException('The proposed product must complete catalog approval before this revision can be approved.');
        }
        const allowed = Object.fromEntries(
          Object.entries(revision.changes && typeof revision.changes === 'object' &&
            !Array.isArray(revision.changes) ? revision.changes : {})
            .filter(([key]) => FIELDS.includes(key as SellingFields)),
        ) as Partial<Record<SellingFields, string | null>>;
        const warranty = allowed.warrantyInformation === undefined
          ? listing.warrantyInformation : allowed.warrantyInformation;
        if ((article.priceRequirement === ProductTypeRequirementLevel.REQUIRED && !listing.price) ||
            (article.priceRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && !!listing.price)) {
          throw new ConflictException('Listing price is not compatible with the proposed Product Type.');
        }
        if ((article.conditionRequirement === ProductTypeRequirementLevel.REQUIRED && !listing.condition) ||
            (article.conditionRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && !!listing.condition)) {
          throw new ConflictException('Listing condition is not compatible with the proposed Product Type.');
        }
        if ((article.warrantyRequirement === ProductTypeRequirementLevel.REQUIRED && !warranty) ||
            (article.warrantyRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && !!warranty)) {
          throw new ConflictException('Listing warranty is not compatible with the proposed Product Type.');
        }
        if (article.stockRequirement === ProductTypeRequirementLevel.REQUIRED &&
            !listing.inventories.length) {
          throw new ConflictException('Stock-backed Listing requires Inventory before approval.');
        }
        if (article.stockRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE &&
            listing.inventories.length > 0) {
          throw new ConflictException('Inventory is not applicable to the proposed Product Type.');
        }
        const updated = await tx.sellerListing.updateMany({
          where: { id, version: listing.version },
          data: {
            ...allowed,
            ...(revision.proposedProductId ? { productId: revision.proposedProductId } : {}),
            version: { increment: 1 }, updatedById: actorId,
          },
        });
        if (updated.count !== 1) throw new ConflictException('Listing changed during review.');
        // The live asset set changes only inside the same successful Admin transaction.
        const proposedMedia = parseProposedMedia(revision.proposedMedia);
        if (proposedMedia) cleanupKeys.push(...await publishProposedMedia(tx, id, revisionId, proposedMedia, article));
        await assertSellerListingMediaReady(tx, id);
        if (revision.proposedProductId && listing.sellerProductId) {
          const stockUpdated = await tx.sellerProduct.updateMany({
            where: { id: listing.sellerProductId, sellerId: listing.sellerId, productId: listing.productId },
            data: { productId: revision.proposedProductId, updatedById: actorId },
          });
          if (stockUpdated.count !== 1) throw new ConflictException('Inventory changed during review.');
        }
      }
      if (action === 'REJECT' && revision.proposedMedia != null) {
        const discarded = await tx.sellerListingAsset.findMany({
          where: { listingId: id, stagedForRevisionId: revisionId, isPublished: false,
            status: 'ACTIVE' },
          select: { storageKey: true },
        });
        cleanupKeys.push(...discarded.map(asset => asset.storageKey));
        await tx.sellerListingAsset.updateMany({
          where: { listingId: id, stagedForRevisionId: revisionId, isPublished: false },
          data: { status: 'ARCHIVED', isPrimary: false },
        });
      }
      const claimed = await tx.sellerListingRevision.updateMany({
        where: { id: revisionId, status: SellerListingRevisionStatus.PENDING },
        data: {
          status: action === 'APPROVE'
            ? SellerListingRevisionStatus.APPROVED : SellerListingRevisionStatus.REJECTED,
          reviewedById: actorId, reviewedAt: new Date(),
          reviewReason: action === 'REJECT' ? reason!.trim() : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('This revision has already been reviewed.');
      await tx.auditLog.create({ data: {
        actorId, action: action === 'APPROVE' ? 'SELLER_LISTING_REVISION_APPROVED' : 'SELLER_LISTING_REVISION_REJECTED',
        entityType: 'SellerListingRevision', entityId: revisionId,
        metadata: { listingId: id, proposedProductId: revision.proposedProductId, reason: reason ?? null },
      } });
      return {
        listingId: id, revisionId,
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        cleanupKeys,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    // Database decision is already durable. A transient R2 delete error must
    // not undo approval or rejection; the archived key stays available for ops.
    await Promise.all(decision.cleanupKeys.map(async key => {
      try {
        await this.storage.remove(key);
      } catch {
        this.logger.warn('Archived Listing media R2 object needs cleanup retry.');
      }
    }));
    return { listingId: decision.listingId, revisionId: decision.revisionId,
      status: decision.status };
  }
}
