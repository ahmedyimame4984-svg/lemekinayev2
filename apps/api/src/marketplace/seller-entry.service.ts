import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  ArticleSource, CompatibilityFitmentType, CompatibilityVerificationStatus,
  MasterDataStatus, Prisma, ProductStatus, ProductTypeRequirementLevel,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerService } from './seller.service.js';
import { SellerProductService } from './seller-product.service.js';
import { ListingService } from './listing.service.js';
import { SaveSellerEntryDto, SellerEntryKind } from './dto/seller-entry.dto.js';
import { SellerArticleIdentityResolver } from './seller-article-identity-resolver.service.js';

type EntryRequirements = {
  fitment: ProductTypeRequirementLevel;
  gtin: ProductTypeRequirementLevel;
  oe: ProductTypeRequirementLevel;
  cross: ProductTypeRequirementLevel;
};

function snapshotRequirements(snapshot: unknown): EntryRequirements {
  const data = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown> : {};
  const raw = data.articleRequirements ?? data.requirements;
  const rules = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  const level = (value: unknown): ProductTypeRequirementLevel =>
    value === 'REQUIRED' || value === 'NOT_APPLICABLE'
      ? value : ProductTypeRequirementLevel.OPTIONAL;
  return {
    fitment: level(rules.fitment),
    gtin: level(rules.gtin),
    oe: level(rules.oeReference ?? rules.oemReference),
    cross: level(rules.crossReference),
  };
}

@Injectable()
export class SellerEntryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
    private readonly identities: SellerArticleIdentityResolver,
    private readonly stock: SellerProductService,
    private readonly listings: ListingService,
  ) {}

  async offerRequirementsForSellerArticle(articleId: string, userId: string) {
    return this.listings.offerRequirementsForSellerArticle(articleId, userId);
  }

  async save(input: SaveSellerEntryDto, userId: string) {
    if (Boolean(input.article) === Boolean(input.articleId)) {
      throw new BadRequestException('Choose one existing Article or enter one new Article.');
    }
    if (input.sellerProductId && input.kind !== SellerEntryKind.LISTING) {
      throw new BadRequestException('An existing Inventory SKU may only be used for a Listing.');
    }
    if (input.identifiers && !input.article) {
      throw new BadRequestException('Canonical identifiers cannot be edited when selecting an existing Article.');
    }
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const vehicleIds = input.vehicleConfigurationIds ?? [];
    const sku = input.sku.trim().toUpperCase();
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ ...input, sku }))
      .digest('hex');

    try {
    const result = await this.database.$transaction(async (tx) => {
      // Retry detection must also cover Listing First from an existing Inventory SKU.
      // The same SKU may be listed for the first time, but a repeated Save must
      // never create another Listing or bypass the saved request fingerprint.
      const previous = await tx.sellerProduct.findUnique({
        where: { sellerId_sku: { sellerId: seller.id, sku } },
        select: {
          id: true, productId: true,
          listing: { select: { id: true } },
        },
      });
      if (previous) {
        if (input.sellerProductId && previous.id !== input.sellerProductId) {
          throw new BadRequestException('The selected Inventory SKU does not match your inventory record.');
        }
        const recordId = input.kind === SellerEntryKind.INVENTORY
          ? previous.id : previous.listing?.id;
        if (recordId) {
          const log = await tx.auditLog.findFirst({
            where: {
              actorId: userId, action: 'SELLER_ENTRY_COMMITTED',
              entityType: input.kind === SellerEntryKind.INVENTORY ? 'SellerProduct' : 'SellerListing',
              entityId: recordId,
            },
            select: { metadata: true },
          });
          const details = log?.metadata;
          if (!details || typeof details !== 'object' ||
              Array.isArray(details) || details.requestHash !== requestHash) {
            throw new ConflictException('This SKU already exists for another request. Refresh Inventory before retrying.');
          }
          return {
            kind: input.kind, articleId: previous.productId!,
            articleCreated: false, recordId, replayed: true,
          };
        }
        if (!input.sellerProductId) {
          throw new ConflictException('This SKU is already in use for a different workflow.');
        }
      }
      let articleId = input.articleId ?? '';
      let created = false;
      const entry = input.article;
      if (entry) {
        const resolved = await this.identities.resolve(tx, {
          article: entry, identifiers: input.identifiers,
          vehicleConfigurationIds: vehicleIds,
        }, seller.id, userId);
        articleId = resolved.articleId;
        created = resolved.created;
      }

      const article = await tx.product.findUnique({
        where: { id: articleId },
        select: {
          id: true, status: true, articleSource: true,
          sourceSellerId: true, catalogReviewSubmittedAt: true,
          schemaVersion: { select: { snapshot: true } },
        },
      });
      const ownDraft = article?.status === ProductStatus.DRAFT &&
        article.sourceSellerId === seller.id &&
        article.articleSource === ArticleSource.SELLER_SUBMISSION;
      if (!article || !(article.status === ProductStatus.ACTIVE || ownDraft)) {
        throw new BadRequestException('Select an Active Article or your own Draft.');
      }
      const requirements = snapshotRequirements(article.schemaVersion.snapshot);
      if (vehicleIds.length && requirements.fitment === ProductTypeRequirementLevel.NOT_APPLICABLE) {
        throw new BadRequestException('This Product Type does not support configured-vehicle fitment.');
      }
      if (requirements.fitment === ProductTypeRequirementLevel.REQUIRED && vehicleIds.length === 0) {
        // A selected existing Article already owns its fitment evidence. New
        // inline Article entry must provide exact configurations explicitly.
        if (entry) {
          throw new BadRequestException('Select at least one Vehicle Configuration for this Product Type.');
        }
        const evidence = await tx.vehicleCompatibility.count({
          where: {
            productId: articleId,
            fitmentType: CompatibilityFitmentType.EXACT,
            ...(article.status === ProductStatus.ACTIVE
              ? {
                  status: MasterDataStatus.ACTIVE,
                  verificationStatus: {
                    in: [
                      CompatibilityVerificationStatus.VERIFIED,
                      CompatibilityVerificationStatus.APPROVED,
                    ],
                  },
                }
              : { status: { not: MasterDataStatus.ARCHIVED } }),
          },
        });
        if (evidence === 0) {
          throw new ConflictException('This Article needs configured-vehicle fitment evidence before it can be used.');
        }
      }

      // Existing shared Articles are immutable: selecting vehicle IDs must
      // describe their complete fitment set, never append new evidence.
      if (!entry && vehicleIds.length > 0) {
        const stored = await tx.vehicleCompatibility.findMany({
          where: {
            productId: articleId, fitmentType: CompatibilityFitmentType.EXACT,
            vehicleConfigurationId: { not: null },
            status: { not: MasterDataStatus.ARCHIVED },
          },
          select: { vehicleConfigurationId: true },
        });
        const canonical = [...new Set(stored.map(row => row.vehicleConfigurationId).filter(Boolean))].sort();
        if (JSON.stringify(canonical) !== JSON.stringify([...vehicleIds].sort())) {
          throw new ConflictException('Selected vehicle configurations must exactly match the existing product fitments.');
        }
      }

      if (input.sellerProductId) {
        const existing = await tx.sellerProduct.findFirst({
          where: { id: input.sellerProductId, sellerId: seller.id },
          select: { productId: true, sku: true },
        });
        if (!existing || existing.productId !== articleId ||
            existing.sku !== sku) {
          throw new BadRequestException('The selected Inventory SKU or Article does not match your inventory record.');
        }
      }
      if (input.kind === SellerEntryKind.INVENTORY) {
        const inventoryId = await this.stock.create({
          productId: articleId,
          sku,
          condition: input.condition,
          packageQuantity: input.packageQuantity,
          openingQuantity: input.openingQuantity,
          locationId: input.locationId,
        }, userId, tx);
        await tx.auditLog.create({ data: {
          actorId: userId, action: 'SELLER_ENTRY_COMMITTED',
          entityType: 'SellerProduct', entityId: inventoryId,
          metadata: { sellerId: seller.id, requestHash },
        } });
        return { kind: input.kind, articleId, articleCreated: created, recordId: inventoryId, replayed: false };
      }

      const listingId = await this.listings.createForSellerUser({
        productId: articleId,
        sellerProductId: input.sellerProductId,
        sellerSku: input.sellerProductId ? (await tx.sellerProduct.findUniqueOrThrow({
          where: { id: input.sellerProductId }, select: { sku: true },
        })).sku : sku,
        selectedLocationId: input.locationId,
        condition: input.condition,
        packageQuantity: input.sellerProductId ? undefined : input.packageQuantity,
        openingQuantity: input.sellerProductId ? undefined : input.openingQuantity,
        sellerTitle: input.sellerTitle,
        sellerDescription: input.sellerDescription,
        warrantyInformation: input.warrantyInformation,
        deliveryInformation: input.deliveryInformation,
        commercialDetails: input.commercialDetails,
        sellingPrice: input.sellingPrice,
        basePrice: 0,
        currency: 'ETB',
      }, userId, tx);
      await tx.auditLog.create({ data: {
        actorId: userId, action: 'SELLER_ENTRY_COMMITTED',
        entityType: 'SellerListing', entityId: listingId,
        metadata: { sellerId: seller.id, requestHash },
      } });
      return { kind: input.kind, articleId, articleCreated: created, recordId: listingId, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });

    // Read only after commit; never report success before the transaction completes.
    return result.kind === SellerEntryKind.INVENTORY
      ? { ...result, record: await this.stock.get(result.recordId, userId) }
      : { ...result, record: await this.listings.getForSellerUser(result.recordId, userId) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034')) {
        throw new ConflictException({
          code: 'SELLER_ENTRY_CONCURRENT_CHANGE',
          message: 'This Article identity or Seller SKU was created or changed in another request. Refresh and retry.',
        });
      }
      throw error;
    }
  }

}
