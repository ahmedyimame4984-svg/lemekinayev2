import { InventoryAvailabilityStatus, SellerStockTransferStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerService } from './seller.service.js';
import type { InventoryService } from './inventory.service.js';
import { SellerStockTransferService } from './seller-stock-transfer.service.js';

const sellerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sellerProductId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const sourceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const destinationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const transferId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const listingId = '12345678-1234-4234-8234-123456789abc';

const stock = {
  id: 'stock-id',
  version: 2,
  quantityOnHand: 12,
  quantityReserved: 2,
  safetyStock: 1,
  lowStockThreshold: 2,
};

const transfer = {
  id: transferId, sellerId, sellerProductId,
  sourceLocationId: sourceId, destinationLocationId: destinationId,
  quantity: 5, receivedQuantity: 0, version: 1,
  status: SellerStockTransferStatus.IN_TRANSIT,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  sellerProduct: { listing: { id: listingId } },
};

function setup() {
  const tx = {
    sellerProduct: { findFirst: vi.fn().mockResolvedValue({ id: sellerProductId, listing: { id: listingId } }) },
    inventoryLocation: { findFirst: vi.fn().mockResolvedValue({ id: sourceId }) },
    inventory: {
      findUnique: vi.fn().mockResolvedValue(stock),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({ ...stock, id: 'destination-stock', quantityOnHand: 0, quantityReserved: 0, safetyStock: 0 }),
    },
    sellerStockTransfer: {
      create: vi.fn().mockResolvedValue(transfer),
      findFirst: vi.fn().mockResolvedValue(transfer),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...transfer, version: 2, receivedQuantity: 5 }),
    },
    sellerStockTransferReceipt: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = {
    sellerStockTransfer: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const sellers = { requireOperationalSellerByUser: vi.fn().mockResolvedValue({ id: sellerId }) };
  const inventory = { syncListingAvailability: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new SellerStockTransferService(db as unknown as DatabaseService,
      sellers as unknown as SellerService, inventory as unknown as InventoryService),
    tx, db, inventory,
  };
}

describe('Seller Stock Transfers', () => {
  const dispatchInput = {
    sourceLocationId: sourceId,
    destinationLocationId: destinationId,
    quantity: 5,
    reason: 'Rebalance stock between stores',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  };

  it('dispatches only unreserved physical quantity and records in-transit movement', async () => {
    const { service, tx, inventory } = setup();
    await service.dispatch(sellerProductId, dispatchInput, actorId);

    expect(tx.inventory.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantityOnHand: 7 }),
    }));
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'TRANSFER_OUT',
        quantityDelta: -5,
        quantityBefore: 12,
        quantityAfter: 7,
      }),
    }));
    expect(inventory.syncListingAvailability).toHaveBeenCalledWith(listingId, actorId);
  });

  it('reuses completed dispatch idempotency keys without another inventory deduction', async () => {
    const { service, tx, db } = setup();
    vi.mocked(db.sellerStockTransfer.findUnique).mockResolvedValue(transfer as never);
    await expect(service.dispatch(sellerProductId, dispatchInput, actorId)).resolves.toEqual(transfer);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('does not dispatch when reserved and safety quantities make stock insufficient', async () => {
    const { service, tx } = setup();
    tx.inventory.findUnique.mockResolvedValue({ ...stock, quantityOnHand: 7 });
    await expect(service.dispatch(sellerProductId, dispatchInput, actorId))
      .rejects.toMatchObject({ response: { code: 'TRANSFER_INSUFFICIENT_STOCK' } });
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it('receives partial quantities at destination without crediting in-transit stock twice', async () => {
    const { service, tx } = setup();
    tx.sellerStockTransfer.findUniqueOrThrow.mockResolvedValue({ ...transfer, receivedQuantity: 3, version: 2 });
    await service.receive(sellerProductId, transferId, {
      version: 1, quantity: 3,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    }, actorId);

    expect(tx.inventory.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantityOnHand: 3, availabilityStatus: InventoryAvailabilityStatus.IN_STOCK }),
    }));
    expect(tx.sellerStockTransfer.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ receivedQuantity: { increment: 3 } }),
    }));
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'TRANSFER_IN', quantityDelta: 3 }),
    }));
  });

  it('does not reapply a previously recorded transfer receipt', async () => {
    const { service, tx } = setup();
    tx.sellerStockTransferReceipt.findUnique.mockResolvedValue({ quantity: 3 });
    await service.receive(sellerProductId, transferId, {
      version: 1, quantity: 3,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    }, actorId);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.sellerStockTransferReceipt.create).not.toHaveBeenCalled();
  });
});
