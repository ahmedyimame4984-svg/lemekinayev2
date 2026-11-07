import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceSyncNotificationController } from './reference-sync-notification.controller.js';
import { ReferenceSyncService } from './reference-sync.service.js';
import type { DatabaseService } from '../database/database.service.js';

describe('signed Autotechdoc publication notifications', () => {
  const secret = '12345678901234567890123456789012';
  let trigger: ReturnType<typeof vi.fn>;
  let receipts: { create: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  let seen: Set<string>;
  let controller: ReferenceSyncNotificationController;

  beforeEach(() => {
    process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET = secret;
    trigger = vi.fn().mockResolvedValue({ status: 'SUCCESS' });
    seen = new Set<string>();
    receipts = {
      create: vi.fn(async ({ data }: { data: { eventId: string } }) => {
        if (seen.has(data.eventId)) {
          throw Object.assign(new Error('duplicate publication hint'), { code: 'P2002' });
        }
        seen.add(data.eventId);
        return { eventId: data.eventId };
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    };
    controller = new ReferenceSyncNotificationController({
      executeIncrementalSync: trigger,
    } as unknown as ReferenceSyncService, {
      referenceSyncNotificationReceipt: receipts,
    } as unknown as DatabaseService);
  });

  afterEach(() => {
    delete process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  function signed() {
    const eventId = randomUUID();
    const eventType = 'reference-data.published' as const;
    const timestamp = String(Date.now());
    const signature = 'sha256=' +
      createHmac('sha256', secret).update(`${timestamp}.${eventId}.${eventType}`).digest('hex');
    return { body: { eventId, eventType }, timestamp, signature };
  }

  it('accepts a valid signature and triggers the normal incremental engine', async () => {
    const { body, timestamp, signature } = signed();
    await expect(controller.publication(body, timestamp, signature)).resolves.toEqual({ accepted: true });
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(receipts.create).toHaveBeenCalledTimes(1);
    expect(receipts.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('deduplicates signed event replays across simulated worker restarts', async () => {
    const { body, timestamp, signature } = signed();
    await controller.publication(body, timestamp, signature);
    await controller.publication(body, timestamp, signature);
    // A restarted controller shares the durable PostgreSQL receipt store.
    controller = new ReferenceSyncNotificationController({
      executeIncrementalSync: trigger,
    } as unknown as ReferenceSyncService, {
      referenceSyncNotificationReceipt: receipts,
    } as unknown as DatabaseService);
    await controller.publication(body, timestamp, signature);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(receipts.create).toHaveBeenCalledTimes(3);
    expect(seen.size).toBe(1);
  });

  it('fails closed if the receipt database cannot confirm a new event', async () => {
    receipts.create.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));
    const { body, timestamp, signature } = signed();
    await expect(controller.publication(body, timestamp, signature))
      .rejects.toThrow('PostgreSQL unavailable');
    expect(trigger).not.toHaveBeenCalled();
  });

  it('keeps polling available even when old receipt cleanup fails', async () => {
    receipts.deleteMany.mockRejectedValueOnce(new Error('cleanup failed'));
    const { body, timestamp, signature } = signed();
    await expect(controller.publication(body, timestamp, signature))
      .resolves.toEqual({ accepted: true });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid signatures without scheduling synchronization', async () => {
    const { body, timestamp } = signed();
    await expect(controller.publication(body, timestamp, 'sha256=' + '0'.repeat(64)))
      .rejects.toThrow();
    expect(trigger).not.toHaveBeenCalled();
  });

  it('rejects expired notifications', async () => {
    const { body, signature } = signed();
    await expect(controller.publication(body, String(Date.now() - 600_000), signature))
      .rejects.toThrow();
    expect(trigger).not.toHaveBeenCalled();
  });

  it('fails closed when the webhook secret is missing', async () => {
    delete process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET;
    const { body, timestamp, signature } = signed();
    await expect(controller.publication(body, timestamp, signature)).rejects.toThrow();
    expect(trigger).not.toHaveBeenCalled();
  });
});
