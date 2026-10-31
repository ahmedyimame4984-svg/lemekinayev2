import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryAvailabilityStatus,
  InventoryMovementType,
  MasterDataStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerService } from './seller.service.js';
import { InventoryService } from './inventory.service.js';
import type {
  CreateSellerProductDto,
  MoveSellerProductStockDto,
} from './dto/seller-product.dto.js';

const productDetails = {
  id: true,
  sellerId: true,
  productId: true,
  sku: true,
  name: true,
  condition: true,
  packageQuantity: true,
  packageUnit: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  listing: {
    select: {
      id: true,
      status: true,
      approvedAt: true,
      price: { select: { sellingPrice: true, currency: true } },
    },
  },
  inventories: {
    select: {
      id: true,
      locationId: true,
      quantityOnHand: true,
      quantityReserved: true,
      safetyStock: true,
      lowStockThreshold: true,
      version: true,
      location: {
        select: {
          name: true,
          isDefault: true,
          onlineFulfillmentEnabled: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.SellerProductSelect;

@Injectable()
export class SellerProductService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
    private readonly inventory: InventoryService,
  ) {}

  async list(userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const products = await this.database.sellerProduct.findMany({
      where: { sellerId: seller.id, status: { not: MasterDataStatus.ARCHIVED } },
      select: productDetails,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return products.map(this.summary);
  }

  async get(id: string, userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const product = await this.database.sellerProduct.findFirst({
      where: { id, sellerId: seller.id },
      select: productDetails,
    });
    if (!product) throw this.notFound();
    return this.summary(product);
  }

  async create(
    input: CreateSellerProductDto,
    userId: string,
  ): ReturnType<SellerProductService['get']>;
  async create(
    input: CreateSellerProductDto,
    userId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<string>;
  async create(
    input: CreateSellerProductDto,
    userId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const database = transaction ?? this.database;
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    if (!input.productId) {
      throw new BadRequestException({
        code: 'MANUFACTURER_ARTICLE_REQUIRED',
        message: 'Select an approved Manufacturer Article or your own Article Draft before adding Inventory.',
      });
    }
    const sku = input.sku?.trim().toUpperCase() ||
      `SKU-${randomBytes(5).toString('hex').toUpperCase()}`;
    const openingQuantity = input.openingQuantity ?? 0;
    const location = input.locationId
      ? await database.inventoryLocation.findFirst({
          where: { id: input.locationId, sellerId: seller.id, status: MasterDataStatus.ACTIVE },
          select: { id: true },
        })
      : null;
    if (input.locationId && !location) {
      throw new BadRequestException({ code: 'LOCATION_NOT_OWNED', message: 'Select an active Location owned by your Seller account.' });
    }
    const defaultLocation = await database.inventoryLocation.findFirst({
      where: { sellerId: seller.id, isDefault: true, status: MasterDataStatus.ACTIVE },
      select: { id: true },
    });
    if (!defaultLocation) {
      throw new ConflictException({
        code: 'DEFAULT_LOCATION_REQUIRED',
        message: 'Create a default Store or Warehouse before adding products.',
      });
    }
    if (openingQuantity > 0 && !location) {
      throw new BadRequestException({
        code: 'OPENING_STOCK_LOCATION_REQUIRED',
        message: 'Choose the Location receiving the opening stock.',
      });
    }

    let canonicalName: string;
    {
      const article = await database.product.findFirst({
        where: {
          id: input.productId,
          OR: [
            { status: ProductStatus.ACTIVE },
            { status: ProductStatus.DRAFT, sourceSellerId: seller.id },
          ],
        },
        select: { id: true, name: true },
      });
      if (!article) {
        throw new BadRequestException({
          code: 'MANUFACTURER_ARTICLE_UNAVAILABLE',
          message: 'Select an approved Article or your own Article draft.',
        });
      }
      canonicalName = article.name;
    }
    try {
      const persist = async (tx: Prisma.TransactionClient) => {
        const product = await tx.sellerProduct.create({
          data: {
            sellerId: seller.id,
            productId: input.productId,
            sku,
            name: canonicalName,
            condition: input.condition ?? null,
            packageQuantity: input.packageQuantity ?? 1,
            packageUnit: input.packageUnit?.trim().toUpperCase() || 'PIECE',
            createdById: userId,
            updatedById: userId,
          },
          select: { id: true },
        });
        await this.attachLocation(tx, product.id, defaultLocation.id, 0, userId);
        if (location && location.id !== defaultLocation.id) {
          await this.attachLocation(tx, product.id, location.id, openingQuantity, userId);
        } else if (location && openingQuantity > 0) {
          const stock = await tx.inventory.findUniqueOrThrow({
            where: { sellerProductId_locationId: { sellerProductId: product.id, locationId: location.id } },
            select: { id: true },
          });
          await tx.inventory.update({
            where: { id: stock.id },
            data: {
              quantityOnHand: openingQuantity,
              availabilityStatus: InventoryAvailabilityStatus.IN_STOCK,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: stock.id,
              type: InventoryMovementType.RECEIPT,
              quantityDelta: openingQuantity,
              quantityBefore: 0,
              quantityAfter: openingQuantity,
              reason: 'Opening stock',
              actorId: userId,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'SELLER_PRODUCT_CREATED',
            entityType: 'SellerProduct',
            entityId: product.id,
            metadata: { sku, productId: input.productId, defaultLocationId: defaultLocation.id },
          },
        });
        return product.id;
      };
      const id = transaction
        ? await persist(transaction)
        : await this.database.$transaction(persist, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });
      return transaction ? id : this.get(id, userId);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async addLocation(productId: string, locationId: string, userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const [product, location] = await Promise.all([
      this.database.sellerProduct.findFirst({
        where: { id: productId, sellerId: seller.id },
        select: { id: true, listing: { select: { id: true } } },
      }),
      this.database.inventoryLocation.findFirst({
        where: { id: locationId, sellerId: seller.id, status: MasterDataStatus.ACTIVE },
        select: { id: true },
      }),
    ]);
    if (!product || !location) throw this.notFound();
    await this.database.inventory.upsert({
      where: { sellerProductId_locationId: { sellerProductId: productId, locationId } },
      create: {
        sellerProductId: productId,
        locationId,
        listingId: product.listing?.id ?? null,
        updatedById: userId,
      },
      update: {},
    });
    if (product.listing) await this.inventory.syncListingAvailability(product.listing.id, userId);
    return this.get(productId, userId);
  }

  async adjustStock(productId: string, input: MoveSellerProductStockDto, userId: string) {
    if (input.delta === 0) {
      throw new BadRequestException({ code: 'STOCK_DELTA_ZERO', message: 'Stock adjustment must change quantity.' });
    }
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const stock = await this.database.inventory.findFirst({
      where: {
        sellerProductId: productId,
        locationId: input.locationId,
        sellerProduct: { sellerId: seller.id },
        location: { sellerId: seller.id },
      },
      select: {
        id: true, version: true, quantityOnHand: true, quantityReserved: true,
        safetyStock: true, lowStockThreshold: true, listingId: true,
      },
    });
    if (!stock) throw this.notFound();
    if (stock.version !== input.version) throw this.conflict();
    const next = stock.quantityOnHand + input.delta;
    if (next < stock.quantityReserved || next < 0) {
      throw new ConflictException({
        code: 'STOCK_BELOW_RESERVATIONS',
        message: 'Stock cannot fall below reserved quantity or zero.',
      });
    }
    const available = Math.max(0, next - stock.quantityReserved - stock.safetyStock);
    const availabilityStatus = available === 0
      ? InventoryAvailabilityStatus.OUT_OF_STOCK
      : available <= stock.lowStockThreshold
        ? InventoryAvailabilityStatus.LOW_STOCK
        : InventoryAvailabilityStatus.IN_STOCK;
    await this.database.$transaction(async (tx) => {
      const claimed = await tx.inventory.updateMany({
        where: { id: stock.id, version: input.version, quantityOnHand: stock.quantityOnHand },
        data: { quantityOnHand: next, availabilityStatus, version: { increment: 1 }, updatedById: userId },
      });
      if (claimed.count !== 1) throw this.conflict();
      await tx.inventoryMovement.create({
        data: {
          inventoryId: stock.id,
          type: input.delta > 0 ? InventoryMovementType.RECEIPT : InventoryMovementType.ADJUSTMENT,
          quantityDelta: input.delta,
          quantityBefore: stock.quantityOnHand,
          quantityAfter: next,
          reservedBefore: stock.quantityReserved,
          reservedAfter: stock.quantityReserved,
          reason: input.reason.trim(),
          actorId: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'SELLER_PRODUCT_STOCK_ADJUSTED',
          entityType: 'Inventory',
          entityId: stock.id,
          metadata: { sellerProductId: productId, locationId: input.locationId, delta: input.delta },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (stock.listingId) await this.inventory.syncListingAvailability(stock.listingId, userId);
    return this.get(productId, userId);
  }

  private async attachLocation(
    tx: Prisma.TransactionClient,
    sellerProductId: string,
    locationId: string,
    openingQuantity: number,
    actorId: string,
  ) {
    const stock = await tx.inventory.create({
      data: {
        sellerProductId,
        locationId,
        listingId: null,
        quantityOnHand: openingQuantity,
        quantityReserved: 0,
        availabilityStatus: openingQuantity > 0
          ? InventoryAvailabilityStatus.IN_STOCK : InventoryAvailabilityStatus.OUT_OF_STOCK,
        updatedById: actorId,
      },
      select: { id: true },
    });
    if (openingQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          inventoryId: stock.id,
          type: InventoryMovementType.RECEIPT,
          quantityDelta: openingQuantity,
          quantityBefore: 0,
          quantityAfter: openingQuantity,
          reason: 'Opening stock',
          actorId,
        },
      });
    }
  }

  private summary(product: Prisma.SellerProductGetPayload<{ select: typeof productDetails }>) {
    const inventories = product.inventories.map(row => ({
      ...row,
      quantityAvailable: Math.max(0, row.quantityOnHand - row.quantityReserved - row.safetyStock),
    }));
    return {
      ...product,
      inventories,
      totalOnHand: inventories.reduce((sum, row) => sum + row.quantityOnHand, 0),
      onlineAvailable: inventories.reduce((sum, row) => sum +
        (row.location.status === MasterDataStatus.ACTIVE &&
        row.location.onlineFulfillmentEnabled ? row.quantityAvailable : 0), 0),
      listing: product.listing
        ? {
            ...product.listing,
            price: product.listing.price
              ? { currency: product.listing.price.currency, sellingPrice: Number(product.listing.price.sellingPrice) }
              : null,
          }
        : null,
    };
  }

  private notFound() {
    return new NotFoundException({
      code: 'SELLER_PRODUCT_NOT_FOUND',
      message: 'Seller Product or Location was not found.',
    });
  }

  private conflict() {
    return new ConflictException({
      code: 'SELLER_STOCK_VERSION_CONFLICT',
      message: 'Stock changed since it was loaded. Refresh and retry.',
    });
  }

  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')) {
      throw new ConflictException({
        code: 'SELLER_PRODUCT_CONFLICT',
        message: 'The SKU already exists or stock changed during this request.',
      });
    }
    throw error;
  }
}
