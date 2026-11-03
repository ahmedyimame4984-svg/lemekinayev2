import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleSource,
  InventoryAvailabilityStatus,
  InventoryMovementType,
  MasterDataStatus,
  Prisma,
  ProductStatus,
  ProductTypeRequirementLevel,
  SellerApprovalStatus,
  SellerListingStatus,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import {
  assertArticleActiveForCommerce,
  LIVE_SELLER_LISTING_STATUSES,
} from '../product/article-commerce-boundary.js';
import type {
  CreateSellerListingDto,
  ListingTransitionDto,
  RejectListingDto,
  SellerListingQueryDto,
  SellerListingResponseDto,
  UpdateListingPriceDto,
  UpdateSellerListingDto,
} from './dto/listing.dto.js';
import { SellerService } from './seller.service.js';
import { assertSellerListingMediaReady } from './seller-listing-media-readiness.js';
import { DEFAULT_COMMERCIAL_POLICY, commercialPolicyForProductType, validateSellerCommercialDetails, discountPrice } from './seller-listing-commercial.js';

const listingSelect = {
  id: true,
  sellerId: true,
  productId: true,
  sellerProductId: true,
  sellerSku: true,
  condition: true,
  sellerTitle: true,
  reviewIntent: true,
  sellerDescription: true,
  warrantyInformation: true,
  deliveryInformation: true,
  commercialTerms: true,
  commercialDetails: true,
  status: true,
  rejectionReason: true,
  version: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  price: {
    select: {
      id: true,
      basePrice: true,
      sellingPrice: true,
      promotionalPrice: true,
      currency: true,
      minOrderQuantity: true,
      version: true,
    },
  },
  inventories: {
    select: {
      quantityOnHand: true,
      quantityReserved: true,
      safetyStock: true,
      location: { select: { onlineFulfillmentEnabled: true, status: true } },
    },
  },
} satisfies Prisma.SellerListingSelect;

type ListingRecord = Prisma.SellerListingGetPayload<{
  select: typeof listingSelect;
}>;

type OfferRequirements = {
  price: ProductTypeRequirementLevel;
  stock: ProductTypeRequirementLevel;
  condition: ProductTypeRequirementLevel;
  warranty: ProductTypeRequirementLevel;
};

@Injectable()
export class ListingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
  ) {}

  async listAdmin(
    query: SellerListingQueryDto,
  ): Promise<SellerListingResponseDto[]> {
    const records = await this.database.sellerListing.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      },
      select: listingSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toResponse(record));
  }

  async getAdmin(id: string): Promise<SellerListingResponseDto> {
    const record = await this.database.sellerListing.findUnique({
      where: { id },
      select: listingSelect,
    });
    if (!record) throw this.notFound();
    return this.toResponse(record);
  }

  async listForSellerUser(
    userId: string,
    query: SellerListingQueryDto,
  ): Promise<SellerListingResponseDto[]> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const records = await this.database.sellerListing.findMany({
      where: {
        sellerId: seller.id,
        ...(query.status ? { status: query.status } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
      },
      select: listingSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toResponse(record));
  }

  async getForSellerUser(id: string, userId: string): Promise<SellerListingResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    return this.getOwned(id, seller.id);
  }

  /** Return the immutable Product Type Offer rules for a Seller-accessible Article. */
  async offerRequirementsForSellerArticle(articleId: string, userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const article = await this.database.product.findFirst({
      where: {
        id: articleId,
        OR: [
          { status: ProductStatus.ACTIVE },
          {
            status: ProductStatus.DRAFT,
            articleSource: ArticleSource.SELLER_SUBMISSION,
            sourceSellerId: seller.id,
          },
        ],
      },
      select: { schemaVersion: { select: { snapshot: true } } },
    });
    if (!article) {
      throw new BadRequestException({
        code: 'LISTING_PRODUCT_NOT_AVAILABLE',
        message: 'Select an Active Article or your own Draft Article before listing.',
      });
    }
    return {
      ...this.parseOfferRequirements(article.schemaVersion.snapshot),
      commercial: article.productType
        ? commercialPolicyForProductType(article.productType) : DEFAULT_COMMERCIAL_POLICY,
    };
  }

  async createForSellerUser(
    input: CreateSellerListingDto,
    userId: string,
  ): Promise<SellerListingResponseDto>;
  async createForSellerUser(
    input: CreateSellerListingDto,
    userId: string,
    outerTransaction: Prisma.TransactionClient,
  ): Promise<string>;
  async createForSellerUser(
    input: CreateSellerListingDto,
    userId: string,
    outerTransaction?: Prisma.TransactionClient,
  ): Promise<SellerListingResponseDto | string> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const product = await (outerTransaction ?? this.database).product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        status: true,
        articleSource: true,
        sourceSellerId: true,
        schemaVersion: { select: { snapshot: true } },
            productType: { select: { packageDimensionsRequirement: true, packageWeightRequirement: true, discountRequirement: true, transportRequirement: true, specialHandlingRequirement: true } },
      },
    });
    const canPrepareOffer =
      product?.status === ProductStatus.ACTIVE ||
      (product?.status === ProductStatus.DRAFT &&
        product.articleSource === ArticleSource.SELLER_SUBMISSION &&
        product.sourceSellerId === seller.id);
    if (!product || !canPrepareOffer) {
      throw new BadRequestException({
        code: 'LISTING_PRODUCT_NOT_AVAILABLE',
        message:
          'A Seller Offer can use an Active Manufacturer Article or this Seller’s own Draft Article submission while catalog review is pending',
      });
    }
    const requirements = this.parseOfferRequirements(
      product.schemaVersion.snapshot,
    );
    const price = this.resolveCreatePrice(input);
    const details = validateSellerCommercialDetails(input.commercialDetails,
      product.productType ? commercialPolicyForProductType(product.productType) : DEFAULT_COMMERCIAL_POLICY,
      false, price?.sellingPrice);
    if (price && details.discountType) {
      if (input.promotionalPrice !== undefined) {
        throw new BadRequestException('Choose a discount or a direct promotional price, not both.');
      }
      price.promotionalPrice = discountPrice(price.sellingPrice, details);
    }
    this.assertOfferFieldsApplicable({
      requirements,
      condition: input.condition ?? null,
      warrantyInformation: input.warrantyInformation?.trim() || null,
      hasPrice: price !== null,
      inventoryCount: 0,
    });

    try {
      const persist = async (transaction: Prisma.TransactionClient) => {
          const defaultLocation = await transaction.inventoryLocation.findFirst({
            where: { sellerId: seller.id, isDefault: true, status: MasterDataStatus.ACTIVE },
            select: { id: true },
          });
          if (!defaultLocation) {
            throw new ConflictException({
              code: 'DEFAULT_LOCATION_REQUIRED',
              message: 'Create a default Store before listing products.',
            });
          }
          const chosenLocation = input.selectedLocationId
            ? await transaction.inventoryLocation.findFirst({
                where: {
                  id: input.selectedLocationId,
                  sellerId: seller.id,
                  status: MasterDataStatus.ACTIVE,
                },
                select: { id: true },
              })
            : defaultLocation;
          if (!chosenLocation) {
            throw new BadRequestException({
              code: 'LISTING_LOCATION_INVALID',
              message: 'Select an active Store or Warehouse belonging to your Seller account.',
            });
          }
          const sku = input.sellerSku.trim().toUpperCase();
          const sellerProduct = input.sellerProductId
            ? await transaction.sellerProduct.findFirst({
                where: { id: input.sellerProductId, sellerId: seller.id },
                select: { id: true, sku: true, productId: true, condition: true, packageQuantity: true, packageUnit: true, listing: { select: { id: true } } },
              })
            : await transaction.sellerProduct.findUnique({
                where: { sellerId_sku: { sellerId: seller.id, sku } },
                select: { id: true, sku: true, productId: true, condition: true, packageQuantity: true, packageUnit: true, listing: { select: { id: true } } },
              });
          if (input.sellerProductId && !sellerProduct) {
            throw new BadRequestException({
              code: 'SELLER_PRODUCT_NOT_OWNED',
              message: 'The selected Seller Product does not belong to this Seller.',
            });
          }
          if (sellerProduct && (
            sellerProduct.listing ||
            sellerProduct.sku !== sku ||
            (sellerProduct.productId && sellerProduct.productId !== input.productId) ||
            (input.condition !== undefined && sellerProduct.condition !== input.condition) ||
            (input.packageQuantity !== undefined && sellerProduct.packageQuantity !== input.packageQuantity) ||
            (input.packageUnit !== undefined && sellerProduct.packageUnit !== input.packageUnit.trim().toUpperCase())
          )) {
            throw new ConflictException({
              code: 'SELLER_PRODUCT_LISTING_CONFLICT',
              message: 'This Seller Product is already listed, or its SKU, Article, condition, or packaging does not match.',
            });
          }
          if (sellerProduct && (input.openingQuantity ?? 0) > 0) {
            throw new BadRequestException({
              code: 'LISTING_OPENING_STOCK_ALREADY_EXISTS',
              message: 'Use inventory receipts to add stock to an existing Seller Product.',
            });
          }
          const productId = sellerProduct
            ? sellerProduct.id
            : (await transaction.sellerProduct.create({
                data: {
                  sellerId: seller.id,
                  productId: input.productId,
                  sku,
                  name: input.sellerProductName?.trim() || product.name,
                  condition: input.condition ?? null,
                  packageQuantity: input.packageQuantity ?? 1,
                  packageUnit: input.packageUnit?.trim().toUpperCase() || 'PIECE',
                  createdById: userId,
                  updatedById: userId,
                },
                select: { id: true },
              })).id;
          if (sellerProduct && !sellerProduct.productId) {
            await transaction.sellerProduct.update({
              where: { id: productId },
              data: { productId: input.productId, updatedById: userId },
            });
          }
          const listing = await transaction.sellerListing.create({
            data: {
              sellerId: seller.id,
              sellerProductId: productId,
              productId: input.productId,
              sellerSku: sku,
              condition: input.condition ?? null,
              sellerTitle: input.sellerTitle?.trim() || null,
              sellerDescription: input.sellerDescription?.trim() || null,
              warrantyInformation: input.warrantyInformation?.trim() || null,
              deliveryInformation: input.deliveryInformation?.trim() || null,
              commercialTerms: input.commercialTerms?.trim() || null,
              commercialDetails: details as Prisma.InputJsonObject,
              status: SellerListingStatus.DRAFT,
              createdById: userId,
              updatedById: userId,
            },
            select: { id: true },
          });
          await transaction.inventory.updateMany({
            where: { sellerProductId: productId, listingId: null },
            data: { listingId: listing.id },
          });
          for (const locationId of new Set([defaultLocation.id, chosenLocation.id])) {
            await transaction.inventory.upsert({
              where: { sellerProductId_locationId: { sellerProductId: productId, locationId } },
              create: {
                sellerProductId: productId,
                listingId: listing.id,
                locationId,
                updatedById: userId,
              },
              update: { listingId: listing.id },
            });
          }
          const openingQuantity = input.openingQuantity ?? 0;
          if (openingQuantity > 0) {
            const stock = await transaction.inventory.findUniqueOrThrow({
              where: {
                sellerProductId_locationId: {
                  sellerProductId: productId,
                  locationId: chosenLocation.id,
                },
              },
              select: { id: true },
            });
            await transaction.inventory.update({
              where: { id: stock.id },
              data: {
                quantityOnHand: openingQuantity,
                availabilityStatus: InventoryAvailabilityStatus.IN_STOCK,
                version: { increment: 1 },
                updatedById: userId,
              },
            });
            await transaction.inventoryMovement.create({
              data: {
                inventoryId: stock.id,
                type: InventoryMovementType.RECEIPT,
                quantityDelta: openingQuantity,
                quantityBefore: 0,
                quantityAfter: openingQuantity,
                reason: 'Opening stock from Listing First',
                actorId: userId,
              },
            });
          }
          if (price) {
            await transaction.listingPrice.create({
              data: {
                listingId: listing.id,
                basePrice: price.basePrice,
                sellingPrice: price.sellingPrice,
                promotionalPrice: price.promotionalPrice,
                currency: price.currency,
                minOrderQuantity: price.minOrderQuantity,
                status: MasterDataStatus.ACTIVE,
              },
            });
          }
          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: 'SELLER_LISTING_CREATED',
              entityType: 'SellerListing',
              entityId: listing.id,
              metadata: {
                sellerId: seller.id,
                productId: input.productId,
                sellerSku: input.sellerSku.trim(),
              },
            },
          });
          return listing.id;
        };
      const listingId = outerTransaction
        ? await persist(outerTransaction)
        : await this.database.$transaction(persist, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
      return outerTransaction ? listingId : this.getOwned(listingId, seller.id);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateForSellerUser(
    id: string,
    input: UpdateSellerListingDto,
    userId: string,
  ): Promise<SellerListingResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const existing = await this.database.sellerListing.findFirst({
      where: { id, sellerId: seller.id },
      select: {
        id: true,
        version: true,
        status: true,
        sellerSku: true,
        condition: true,
        warrantyInformation: true,
        commercialDetails: true,
        product: {
          select: {
            schemaVersion: { select: { snapshot: true } },
            productType: { select: { packageDimensionsRequirement: true, packageWeightRequirement: true, discountRequirement: true, transportRequirement: true, specialHandlingRequirement: true } },
          },
        },
      },
    });
    if (!existing) throw this.notFound();
    if (existing.version !== input.version) throw this.versionConflict();
    // Approved Listing content is immutable until a reviewed-revision workflow
    // can preserve the published version while Admin reviews proposed edits.
    // Price-only updates use updatePriceForSellerUser and remain immediate.
    const editableStatuses: SellerListingStatus[] = [
      SellerListingStatus.DRAFT,
      SellerListingStatus.REJECTED,
    ];
    if (!editableStatuses.includes(existing.status)) {
      throw new ConflictException({
        code: 'LISTING_EDIT_STATE_INVALID',
        message: 'This Listing cannot be edited in its current state.',
      });
    }
    // A published Listing must never silently switch to a different physical SKU.
    if (input.sellerSku !== undefined && input.sellerSku.trim().toUpperCase() !== existing.sellerSku.toUpperCase()) {
      throw new BadRequestException({
        code: 'LISTING_SKU_IMMUTABLE',
        message: 'Create a new Seller Product and Listing to sell a different SKU.',
      });
    }
    if (
      input.condition !== undefined &&
      input.condition !== existing.condition
    ) {
      throw new BadRequestException({
        code: 'LISTING_CONDITION_IMMUTABLE',
        message: 'A different physical condition requires a new Seller Product.',
      });
    }

    const requirements = this.parseOfferRequirements(
      existing.product.schemaVersion.snapshot,
    );
    const updatedCommercial = input.commercialDetails === undefined ? undefined
      : validateSellerCommercialDetails(input.commercialDetails,
          existing.product.productType
            ? commercialPolicyForProductType(existing.product.productType) : DEFAULT_COMMERCIAL_POLICY,
          false);
    this.assertOfferFieldsApplicable({
      requirements,
      condition:
        input.condition === undefined ? existing.condition : input.condition,
      warrantyInformation:
        input.warrantyInformation === undefined
          ? existing.warrantyInformation
          : input.warrantyInformation?.trim() || null,
      hasPrice: false,
      inventoryCount: 0,
      checkOnlySupplied: {
        condition: input.condition !== undefined,
        warranty: input.warrantyInformation !== undefined,
      },
    });

    try {
      await this.database.$transaction(
        async (transaction) => {
          const result = await transaction.sellerListing.updateMany({
            where: { id, sellerId: seller.id, version: input.version },
            data: {
              // Seller SKU is immutable after creation; stock uses this identity.
              ...(input.condition !== undefined
                ? { condition: input.condition }
                : {}),
              ...(input.sellerTitle !== undefined
                ? { sellerTitle: input.sellerTitle?.trim() || null }
                : {}),
              ...(input.sellerDescription !== undefined
                ? {
                    sellerDescription:
                      input.sellerDescription?.trim() || null,
                  }
                : {}),
              ...(input.warrantyInformation !== undefined
                ? {
                    warrantyInformation:
                      input.warrantyInformation?.trim() || null,
                  }
                : {}),
              ...(input.deliveryInformation !== undefined
                ? {
                    deliveryInformation:
                      input.deliveryInformation?.trim() || null,
                  }
                : {}),
              ...(input.commercialTerms !== undefined
                ? { commercialTerms: input.commercialTerms?.trim() || null }
                : {}),
              ...(updatedCommercial !== undefined
                ? { commercialDetails: updatedCommercial as Prisma.InputJsonObject } : {}),
              status: existing.status === SellerListingStatus.REJECTED
                ? SellerListingStatus.DRAFT : existing.status,
              rejectionReason: existing.status === SellerListingStatus.REJECTED ? null : undefined,
              version: { increment: 1 },
              updatedById: userId,
            },
          });
          if (result.count !== 1) throw this.versionConflict();
          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: 'SELLER_LISTING_UPDATED',
              entityType: 'SellerListing',
              entityId: id,
              metadata: {
                previousVersion: input.version,
                nextVersion: input.version + 1,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getOwned(id, seller.id);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updatePriceForSellerUser(
    id: string,
    input: UpdateListingPriceDto,
    userId: string,
  ): Promise<SellerListingResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const existing = await this.database.sellerListing.findFirst({
      where: { id, sellerId: seller.id },
      select: {
        id: true,
        version: true,
        status: true,
        commercialDetails: true,
        product: {
          select: {
            schemaVersion: { select: { snapshot: true } },
            productType: { select: { packageDimensionsRequirement: true, packageWeightRequirement: true, discountRequirement: true, transportRequirement: true, specialHandlingRequirement: true } },
          },
        },
        price: {
          select: {
            id: true,
            version: true,
            basePrice: true,
            sellingPrice: true,
            promotionalPrice: true,
            currency: true,
            minOrderQuantity: true,
          },
        },
      },
    });
    if (!existing) throw this.notFound();
    if (existing.version !== input.listingVersion) throw this.versionConflict();

    const requirements = this.parseOfferRequirements(
      existing.product.schemaVersion.snapshot,
    );
    if (requirements.price === ProductTypeRequirementLevel.NOT_APPLICABLE) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow Seller pricing for this Offer.',
      });
    }

    const priceBlockedStatuses: SellerListingStatus[] = [
      SellerListingStatus.SUSPENDED,
      SellerListingStatus.INACTIVE,
      SellerListingStatus.ARCHIVED,
    ];
    if (priceBlockedStatuses.includes(existing.status)) {
      throw new ConflictException({
        code: 'LISTING_PRICE_STATE_INVALID',
        message: 'Price cannot be changed in the current listing state',
      });
    }

    if (
      existing.price &&
      (input.priceVersion === undefined ||
        existing.price.version !== input.priceVersion)
    ) {
      throw new ConflictException({
        code: 'LISTING_PRICE_VERSION_CONFLICT',
        message: 'Listing price changed since it was loaded',
      });
    }
    if (!existing.price && input.priceVersion !== undefined) {
      throw new ConflictException({
        code: 'LISTING_PRICE_VERSION_CONFLICT',
        message:
          'This Listing does not have a price yet; omit priceVersion when adding the first price',
      });
    }

    if (
      !existing.price &&
      (input.basePrice === undefined ||
        input.sellingPrice === undefined ||
        input.currency === undefined)
    ) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_INCOMPLETE',
        message:
          'Adding the first Seller price requires basePrice, sellingPrice, and currency',
      });
    }

    const basePrice =
      input.basePrice ??
      (existing.price ? Number(existing.price.basePrice) : 0);
    const sellingPrice =
      input.sellingPrice ??
      (existing.price ? Number(existing.price.sellingPrice) : 0);
    const storedDetails = validateSellerCommercialDetails(existing.commercialDetails,
      existing.product.productType ? commercialPolicyForProductType(existing.product.productType)
        : DEFAULT_COMMERCIAL_POLICY, false, sellingPrice);
    if (storedDetails.discountType && input.promotionalPrice !== undefined) {
      throw new BadRequestException('Remove the listing discount before setting a direct promotional price.');
    }
    const promotionalPrice = storedDetails.discountType
      ? discountPrice(sellingPrice, storedDetails)
      : input.promotionalPrice !== undefined
        ? input.promotionalPrice
        : existing.price?.promotionalPrice === null ||
            existing.price?.promotionalPrice === undefined
          ? null
          : Number(existing.price.promotionalPrice);
    const currency =
      input.currency?.trim().toUpperCase() ??
      existing.price?.currency ??
      '';
    const minOrderQuantity =
      input.minOrderQuantity ?? existing.price?.minOrderQuantity ?? 1;

    this.validatePrice({ basePrice, sellingPrice, promotionalPrice });

    try {
      await this.database.$transaction(
        async (transaction) => {
          if (existing.price) {
            const priceResult = await transaction.listingPrice.updateMany({
              where: {
                id: existing.price.id,
                version: input.priceVersion!,
              },
              data: {
                ...(input.basePrice !== undefined
                  ? { basePrice: input.basePrice }
                  : {}),
                ...(input.sellingPrice !== undefined
                  ? { sellingPrice: input.sellingPrice }
                  : {}),
                ...(input.promotionalPrice !== undefined || storedDetails.discountType
                  ? { promotionalPrice }
                  : {}),
                ...(input.currency !== undefined
                  ? { currency }
                  : {}),
                ...(input.minOrderQuantity !== undefined
                  ? { minOrderQuantity: input.minOrderQuantity }
                  : {}),
                version: { increment: 1 },
              },
            });
            if (priceResult.count !== 1) {
              throw new ConflictException({
                code: 'LISTING_PRICE_VERSION_CONFLICT',
                message: 'Listing price changed since it was loaded',
              });
            }
          } else {
            await transaction.listingPrice.create({
              data: {
                listingId: id,
                basePrice,
                sellingPrice,
                promotionalPrice,
                currency,
                minOrderQuantity,
                status: MasterDataStatus.ACTIVE,
              },
            });
          }

          const listingResult = await transaction.sellerListing.updateMany({
            where: {
              id,
              sellerId: seller.id,
              version: input.listingVersion,
            },
            data: {
              version: { increment: 1 },
              updatedById: userId,
            },
          });
          if (listingResult.count !== 1) throw this.versionConflict();

          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: existing.price
                ? 'SELLER_LISTING_PRICE_UPDATED'
                : 'SELLER_LISTING_PRICE_CREATED',
              entityType: 'SellerListing',
              entityId: id,
              metadata: {
                basePrice,
                sellingPrice,
                promotionalPrice,
                currency,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.getOwned(id, seller.id);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  /**
   * Completes the Seller's Create Listing action. Incomplete Listings remain
   * private Drafts; no separate Submit for Review click is required.
   * A validated Listing linked to a pending Article records its review intent
   * and is submitted automatically after Article activation.
   */
  async finishCreationForSellerUser(
    id: string, userId: string,
  ): Promise<SellerListingResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const existing = await this.database.sellerListing.findFirst({
      where: { id, sellerId: seller.id },
      select: {
        id: true, version: true, status: true, reviewIntent: true,
        productId: true, condition: true, warrantyInformation: true,
        commercialDetails: true,
        price: { select: { sellingPrice: true } },
        inventories: { select: { id: true } },
      },
    });
    if (!existing) throw this.notFound();
    if (existing.status === SellerListingStatus.SUBMITTED) return this.getOwned(id, seller.id);
    if (existing.status !== SellerListingStatus.DRAFT &&
        existing.status !== SellerListingStatus.REJECTED) {
      throw new ConflictException('Only a Draft or Rejected Listing can be finalized.');
    }

    const product = await this.database.product.findUnique({
      where: { id: existing.productId },
      select: {
        status: true, sourceSellerId: true, articleSource: true,
        schemaVersion: { select: { snapshot: true } },
            productType: { select: { packageDimensionsRequirement: true, packageWeightRequirement: true, discountRequirement: true, transportRequirement: true, specialHandlingRequirement: true } },
      },
    });
    if (!product || !(product.status === ProductStatus.ACTIVE ||
       (product.status === ProductStatus.DRAFT &&
        product.sourceSellerId === seller.id &&
        product.articleSource === ArticleSource.SELLER_SUBMISSION))) {
      throw new ConflictException('This Listing requires an eligible canonical Article.');
    }
    this.assertOfferRequirements({
      snapshot: product.schemaVersion.snapshot,
      condition: existing.condition,
      warrantyInformation: existing.warrantyInformation,
      price: existing.price,
      inventoryCount: existing.inventories.length,
    });
    validateSellerCommercialDetails(existing.commercialDetails,
      product.productType ? commercialPolicyForProductType(product.productType) : DEFAULT_COMMERCIAL_POLICY,
      true, existing.price ? Number(existing.price.sellingPrice) : null);
    await assertSellerListingMediaReady(this.database, id);

    if (!existing.reviewIntent) {
      await this.database.$transaction(async tx => {
        const updated = await tx.sellerListing.updateMany({
          where: { id, sellerId: seller.id, version: existing.version,
            status: { in: [SellerListingStatus.DRAFT, SellerListingStatus.REJECTED] } },
          data: { reviewIntent: true, version: { increment: 1 }, updatedById: userId },
        });
        if (updated.count !== 1) throw this.versionConflict();
        await tx.auditLog.create({ data: {
          actorId: userId, action: 'SELLER_LISTING_CREATION_FINISHED',
          entityType: 'SellerListing', entityId: id,
          metadata: { awaitingArticleApproval: product.status !== ProductStatus.ACTIVE },
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    if (product.status === ProductStatus.ACTIVE) {
      const latest = await this.getOwned(id, seller.id);
      return this.submitForSellerUser(id, { version: latest.version }, userId);
    }
    return this.getOwned(id, seller.id);
  }

  async submitForSellerUser(
    id: string,
    input: ListingTransitionDto,
    userId: string,
  ): Promise<SellerListingResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const existing = await this.database.sellerListing.findFirst({
      where: { id, sellerId: seller.id },
      select: {
        id: true,
        productId: true,
        version: true,
        status: true,
        condition: true,
        warrantyInformation: true,
        commercialDetails: true,
        price: { select: { sellingPrice: true } },
        inventories: { select: { id: true } },
      },
    });
    if (!existing) throw this.notFound();
    if (existing.version !== input.version) throw this.versionConflict();
    if (
      existing.status !== SellerListingStatus.DRAFT &&
      existing.status !== SellerListingStatus.REJECTED
    ) {
      throw new ConflictException({
        code: 'LISTING_SUBMIT_STATE_INVALID',
        message: 'Only DRAFT or REJECTED listings can be submitted',
      });
    }
    const product = await this.database.product.findFirst({
      where: { id: existing.productId, status: ProductStatus.ACTIVE },
      select: {
        id: true,
        schemaVersion: { select: { snapshot: true } },
            productType: { select: { packageDimensionsRequirement: true, packageWeightRequirement: true, discountRequirement: true, transportRequirement: true, specialHandlingRequirement: true } },
      },
    });
    if (!product) {
      throw new ConflictException({
        code: 'LISTING_PRODUCT_NOT_ACTIVE',
        message:
          'The Manufacturer Article must complete catalog review and become Active before the Seller Offer can be submitted',
      });
    }

    this.assertOfferRequirements({
      snapshot: product.schemaVersion.snapshot,
      condition: existing.condition,
      warrantyInformation: existing.warrantyInformation,
      price: existing.price,
      inventoryCount: existing.inventories.length,
    });

    validateSellerCommercialDetails(existing.commercialDetails,
      product.productType ? commercialPolicyForProductType(product.productType) : DEFAULT_COMMERCIAL_POLICY,
      true, existing.price ? Number(existing.price.sellingPrice) : null);
    await assertSellerListingMediaReady(this.database, id);
    await this.transition(
      id,
      seller.id,
      input.version,
      SellerListingStatus.SUBMITTED,
      userId,
      'SELLER_LISTING_SUBMITTED',
      null,
    );
    return this.getOwned(id, seller.id);
  }

  async approveAdmin(
    id: string,
    input: ListingTransitionDto,
    actorId: string,
  ): Promise<SellerListingResponseDto> {
    const existing = await this.database.sellerListing.findUnique({
      where: { id },
      select: {
        id: true,
        version: true,
        status: true,
        productId: true,
        seller: {
          select: {
            status: true,
            approvalStatus: true,
            verificationStatus: true,
          },
        },
        condition: true,
        warrantyInformation: true,
        commercialDetails: true,
        price: { select: { sellingPrice: true } },
        inventories: {
          select: {
            quantityOnHand: true,
            quantityReserved: true,
            safetyStock: true,
            location: { select: { onlineFulfillmentEnabled: true, status: true } },
          },
        },
      },
    });
    if (!existing) throw this.notFound();
    if (existing.version !== input.version) throw this.versionConflict();
    if (existing.status !== SellerListingStatus.SUBMITTED) {
      throw new ConflictException({
        code: 'LISTING_APPROVE_STATE_INVALID',
        message: 'Only SUBMITTED listings can be approved',
      });
    }
    if (
      existing.seller.status !== SellerStatus.ACTIVE ||
      existing.seller.approvalStatus !== SellerApprovalStatus.APPROVED ||
      existing.seller.verificationStatus !== SellerVerificationStatus.VERIFIED
    ) {
      throw new ConflictException({
        code: 'LISTING_SELLER_NOT_OPERATIONAL',
        message: 'Listing Seller is not verified, approved, and ACTIVE',
      });
    }
    const product = await this.database.product.findFirst({
      where: { id: existing.productId, status: ProductStatus.ACTIVE },
      select: {
        id: true,
        schemaVersion: { select: { snapshot: true } },
            productType: { select: { packageDimensionsRequirement: true, packageWeightRequirement: true, discountRequirement: true, transportRequirement: true, specialHandlingRequirement: true } },
      },
    });
    if (!product) {
      throw new ConflictException({
        code: 'LISTING_PRODUCT_NOT_ACTIVE',
        message: 'Listing Manufacturer Article is not Active',
      });
    }

    const requirements = this.assertOfferRequirements({
      snapshot: product.schemaVersion.snapshot,
      condition: existing.condition,
      warrantyInformation: existing.warrantyInformation,
      price: existing.price,
      inventoryCount: existing.inventories.length,
    });

    validateSellerCommercialDetails(existing.commercialDetails,
      product.productType ? commercialPolicyForProductType(product.productType) : DEFAULT_COMMERCIAL_POLICY,
      true, existing.price ? Number(existing.price.sellingPrice) : null);
    await assertSellerListingMediaReady(this.database, id);

    const available = existing.inventories.reduce(
      (sum, row) => sum + (
        row.location.onlineFulfillmentEnabled &&
        row.location.status === MasterDataStatus.ACTIVE
          ? Math.max(0, row.quantityOnHand - row.quantityReserved - row.safetyStock)
          : 0
      ),
      0,
    );
    const tracksStock =
      requirements.stock !== ProductTypeRequirementLevel.NOT_APPLICABLE &&
      existing.inventories.length > 0;
    const nextStatus =
      tracksStock && available <= 0
        ? SellerListingStatus.OUT_OF_STOCK
        : SellerListingStatus.ACTIVE;

    await this.transition(
      id,
      null,
      input.version,
      nextStatus,
      actorId,
      'SELLER_LISTING_APPROVED',
      null,
      true,
    );
    return this.getAdmin(id);
  }

  async rejectAdmin(
    id: string,
    input: RejectListingDto,
    actorId: string,
  ): Promise<SellerListingResponseDto> {
    const existing = await this.database.sellerListing.findUnique({
      where: { id },
      select: { id: true, version: true, status: true },
    });
    if (!existing) throw this.notFound();
    if (existing.version !== input.version) throw this.versionConflict();
    if (existing.status !== SellerListingStatus.SUBMITTED) {
      throw new ConflictException({
        code: 'LISTING_REJECT_STATE_INVALID',
        message: 'Only SUBMITTED listings can be rejected',
      });
    }
    await this.transition(
      id,
      null,
      input.version,
      SellerListingStatus.REJECTED,
      actorId,
      'SELLER_LISTING_REJECTED',
      input.reason.trim(),
    );
    return this.getAdmin(id);
  }

  private async getOwned(
    id: string,
    sellerId: string,
  ): Promise<SellerListingResponseDto> {
    const record = await this.database.sellerListing.findFirst({
      where: { id, sellerId },
      select: listingSelect,
    });
    if (!record) throw this.notFound();
    return this.toResponse(record);
  }

  private async transition(
    id: string,
    sellerId: string | null,
    version: number,
    status: SellerListingStatus,
    actorId: string,
    action: string,
    rejectionReason: string | null,
    approved = false,
  ): Promise<void> {
    await this.database.$transaction(
      async (transaction) => {
        if (LIVE_SELLER_LISTING_STATUSES.includes(status)) {
          const current = await transaction.sellerListing.findFirst({
            where: {
              id,
              version,
              ...(sellerId ? { sellerId } : {}),
            },
            select: { productId: true },
          });
          if (!current) throw this.versionConflict();
          await assertArticleActiveForCommerce(
            transaction,
            current.productId,
            {
              code: 'LISTING_PRODUCT_NOT_ACTIVE',
              message:
                'A submitted or live Seller Listing requires an Active Manufacturer Article',
            },
          );
        }

        const result = await transaction.sellerListing.updateMany({
          where: {
            id,
            version,
            ...(sellerId ? { sellerId } : {}),
          },
          data: {
            status,
            rejectionReason,
            ...(status === SellerListingStatus.SUBMITTED ? { reviewIntent: true } : {}),
            ...(status === SellerListingStatus.REJECTED ? { reviewIntent: false } : {}),
            ...(approved ? { approvedAt: new Date() } : {}),
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (result.count !== 1) throw this.versionConflict();
        await transaction.auditLog.create({
          data: {
            actorId,
            action,
            entityType: 'SellerListing',
            entityId: id,
            metadata: {
              previousVersion: version,
              nextVersion: version + 1,
              status,
              rejectionReason,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private resolveCreatePrice(
    input: CreateSellerListingDto,
  ): {
    basePrice: number;
    sellingPrice: number;
    promotionalPrice: number | null;
    currency: string;
    minOrderQuantity: number;
  } | null {
    const hasPriceInput =
      input.basePrice !== undefined ||
      input.sellingPrice !== undefined ||
      input.promotionalPrice !== undefined ||
      input.currency !== undefined ||
      input.minOrderQuantity !== undefined;

    if (!hasPriceInput) return null;

    if (
      input.basePrice === undefined ||
      input.sellingPrice === undefined ||
      input.currency === undefined
    ) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_INCOMPLETE',
        message:
          'Seller pricing must include basePrice, sellingPrice, and currency when supplied',
      });
    }

    const price = {
      basePrice: input.basePrice,
      sellingPrice: input.sellingPrice,
      promotionalPrice: input.promotionalPrice ?? null,
      currency: input.currency.trim().toUpperCase(),
      minOrderQuantity: input.minOrderQuantity ?? 1,
    };
    this.validatePrice(price);
    return price;
  }

  private assertOfferFieldsApplicable(input: {
    requirements: OfferRequirements;
    condition: unknown;
    warrantyInformation: string | null;
    hasPrice: boolean;
    inventoryCount: number;
    checkOnlySupplied?: {
      condition?: boolean;
      warranty?: boolean;
      price?: boolean;
      stock?: boolean;
    };
  }): void {
    const check = input.checkOnlySupplied;
    if (
      (check?.price ?? true) &&
      input.requirements.price === ProductTypeRequirementLevel.NOT_APPLICABLE &&
      input.hasPrice
    ) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow Seller pricing for this Offer.',
      });
    }
    if (
      (check?.stock ?? true) &&
      input.requirements.stock === ProductTypeRequirementLevel.NOT_APPLICABLE &&
      input.inventoryCount > 0
    ) {
      throw new BadRequestException({
        code: 'LISTING_INVENTORY_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow inventory for this Offer.',
      });
    }
    if (
      (check?.condition ?? true) &&
      input.requirements.condition ===
        ProductTypeRequirementLevel.NOT_APPLICABLE &&
      input.condition != null
    ) {
      throw new BadRequestException({
        code: 'LISTING_CONDITION_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow Seller condition for this Offer.',
      });
    }
    if (
      (check?.warranty ?? true) &&
      input.requirements.warranty ===
        ProductTypeRequirementLevel.NOT_APPLICABLE &&
      Boolean(input.warrantyInformation?.trim())
    ) {
      throw new BadRequestException({
        code: 'LISTING_WARRANTY_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow warranty information for this Offer.',
      });
    }
  }

  private assertOfferRequirements(input: {
    snapshot: Prisma.JsonValue;
    condition: unknown;
    warrantyInformation: string | null;
    price: { sellingPrice: Prisma.Decimal } | null;
    inventoryCount: number;
  }): OfferRequirements {
    const requirements = this.parseOfferRequirements(input.snapshot);

    this.assertOfferFieldsApplicable({
      requirements,
      condition: input.condition,
      warrantyInformation: input.warrantyInformation,
      hasPrice: input.price !== null,
      inventoryCount: input.inventoryCount,
    });

    if (
      requirements.price === ProductTypeRequirementLevel.REQUIRED &&
      (!input.price || Number(input.price.sellingPrice) <= 0)
    ) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_REQUIRED',
        message:
          'The bound Product Type schema requires a valid Seller price before submission',
      });
    }

    if (
      requirements.stock === ProductTypeRequirementLevel.REQUIRED &&
      input.inventoryCount === 0
    ) {
      throw new BadRequestException({
        code: 'LISTING_INVENTORY_REQUIRED',
        message:
          'The bound Product Type schema requires Seller inventory before submission',
      });
    }

    if (
      requirements.condition === ProductTypeRequirementLevel.REQUIRED &&
      !input.condition
    ) {
      throw new BadRequestException({
        code: 'LISTING_CONDITION_REQUIRED',
        message:
          'The bound Product Type schema requires Seller condition before submission',
      });
    }

    if (
      requirements.warranty === ProductTypeRequirementLevel.REQUIRED &&
      !input.warrantyInformation?.trim()
    ) {
      throw new BadRequestException({
        code: 'LISTING_WARRANTY_REQUIRED',
        message:
          'The bound Product Type schema requires warranty information before submission',
      });
    }

    return requirements;
  }

  private parseOfferRequirements(snapshot: Prisma.JsonValue): OfferRequirements {
    const defaults: OfferRequirements = {
      price: ProductTypeRequirementLevel.REQUIRED,
      stock: ProductTypeRequirementLevel.REQUIRED,
      condition: ProductTypeRequirementLevel.REQUIRED,
      warranty: ProductTypeRequirementLevel.OPTIONAL,
    };

    if (!this.isRecord(snapshot)) return defaults;

    const current = this.isRecord(snapshot.offerRequirements)
      ? snapshot.offerRequirements
      : null;
    const legacyRequirements = this.isRecord(snapshot.requirements)
      ? snapshot.requirements
      : null;
    const legacyListing =
      legacyRequirements && this.isRecord(legacyRequirements.listing)
        ? legacyRequirements.listing
        : null;
    const source = current ?? legacyListing;
    if (!source) return defaults;

    return {
      price: this.requirementLevel(source.price, defaults.price),
      stock: this.requirementLevel(source.stock, defaults.stock),
      condition: this.requirementLevel(source.condition, defaults.condition),
      warranty: this.requirementLevel(source.warranty, defaults.warranty),
    };
  }

  private requirementLevel(
    value: unknown,
    fallback: ProductTypeRequirementLevel,
  ): ProductTypeRequirementLevel {
    return typeof value === 'string' &&
      Object.values(ProductTypeRequirementLevel).includes(
        value as ProductTypeRequirementLevel,
      )
      ? (value as ProductTypeRequirementLevel)
      : fallback;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private validatePrice(input: {
    basePrice: number;
    sellingPrice: number;
    promotionalPrice: number | null;
  }): void {
    if (input.basePrice < 0 || input.sellingPrice <= 0) {
      throw new BadRequestException({
        code: 'LISTING_PRICE_INVALID',
        message: 'Base price must be non-negative and selling price positive',
      });
    }
    if (
      input.promotionalPrice !== null &&
      (input.promotionalPrice <= 0 ||
        input.promotionalPrice > input.sellingPrice)
    ) {
      throw new BadRequestException({
        code: 'LISTING_PROMOTIONAL_PRICE_INVALID',
        message:
          'Promotional price must be positive and not exceed selling price',
      });
    }
  }

  private toResponse(record: ListingRecord): SellerListingResponseDto {
    const quantityOnHand = record.inventories.reduce(
      (sum, row) => sum + row.quantityOnHand,
      0,
    );
    const quantityReserved = record.inventories.reduce(
      (sum, row) => sum + row.quantityReserved,
      0,
    );
    const quantityAvailable = record.inventories.reduce(
      (sum, row) => sum + (
        row.location.onlineFulfillmentEnabled &&
        row.location.status === MasterDataStatus.ACTIVE
          ? Math.max(0, row.quantityOnHand - row.quantityReserved - row.safetyStock)
          : 0
      ),
      0,
    );

    return {
      id: record.id,
      sellerId: record.sellerId,
      productId: record.productId,
      sellerProductId: record.sellerProductId,
      sellerSku: record.sellerSku,
      condition: record.condition,
      sellerTitle: record.sellerTitle,
      reviewIntent: record.reviewIntent,
      sellerDescription: record.sellerDescription,
      warrantyInformation: record.warrantyInformation,
      deliveryInformation: record.deliveryInformation,
      commercialTerms: record.commercialTerms,
      commercialDetails: record.commercialDetails as unknown as SellerListingResponseDto['commercialDetails'],
      status: record.status,
      rejectionReason: record.rejectionReason,
      version: record.version,
      price: record.price
        ? {
            id: record.price.id,
            basePrice: Number(record.price.basePrice),
            sellingPrice: Number(record.price.sellingPrice),
            promotionalPrice:
              record.price.promotionalPrice === null
                ? null
                : Number(record.price.promotionalPrice),
            currency: record.price.currency,
            minOrderQuantity: record.price.minOrderQuantity,
            version: record.price.version,
          }
        : null,
      quantityOnHand,
      quantityReserved,
      quantityAvailable,
      approvedAt: record.approvedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'SELLER_LISTING_NOT_FOUND',
      message: 'Seller listing was not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'SELLER_LISTING_VERSION_CONFLICT',
      message: 'Seller listing changed since it was loaded',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'SELLER_LISTING_DUPLICATE',
        message: 'Seller SKU must be unique within the Seller account',
      });
    }
    throw error;
  }
}
