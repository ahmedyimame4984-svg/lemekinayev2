import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceSyncNotificationController } from './reference-sync-notification.controller.js';
import { ReferenceSyncService } from './reference-sync.service.js';

describe('signed Autotechdoc publication notifications', () => {
  const secret = '12345678901234567890123456789012';
  let trigger: ReturnType<typeof vi.fn>;
  let controller: ReferenceSyncNotificationController;

  beforeEach(() => {
    process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET = secret;
    trigger = vi.fn().mockResolvedValue({ status: 'SUCCESS' });
    controller = new ReferenceSyncNotificationController({
      executeIncrementalSync: trigger,
    } as unknown as ReferenceSyncService);
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
