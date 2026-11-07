import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Body, Controller, Headers, HttpCode, HttpStatus, Logger,
  Post, ServiceUnavailableException, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import { Public } from '../auth/auth.decorators.js';
import { ReferenceSyncService } from './reference-sync.service.js';
import { DatabaseService } from '../database/database.service.js';

export class PublicationNotificationDto {
  @IsUUID()
  eventId!: string;

  @IsIn(['reference-data.published'])
  eventType!: 'reference-data.published';
}

/**
 * A signed notification is ONLY a hint to pull the authoritative feed.
 * Missed notifications are recovered by the independent scheduled worker.
 */
@Public()
@Controller('integrations/autotechdoc')
export class ReferenceSyncNotificationController {
  private readonly logger = new Logger(ReferenceSyncNotificationController.name);

  constructor(
    private readonly sync: ReferenceSyncService,
    private readonly database: DatabaseService,
  ) {}

  @Post('publication')
  @HttpCode(HttpStatus.ACCEPTED)
  async publication(
    @Body() body: PublicationNotificationDto,
    @Headers('x-autotechdoc-timestamp') timestamp?: string,
    @Headers('x-autotechdoc-signature') signature?: string,
  ): Promise<{ accepted: true }> {
    const secret = process.env.AUTOTECHDOC_PUBLICATION_WEBHOOK_SECRET;
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('Publication notifications not configured');
    }
    const numericTimestamp = Number(timestamp);
    if (!timestamp || !/^\d{10,13}$/.test(timestamp) ||
      !Number.isFinite(numericTimestamp) ||
      Math.abs(Date.now() - (timestamp.length === 10 ? numericTimestamp * 1000 : numericTimestamp)) > 300_000) {
      throw new UnauthorizedException('Invalid or expired publication notification');
    }
    if (!body?.eventId || body.eventType !== 'reference-data.published') {
      throw new BadRequestException('Invalid publication notification');
    }

    const message = `${timestamp}.${body.eventId}.${body.eventType}`;
    const expected = createHmac('sha256', secret).update(message).digest('hex');
    const received = signature?.startsWith('sha256=') ? signature.slice(7) : '';
    if (!/^[a-f0-9]{64}$/i.test(received) ||
      !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))) {
      throw new UnauthorizedException('Invalid publication signature');
    }

    // The signature includes a unique publisher event ID. Persist it before
    // acknowledging so replayed signed requests cannot repeatedly wake the
    // worker across replicas, restarts, or the five-minute HMAC window.
    try {
      await this.database.referenceSyncNotificationReceipt.create({
        data: { eventId: body.eventId },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        return { accepted: true }; // Idempotent duplicate, no extra worker.
      }
      // A database outage is not silently acknowledged: source retries and
      // scheduled polling remain independent recovery mechanisms.
      throw err;
    }

    // Receipts need to outlive the entire five-minute HMAC freshness window.
    // Cleanup is best effort: inability to prune never bypasses uniqueness.
    try {
      await this.database.referenceSyncNotificationReceipt.deleteMany({
        where: { receivedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
    } catch {
      this.logger.warn('Unable to prune old publication notification receipts');
    }

    // This is a low-latency signal, never the only delivery mechanism.
    // The scheduled pull remains responsible for durable recovery.
    void this.sync.executeIncrementalSync().catch((error: unknown) => {
      this.logger.warn(`Publication-triggered sync deferred to scheduled worker: ${String(error)}`);
    });
    return { accepted: true };
  }
}
