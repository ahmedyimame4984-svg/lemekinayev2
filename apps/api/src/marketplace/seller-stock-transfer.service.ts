import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryAvailabilityStatus,
  InventoryMovementType,
  MasterDataStatus,
  Prisma,
  SellerStockTransferStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { SellerService } from './seller.service.js';
import { InventoryService } from './inventory.service.js';
import type {
  ReceiveSellerStockTransferDto,
  TransferSellerProductStockDto,
} from './dto/seller-product.dto.js';

@Injectable()
export class SellerStockTransferService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
    private readonly inventory: InventoryService,
  ) {}

  async list(sellerProductId: string, userId: string) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    return this.database.sellerStockTransfer.findMany({
      where: { sellerId: seller.id, sellerProductId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
  }

  async dispatch(
    sellerProductId: string,
    input: TransferSellerProductStockDto,
    userId: string,
  ) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    if (input.sourceLocationId === input.destinationLocationId) {
      throw new BadRequestException({
        code: 'TRANSFER_SAME_LOCATION',
        message: 'Source and destination Locations must be different.',
      });
    }
    const existing = await this.database.sellerStockTransfer.findUnique({
      where: { sellerId_idempotencyKey: { sellerId: seller.id, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.sellerProductId !== sellerProductId ||
        existing.sourceLocationId !== input.sourceLocationId ||
        existing.destinationLocationId !== input.destinationLocationId ||
        existing.quantity !== input.quantity) {
        throw this.conflict('The idempotency key was previously used for a different transfer.');
      }
      return existing;
    }

    try {
      const result = await this.database.$transaction(async tx => {
        const [product, from, to] = await Promise.all([
          tx.sellerProduct.findFirst({
            where: { id: sellerProductId, sellerId: seller.id },
            select: { id: true, listing: { select: { id: true } } },
          }),
          tx.inventoryLocation.findFirst({
            where: {
              id: input.sourceLocationId,
              sellerId: seller.id,
              status: MasterDataStatus.ACTIVE,
            },
            select: { id: true },
          }),
          tx.inventoryLocation.findFirst({
            where: {
              id: input.destinationLocationId,
              sellerId: seller.id,
              status: MasterDataStatus.ACTIVE,
            },
            select: { id: true },
          }),
        ]);
        if (!product || !from || !to) throw new NotFoundException('Seller Product or Location not found');

        const stock = await tx.inventory.findUnique({
          where: {
            sellerProductId_locationId: {
              sellerProductId,
              locationId: input.sourceLocationId,
            },
          },
        });
        const available = stock
          ? Math.max(0, stock.quantityOnHand - stock.quantityReserved - stock.safetyStock)
          : 0;
        if (!stock || input.quantity > available) {
          throw new ConflictException({
            code: 'TRANSFER_INSUFFICIENT_STOCK',
            message: 'The selected source Location does not have enough unreserved stock.',
          });
        }
        const nextOnHand = stock.quantityOnHand - input.quantity;
        const nextAvailable = Math.max(
          0, nextOnHand - stock.quantityReserved - stock.safetyStock,
        );
        const changed = await tx.inventory.updateMany({
          where: {
            id: stock.id,
            version: stock.version,
            quantityOnHand: { gte: input.quantity + stock.quantityReserved + stock.safetyStock },
          },
          data: {
            quantityOnHand: nextOnHand,
            availabilityStatus: nextAvailable === 0
              ? InventoryAvailabilityStatus.OUT_OF_STOCK
              : nextAvailable <= stock.lowStockThreshold
                ? InventoryAvailabilityStatus.LOW_STOCK
                : InventoryAvailabilityStatus.IN_STOCK,
            version: { increment: 1 },
            updatedById: userId,
          },
        });
        if (changed.count !== 1) throw this.conflict('Stock changed before transfer dispatch.');

        const transfer = await tx.sellerStockTransfer.create({
          data: {
            sellerId: seller.id,
            sellerProductId,
            sourceLocationId: from.id,
            destinationLocationId: to.id,
            quantity: input.quantity,
            receivedQuantity: 0,
            status: SellerStockTransferStatus.IN_TRANSIT,
            reason: input.reason.trim(),
            idempotencyKey: input.idempotencyKey,
            createdById: userId,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryId: stock.id,
            type: InventoryMovementType.TRANSFER_OUT,
            quantityDelta: -input.quantity,
            quantityBefore: stock.quantityOnHand,
            quantityAfter: nextOnHand,
            reservedBefore: stock.quantityReserved,
            reservedAfter: stock.quantityReserved,
            reason: input.reason.trim(),
            referenceType: 'SellerStockTransfer',
            referenceId: transfer.id,
            actorId: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'SELLER_STOCK_TRANSFER_DISPATCHED',
            entityType: 'SellerStockTransfer',
            entityId: transfer.id,
            metadata: {
              sellerProductId, sourceLocationId: from.id, destinationLocationId: to.id,
              quantity: input.quantity,
            },
          },
        });
        return { transfer, listingId: product.listing?.id ?? null };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result.listingId) await this.inventory.syncListingAvailability(result.listingId, userId);
      return result.transfer;
    } catch (error) {
      this.rethrow(error);
    }
  }

  async receive(
    sellerProductId: string,
    transferId: string,
    input: ReceiveSellerStockTransferDto,
    userId: string,
  ) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    try {
      const result = await this.database.$transaction(async tx => {
        const transfer = await tx.sellerStockTransfer.findFirst({
          where: { id: transferId, sellerId: seller.id, sellerProductId },
          include: { sellerProduct: { select: { listing: { select: { id: true } } } } },
        });
        if (!transfer) throw new NotFoundException('Stock transfer not found');
        const prior = await tx.sellerStockTransferReceipt.findUnique({
          where: { transferId_idempotencyKey: { transferId, idempotencyKey: input.idempotencyKey } },
        });
        if (prior) {
          if (prior.quantity !== input.quantity) throw this.conflict('Receipt idempotency key was reused with a different quantity.');
          return { transfer, listingId: transfer.sellerProduct.listing?.id ?? null };
        }
        if (transfer.version !== input.version ||
          transfer.status !== SellerStockTransferStatus.IN_TRANSIT ||
          transfer.receivedQuantity + input.quantity > transfer.quantity) {
          throw this.conflict('Transfer version changed or received quantity exceeds outstanding stock.');
        }

        const stock = await tx.inventory.upsert({
          where: {
            sellerProductId_locationId: {
              sellerProductId,
              locationId: transfer.destinationLocationId,
            },
          },
          create: {
            sellerProductId,
            locationId: transfer.destinationLocationId,
            listingId: transfer.sellerProduct.listing?.id ?? null,
            updatedById: userId,
          },
          update: {},
        });
        const nextOnHand = stock.quantityOnHand + input.quantity;
        const availability = Math.max(0, nextOnHand - stock.quantityReserved - stock.safetyStock);
        const claimed = await tx.inventory.updateMany({
          where: { id: stock.id, version: stock.version },
          data: {
            quantityOnHand: nextOnHand,
            availabilityStatus: availability === 0
              ? InventoryAvailabilityStatus.OUT_OF_STOCK
              : availability <= stock.lowStockThreshold
                ? InventoryAvailabilityStatus.LOW_STOCK
                : InventoryAvailabilityStatus.IN_STOCK,
            version: { increment: 1 },
            updatedById: userId,
          },
        });
        if (claimed.count !== 1) throw this.conflict('Destination stock changed. Retry after refresh.');

        const finished = transfer.receivedQuantity + input.quantity === transfer.quantity;
        const claimedTransfer = await tx.sellerStockTransfer.updateMany({
          where: { id: transferId, version: input.version, status: SellerStockTransferStatus.IN_TRANSIT },
          data: {
            receivedQuantity: { increment: input.quantity },
            version: { increment: 1 },
            ...(finished
              ? { status: SellerStockTransferStatus.COMPLETED, completedAt: new Date() }
              : {}),
          },
        });
        if (claimedTransfer.count !== 1) throw this.conflict('Transfer changed while receiving stock.');

        await tx.sellerStockTransferReceipt.create({
          data: {
            transferId,
            idempotencyKey: input.idempotencyKey,
            quantity: input.quantity,
            actorId: userId,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryId: stock.id,
            type: InventoryMovementType.TRANSFER_IN,
            quantityDelta: input.quantity,
            quantityBefore: stock.quantityOnHand,
            quantityAfter: nextOnHand,
            reservedBefore: stock.quantityReserved,
            reservedAfter: stock.quantityReserved,
            reason: 'Stock transfer received',
            referenceType: 'SellerStockTransfer',
            referenceId: transferId,
            actorId: userId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'SELLER_STOCK_TRANSFER_RECEIVED',
            entityType: 'SellerStockTransfer',
            entityId: transferId,
            metadata: { sellerProductId, quantity: input.quantity, completed: finished },
          },
        });
        return {
          transfer: await tx.sellerStockTransfer.findUniqueOrThrow({ where: { id: transferId } }),
          listingId: transfer.sellerProduct.listing?.id ?? null,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result.listingId) await this.inventory.syncListingAvailability(result.listingId, userId);
      return result.transfer;
    } catch (error) {
      this.rethrow(error);
    }
  }

  private conflict(message: string) {
    return new ConflictException({ code: 'SELLER_STOCK_TRANSFER_CONFLICT', message });
  }

  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')) {
      throw this.conflict('Transfer changed during this request. Reload and retry with the same idempotency key.');
    }
    throw error;
  }
}
