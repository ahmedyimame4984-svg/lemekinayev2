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
  ProductTypeRequirementLevel,
  SellerListingStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { isArticleActiveForCommerce } from '../product/article-commerce-boundary.js';
import type {
  AdjustInventoryDto,
  CreateInventoryDto,
  CreateInventoryLocationDto,
  InventoryLocationResponseDto,
  InventoryResponseDto,
} from './dto/listing.dto.js';
import { SellerService } from './seller.service.js';
import type { ChangeSellerLocationDto } from './dto/seller-product.dto.js';

const inventorySelect = {
  id: true,
  listingId: true,
  locationId: true,
  quantityOnHand: true,
  quantityReserved: true,
  safetyStock: true,
  lowStockThreshold: true,
  availabilityStatus: true,
  version: true,
  updatedAt: true,
} satisfies Prisma.InventorySelect;

type InventoryRecord = Prisma.InventoryGetPayload<{
  select: typeof inventorySelect;
}>;

@Injectable()
export class InventoryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
  ) {}

  async listLocationsForSellerUser(
    userId: string,
  ): Promise<InventoryLocationResponseDto[]> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const records = await this.database.inventoryLocation.findMany({
      where: { sellerId: seller.id },
      select: {
        id: true,
        sellerId: true,
        code: true,
        name: true,
        type: true,
        addressText: true,
        isDefault: true,
        onlineFulfillmentEnabled: true,
        version: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return records;
  }

  async createLocationForSellerUser(
    input: CreateInventoryLocationDto,
    userId: string,
  ): Promise<InventoryLocationResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    try {
      const record = await this.database.$transaction(
        async (transaction) => {
          const hasDefault = await transaction.inventoryLocation.findFirst({
            where: { sellerId: seller.id, isDefault: true },
            select: { id: true },
          });
          if (input.isDefault && hasDefault) {
            await transaction.inventoryLocation.update({
              where: { id: hasDefault.id },
              data: { isDefault: false },
            });
          }
          const location = await transaction.inventoryLocation.create({
            data: {
              sellerId: seller.id,
              code: input.code.trim().toUpperCase(),
              name: input.name.trim(),
              type: input.type,
              addressText: input.addressText?.trim() || null,
              isDefault: !hasDefault || input.isDefault === true,
              onlineFulfillmentEnabled: input.onlineFulfillmentEnabled ?? false,
              status: MasterDataStatus.ACTIVE,
              createdById: userId,
              updatedById: userId,
            },
            select: {
              id: true,
              sellerId: true,
              code: true,
              name: true,
              type: true,
              addressText: true,
              isDefault: true,
              onlineFulfillmentEnabled: true,
              version: true,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: 'INVENTORY_LOCATION_CREATED',
              entityType: 'InventoryLocation',
              entityId: location.id,
              metadata: {
                sellerId: seller.id,
                code: location.code,
                type: location.type,
              },
            },
          });
          return location;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return record;
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateLocationForSellerUser(
    id: string,
    input: ChangeSellerLocationDto,
    userId: string,
  ): Promise<InventoryLocationResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const location = await this.database.inventoryLocation.findFirst({
      where: { id, sellerId: seller.id, status: MasterDataStatus.ACTIVE },
      select: { id: true, version: true, isDefault: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location.version !== input.version) throw this.versionConflict();

    await this.database.$transaction(async tx => {
      if (input.isDefault === true && !location.isDefault) {
        await tx.inventoryLocation.updateMany({
          where: { sellerId: seller.id, isDefault: true },
          data: { isDefault: false, version: { increment: 1 } },
        });
      }
      const changed = await tx.inventoryLocation.updateMany({
        where: { id, sellerId: seller.id, version: input.version },
        data: {
          ...(input.isDefault === true ? { isDefault: true } : {}),
          ...(input.onlineFulfillmentEnabled === undefined
            ? {} : { onlineFulfillmentEnabled: input.onlineFulfillmentEnabled }),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw this.versionConflict();
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'SELLER_LOCATION_UPDATED',
          entityType: 'InventoryLocation',
          entityId: id,
          metadata: {
            sellerId: seller.id,
            onlineFulfillmentEnabled: input.onlineFulfillmentEnabled ?? null,
            makeDefault: input.isDefault ?? false,
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (input.onlineFulfillmentEnabled !== undefined) {
      const stocks = await this.database.inventory.findMany({
        where: { locationId: id, listingId: { not: null } },
        select: { listingId: true },
      });
      for (const listingId of new Set(stocks.flatMap(stock => stock.listingId ? [stock.listingId] : []))) {
        await this.syncListingAvailability(listingId, userId);
      }
    }

    return this.database.inventoryLocation.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, sellerId: true, code: true, name: true, type: true,
        addressText: true, isDefault: true, onlineFulfillmentEnabled: true, version: true,
      },
    });
  }

  async listForSellerUser(
    listingId: string,
    userId: string,
  ): Promise<InventoryResponseDto[]> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    await this.requireOwnedListing(listingId, seller.id);
    const records = await this.database.inventory.findMany({
      where: { listingId },
      select: inventorySelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return records.map((record) => this.toResponse(record));
  }

  async createForSellerUser(
    listingId: string,
    input: CreateInventoryDto,
    userId: string,
  ): Promise<InventoryResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const listing = await this.requireOwnedListing(listingId, seller.id);
    this.assertStockApplicable(listing.product.schemaVersion.snapshot);

    if (!listing.sellerProductId) throw new ConflictException('Seller Product is missing');
    const location = await this.database.inventoryLocation.findFirst({
      where: {
        id: input.locationId,
        sellerId: seller.id,
        status: MasterDataStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException({
        code: 'INVENTORY_LOCATION_INVALID',
        message: 'Inventory location must be an ACTIVE location owned by the Seller',
      });
    }

    const quantityOnHand = input.quantityOnHand ?? 0;
    const safetyStock = input.safetyStock ?? 0;
    const lowStockThreshold = input.lowStockThreshold ?? 0;
    const status = this.calculateAvailability(
      quantityOnHand,
      0,
      safetyStock,
      lowStockThreshold,
    );

    try {
      const inventoryId = await this.database.$transaction(
        async (transaction) => {
          const inventory = await transaction.inventory.create({
            data: {
              listingId,
              sellerProductId: listing.sellerProductId!,
              locationId: input.locationId,
              quantityOnHand,
              quantityReserved: 0,
              safetyStock,
              lowStockThreshold,
              availabilityStatus: status,
              updatedById: userId,
            },
            select: { id: true },
          });

          if (quantityOnHand > 0) {
            await transaction.inventoryMovement.create({
              data: {
                inventoryId: inventory.id,
                type: InventoryMovementType.RECEIPT,
                quantityDelta: quantityOnHand,
                quantityBefore: 0,
                quantityAfter: quantityOnHand,
                reason: 'Initial inventory quantity',
                actorId: userId,
              },
            });
          }

          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: 'SELLER_INVENTORY_CREATED',
              entityType: 'Inventory',
              entityId: inventory.id,
              metadata: {
                sellerId: seller.id,
                listingId,
                locationId: input.locationId,
                quantityOnHand,
                safetyStock,
                lowStockThreshold,
              },
            },
          });

          return inventory.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.syncListingAvailability(listingId, userId);
      return this.getOwnedInventory(inventoryId, listingId);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async adjustForSellerUser(
    listingId: string,
    inventoryId: string,
    input: AdjustInventoryDto,
    userId: string,
  ): Promise<InventoryResponseDto> {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const listing = await this.requireOwnedListing(listingId, seller.id);
    this.assertStockApplicable(listing.product.schemaVersion.snapshot);

    if (
      input.movementType === InventoryMovementType.RESERVATION ||
      input.movementType === InventoryMovementType.RELEASE ||
      input.movementType === InventoryMovementType.SALE
    ) {
      throw new BadRequestException({
        code: 'INVENTORY_MOVEMENT_TYPE_RESERVED',
        message:
          'Reservation, release, and sale movements are controlled by transaction workflows',
      });
    }
    if (input.delta === 0) {
      throw new BadRequestException({
        code: 'INVENTORY_ADJUSTMENT_ZERO',
        message: 'Inventory adjustment delta must not be zero',
      });
    }

    const existing = await this.database.inventory.findFirst({
      where: { id: inventoryId, listingId },
      select: inventorySelect,
    });
    if (!existing) throw this.inventoryNotFound();
    if (existing.version !== input.version) throw this.versionConflict();

    const nextOnHand = existing.quantityOnHand + input.delta;
    if (nextOnHand < 0) {
      throw new BadRequestException({
        code: 'INVENTORY_NEGATIVE_NOT_ALLOWED',
        message: 'Inventory quantity cannot become negative',
      });
    }
    if (nextOnHand < existing.quantityReserved) {
      throw new BadRequestException({
        code: 'INVENTORY_RESERVED_EXCEEDS_STOCK',
        message: 'On-hand quantity cannot be lower than reserved quantity',
      });
    }

    const nextStatus = this.calculateAvailability(
      nextOnHand,
      existing.quantityReserved,
      existing.safetyStock,
      existing.lowStockThreshold,
    );

    try {
      await this.database.$transaction(
        async (transaction) => {
          const result = await transaction.inventory.updateMany({
            where: {
              id: inventoryId,
              listingId,
              version: input.version,
            },
            data: {
              quantityOnHand: nextOnHand,
              availabilityStatus: nextStatus,
              version: { increment: 1 },
              updatedById: userId,
            },
          });
          if (result.count !== 1) throw this.versionConflict();

          await transaction.inventoryMovement.create({
            data: {
              inventoryId,
              type: input.movementType,
              quantityDelta: input.delta,
              quantityBefore: existing.quantityOnHand,
              quantityAfter: nextOnHand,
              reason: input.reason.trim(),
              referenceType: input.referenceType?.trim() || null,
              referenceId: input.referenceId?.trim() || null,
              actorId: userId,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: 'SELLER_INVENTORY_ADJUSTED',
              entityType: 'Inventory',
              entityId: inventoryId,
              metadata: {
                sellerId: seller.id,
                listingId,
                movementType: input.movementType,
                quantityDelta: input.delta,
                quantityBefore: existing.quantityOnHand,
                quantityAfter: nextOnHand,
                reason: input.reason.trim(),
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.syncListingAvailability(listingId, userId);
      return this.getOwnedInventory(inventoryId, listingId);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async reserveForSystem(
    inventoryId: string,
    quantity: number,
    actorId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<InventoryResponseDto> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException({
        code: 'INVENTORY_RESERVATION_QUANTITY_INVALID',
        message: 'Reservation quantity must be a positive integer',
      });
    }

    const existing = await this.database.inventory.findUnique({
      where: { id: inventoryId },
      select: inventorySelect,
    });
    if (!existing) throw this.inventoryNotFound();
    const eligible = await this.database.inventory.findFirst({
      where: {
        id: inventoryId,
        listingId: { not: null },
        location: {
          status: MasterDataStatus.ACTIVE,
          onlineFulfillmentEnabled: true,
        },
        listing: { status: SellerListingStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!eligible || !existing.listingId) {
      throw new ConflictException({
        code: 'ONLINE_FULFILLMENT_UNAVAILABLE',
        message: 'This stock Location cannot accept a new online reservation.',
      });
    }

    const available = Math.max(
      0,
      existing.quantityOnHand -
        existing.quantityReserved -
        existing.safetyStock,
    );
    if (quantity > available) {
      throw new ConflictException({
        code: 'INVENTORY_RESERVATION_EXCEEDS_AVAILABLE',
        message: 'Reservation quantity exceeds available inventory',
      });
    }

    const nextReserved = existing.quantityReserved + quantity;
    const nextStatus = this.calculateAvailability(
      existing.quantityOnHand,
      nextReserved,
      existing.safetyStock,
      existing.lowStockThreshold,
    );

    await this.database.$transaction(
      async (transaction) => {
        const result = await transaction.inventory.updateMany({
          where: { id: inventoryId, version: existing.version },
          data: {
            quantityReserved: nextReserved,
            availabilityStatus: nextStatus,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (result.count !== 1) throw this.versionConflict();

        await transaction.inventoryMovement.create({
          data: {
            inventoryId,
            type: InventoryMovementType.RESERVATION,
            quantityDelta: 0,
            reservedDelta: quantity,
            quantityBefore: existing.quantityOnHand,
            quantityAfter: existing.quantityOnHand,
            reservedBefore: existing.quantityReserved,
            reservedAfter: nextReserved,
            reason: 'Inventory reserved',
            referenceType: referenceType.trim(),
            referenceId: referenceId.trim(),
            actorId,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'INVENTORY_RESERVED',
            entityType: 'Inventory',
            entityId: inventoryId,
            metadata: {
              listingId: existing.listingId,
              quantity,
              referenceType: referenceType.trim(),
              referenceId: referenceId.trim(),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.syncListingAvailability(existing.listingId, actorId);
    return this.getOwnedInventory(inventoryId, existing.listingId);
  }

  async releaseForSystem(
    inventoryId: string,
    quantity: number,
    actorId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<InventoryResponseDto> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException({
        code: 'INVENTORY_RELEASE_QUANTITY_INVALID',
        message: 'Release quantity must be a positive integer',
      });
    }

    const existing = await this.database.inventory.findUnique({
      where: { id: inventoryId },
      select: inventorySelect,
    });
    if (!existing) throw this.inventoryNotFound();
    if (!existing.listingId) {
      throw new ConflictException({
        code: 'INVENTORY_NOT_LISTED',
        message: 'Stock must belong to a Listing before an order reservation can be released or committed.',
      });
    }
    if (quantity > existing.quantityReserved) {
      throw new ConflictException({
        code: 'INVENTORY_RELEASE_EXCEEDS_RESERVED',
        message: 'Release quantity exceeds reserved inventory',
      });
    }

    const nextReserved = existing.quantityReserved - quantity;
    const nextStatus = this.calculateAvailability(
      existing.quantityOnHand,
      nextReserved,
      existing.safetyStock,
      existing.lowStockThreshold,
    );

    await this.database.$transaction(
      async (transaction) => {
        const result = await transaction.inventory.updateMany({
          where: { id: inventoryId, version: existing.version },
          data: {
            quantityReserved: nextReserved,
            availabilityStatus: nextStatus,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (result.count !== 1) throw this.versionConflict();

        await transaction.inventoryMovement.create({
          data: {
            inventoryId,
            type: InventoryMovementType.RELEASE,
            quantityDelta: 0,
            reservedDelta: -quantity,
            quantityBefore: existing.quantityOnHand,
            quantityAfter: existing.quantityOnHand,
            reservedBefore: existing.quantityReserved,
            reservedAfter: nextReserved,
            reason: 'Inventory reservation released',
            referenceType: referenceType.trim(),
            referenceId: referenceId.trim(),
            actorId,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'INVENTORY_RESERVATION_RELEASED',
            entityType: 'Inventory',
            entityId: inventoryId,
            metadata: {
              listingId: existing.listingId,
              quantity,
              referenceType: referenceType.trim(),
              referenceId: referenceId.trim(),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.syncListingAvailability(existing.listingId, actorId);
    return this.getOwnedInventory(inventoryId, existing.listingId);
  }

  async commitReservedForSystem(
    inventoryId: string,
    quantity: number,
    actorId: string,
    referenceType: string,
    referenceId: string,
  ): Promise<InventoryResponseDto> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException({
        code: 'INVENTORY_COMMIT_QUANTITY_INVALID',
        message: 'Committed quantity must be a positive integer',
      });
    }

    const existing = await this.database.inventory.findUnique({
      where: { id: inventoryId },
      select: inventorySelect,
    });
    if (!existing) throw this.inventoryNotFound();
    if (!existing.listingId) {
      throw new ConflictException({
        code: 'INVENTORY_NOT_LISTED',
        message: 'Stock must belong to a Listing before an order reservation can be released or committed.',
      });
    }
    if (
      quantity > existing.quantityReserved ||
      quantity > existing.quantityOnHand
    ) {
      throw new ConflictException({
        code: 'INVENTORY_COMMIT_EXCEEDS_RESERVED',
        message: 'Committed quantity exceeds reserved inventory',
      });
    }

    const nextOnHand = existing.quantityOnHand - quantity;
    const nextReserved = existing.quantityReserved - quantity;
    const nextStatus = this.calculateAvailability(
      nextOnHand,
      nextReserved,
      existing.safetyStock,
      existing.lowStockThreshold,
    );

    await this.database.$transaction(
      async (transaction) => {
        const result = await transaction.inventory.updateMany({
          where: { id: inventoryId, version: existing.version },
          data: {
            quantityOnHand: nextOnHand,
            quantityReserved: nextReserved,
            availabilityStatus: nextStatus,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (result.count !== 1) throw this.versionConflict();

        await transaction.inventoryMovement.create({
          data: {
            inventoryId,
            type: InventoryMovementType.SALE,
            quantityDelta: -quantity,
            reservedDelta: -quantity,
            quantityBefore: existing.quantityOnHand,
            quantityAfter: nextOnHand,
            reservedBefore: existing.quantityReserved,
            reservedAfter: nextReserved,
            reason: 'Reserved inventory committed',
            referenceType: referenceType.trim(),
            referenceId: referenceId.trim(),
            actorId,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'INVENTORY_RESERVATION_COMMITTED',
            entityType: 'Inventory',
            entityId: inventoryId,
            metadata: {
              listingId: existing.listingId,
              quantity,
              referenceType: referenceType.trim(),
              referenceId: referenceId.trim(),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.syncListingAvailability(existing.listingId, actorId);
    return this.getOwnedInventory(inventoryId, existing.listingId);
  }

  private async requireOwnedListing(
    listingId: string,
    sellerId: string,
  ): Promise<{
    id: string;
    sellerProductId: string | null;
    product: { schemaVersion: { snapshot: Prisma.JsonValue } };
  }> {
    const listing = await this.database.sellerListing.findFirst({
      where: { id: listingId, sellerId },
      select: {
        id: true,
        sellerProductId: true,
        product: {
          select: {
            schemaVersion: { select: { snapshot: true } },
          },
        },
      },
    });
    if (!listing) {
      throw new NotFoundException({
        code: 'SELLER_LISTING_NOT_FOUND',
        message: 'Seller listing was not found',
      });
    }
    return listing;
  }

  private assertStockApplicable(snapshot: Prisma.JsonValue): void {
    if (!this.isRecord(snapshot)) return;

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
    if (
      source?.stock === ProductTypeRequirementLevel.NOT_APPLICABLE
    ) {
      throw new BadRequestException({
        code: 'LISTING_INVENTORY_NOT_APPLICABLE',
        message:
          'The bound Product Type schema does not allow inventory for this Seller Offer.',
      });
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async getOwnedInventory(
    id: string,
    listingId: string,
  ): Promise<InventoryResponseDto> {
    const record = await this.database.inventory.findFirst({
      where: { id, listingId },
      select: inventorySelect,
    });
    if (!record) throw this.inventoryNotFound();
    return this.toResponse(record);
  }

  async syncListingAvailability(
    listingId: string,
    actorId: string,
  ): Promise<void> {
    const listing = await this.database.sellerListing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        productId: true,
        status: true,
        version: true,
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
    if (!listing) return;

    const quantityAvailable = listing.inventories.reduce(
      (sum, row) =>
        sum + (row.location.onlineFulfillmentEnabled &&
        row.location.status === MasterDataStatus.ACTIVE
          ? Math.max(0, row.quantityOnHand - row.quantityReserved - row.safetyStock)
          : 0),
      0,
    );

    let nextStatus: SellerListingStatus | null = null;
    if (
      listing.status === SellerListingStatus.ACTIVE &&
      quantityAvailable === 0
    ) {
      nextStatus = SellerListingStatus.OUT_OF_STOCK;
    } else if (
      listing.status === SellerListingStatus.OUT_OF_STOCK &&
      quantityAvailable > 0
    ) {
      nextStatus = SellerListingStatus.ACTIVE;
    }

    if (!nextStatus) return;

    await this.database.$transaction(
      async (transaction) => {
        if (
          nextStatus === SellerListingStatus.ACTIVE &&
          !(await isArticleActiveForCommerce(
            transaction,
            listing.productId,
          ))
        ) {
          return;
        }

        const result = await transaction.sellerListing.updateMany({
          where: { id: listingId, version: listing.version },
          data: {
            status: nextStatus,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (result.count !== 1) {
          throw new ConflictException({
            code: 'SELLER_LISTING_VERSION_CONFLICT',
            message: 'Seller listing changed while inventory was updated',
          });
        }
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'SELLER_LISTING_AVAILABILITY_SYNCED',
            entityType: 'SellerListing',
            entityId: listingId,
            metadata: {
              previousStatus: listing.status,
              nextStatus,
              quantityAvailable,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private calculateAvailability(
    quantityOnHand: number,
    quantityReserved: number,
    safetyStock: number,
    lowStockThreshold: number,
  ): InventoryAvailabilityStatus {
    const available = Math.max(
      0,
      quantityOnHand - quantityReserved - safetyStock,
    );
    if (available === 0) return InventoryAvailabilityStatus.OUT_OF_STOCK;
    if (available <= lowStockThreshold) {
      return InventoryAvailabilityStatus.LOW_STOCK;
    }
    return InventoryAvailabilityStatus.IN_STOCK;
  }

  private toResponse(record: InventoryRecord): InventoryResponseDto {
    return {
      id: record.id,
      listingId: record.listingId,
      locationId: record.locationId,
      quantityOnHand: record.quantityOnHand,
      quantityReserved: record.quantityReserved,
      safetyStock: record.safetyStock,
      lowStockThreshold: record.lowStockThreshold,
      quantityAvailable: Math.max(
        0,
        record.quantityOnHand -
          record.quantityReserved -
          record.safetyStock,
      ),
      availabilityStatus: record.availabilityStatus,
      version: record.version,
      updatedAt: record.updatedAt,
    };
  }

  private inventoryNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'INVENTORY_NOT_FOUND',
      message: 'Inventory record was not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'INVENTORY_VERSION_CONFLICT',
      message: 'Inventory changed since it was loaded',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'INVENTORY_DUPLICATE',
        message:
          'Inventory already exists for this Seller listing and location, or the location code is already used',
      });
    }
    throw error;
  }
}
