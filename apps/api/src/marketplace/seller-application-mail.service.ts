import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { EmailService } from '../common/email/email.service.js';
import { emailDeliveryFailureCategory } from '../common/email/email-delivery-diagnostics.js';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import { sellerApplicationEmail } from './seller-application-email.js';
import type { ApplicationEmailPayload } from './seller-application-email.types.js';
import { resolveSellerEmailOrigin } from './seller-email-origin.js';

const POLL_INTERVAL_MS = 30_000;
const LEASE_MS = 120_000;
const MAX_DELIVERY_ATTEMPTS = 12;

@Injectable()
export class SellerApplicationMailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SellerApplicationMailService.name);
  private readonly key: Buffer;
  private readonly sellerOrigin: string | null;
  private timer?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
  ) {
    const master = validateEnvironment(process.env).authMfaEncryptionKey;
    this.key = createHash('sha256')
      .update('lemekinaye:seller-application-mail:v1\u0000')
      .update(master)
      .digest();
    try {
      this.sellerOrigin = resolveSellerEmailOrigin(
        process.env.SELLER_APP_ORIGIN,
        process.env.NODE_ENV,
      );
    } catch {
      this.sellerOrigin = null;
      this.logger.error(
        'Seller notification delivery disabled: SELLER_APP_ORIGIN must be a complete URL, ' +
        'such as http://localhost:3002 for development or HTTPS in production.',
      );
    }
  }

  onModuleInit(): void {
    if (!this.email.isConfigured) {
      this.logger.warn('Seller email dispatcher is disabled because email is not configured.');
      return;
    }
    if (!this.sellerOrigin) {
      this.logger.warn('Seller email dispatcher is disabled because SELLER_APP_ORIGIN is invalid.');
      return;
    }
    this.logger.log('Seller email dispatcher started; queued notifications will be checked every 30 seconds.');
    this.timer = setInterval(() => { void this.deliverPending(); }, POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.deliverPending();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async queue(
    transaction: Prisma.TransactionClient,
    input: {
      applicationId: string;
      eventKey: string;
      recipient: string;
      payload: ApplicationEmailPayload;
    },
  ): Promise<void> {
    await transaction.sellerApplicationNotification.create({
      data: {
        applicationId: input.applicationId,
        eventKey: input.eventKey,
        kind: input.payload.kind,
        recipient: input.recipient,
        encryptedPayload: this.encrypt(input.payload),
      },
    });
  }

  private encrypt(value: ApplicationEmailPayload): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  private decrypt(value: string): ApplicationEmailPayload {
    const parts = value.split('.');
    if (parts.length !== 3) throw new Error('Invalid encrypted email payload');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(parts[0]!, 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[1]!, 'base64url'));
    const bytes = Buffer.concat([
      decipher.update(Buffer.from(parts[2]!, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(bytes.toString('utf8')) as ApplicationEmailPayload;
  }

  private async deliverPending(): Promise<void> {
    const sellerOrigin = this.sellerOrigin;
    if (!this.email.isConfigured || !sellerOrigin || this.processing) return;
    this.processing = true;
    try {
      const now = new Date();
      const pending = await this.database.sellerApplicationNotification.findMany({
        where: {
          sentAt: null,
          attempts: { lt: MAX_DELIVERY_ATTEMPTS },
          nextAttemptAt: { lte: now },
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 10,
      });

      if (pending.length > 0) {
        this.logger.debug(`Seller email dispatcher found ${pending.length} pending notification(s).`);
      }

      for (const item of pending) {
        const claim = await this.database.sellerApplicationNotification.updateMany({
          where: {
            id: item.id,
            sentAt: null,
            attempts: { lt: MAX_DELIVERY_ATTEMPTS },
            OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
          },
          data: {
            attempts: { increment: 1 },
            lockedUntil: new Date(Date.now() + LEASE_MS),
          },
        });
        if (claim.count !== 1) continue;

        try {
          await this.email.send(
            sellerApplicationEmail(
              this.decrypt(item.encryptedPayload),
              sellerOrigin,
              item.recipient,
            ),
          );
          await this.database.sellerApplicationNotification.update({
            where: { id: item.id },
            data: { sentAt: new Date(), lockedUntil: null },
          });
          this.logger.log(
            `Seller email notification sent successfully (kind: ${item.kind}, attempt: ${item.attempts + 1}).`,
          );
        } catch (error) {
          const backoffMinutes = Math.min(360, 2 ** Math.min(item.attempts + 1, 8));
          await this.database.sellerApplicationNotification.update({
            where: { id: item.id },
            data: {
              lockedUntil: null,
              nextAttemptAt: new Date(Date.now() + backoffMinutes * 60_000),
            },
          });

          const category = emailDeliveryFailureCategory(error);
          if (item.attempts + 1 >= MAX_DELIVERY_ATTEMPTS) {
            this.logger.error(
              `Seller email delivery stopped after ${MAX_DELIVERY_ATTEMPTS} attempts ` +
              `(kind: ${item.kind}, failure: ${category}).`,
            );
          } else {
            this.logger.warn(
              `Seller email delivery failed (kind: ${item.kind}, attempt: ${item.attempts + 1}, ` +
              `failure: ${category}); retry scheduled in ${backoffMinutes} minute(s).`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Seller email dispatcher could not complete its polling cycle ` +
        `(${emailDeliveryFailureCategory(error)}).`,
      );
    } finally {
      this.processing = false;
    }
  }
}
