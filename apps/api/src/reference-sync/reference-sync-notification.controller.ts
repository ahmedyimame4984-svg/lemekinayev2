import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Body, Controller, Headers, HttpCode, HttpStatus, Logger,
  Post, ServiceUnavailableException, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import { Public } from '../auth/auth.decorators.js';
import { ReferenceSyncService } from './reference-sync.service.js';

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

  constructor(private readonly sync: ReferenceSyncService) {}

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
    if (!timestamp || !/^\\d{10,13}$/.test(timestamp) ||
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

    // This is a low-latency signal, never the only delivery mechanism.
    // The scheduled pull remains responsible for durable recovery.
    void this.sync.executeIncrementalSync().catch((error: unknown) => {
      this.logger.warn(`Publication-triggered sync deferred to scheduled worker: ${String(error)}`);
    });
    return { accepted: true };
  }
}
