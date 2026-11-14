import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminAuthCrypto } from './admin-auth.crypto.js';

@Injectable()
export class AuthThrottleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: AdminAuthCrypto,
  ) {}

  async consume(action: string, source: string): Promise<void> {
    const environment = validateEnvironment(process.env);
    const now = new Date();
    const keyHash = this.keyHash(action, source);
    const windowMilliseconds = environment.authAdminIpWindowMinutes * 60_000;
    const blockMilliseconds = environment.authAdminLockMinutes * 60_000;

    let blockedUntil: Date | null | undefined;
    for (let retry = 0; retry < 3; retry += 1) {
      try {
        blockedUntil = await this.database.$transaction(
          async (transaction) => {
            const throttle = await transaction.authThrottle.findUnique({
              where: { keyHash },
            });

            if (throttle?.blockedUntil && throttle.blockedUntil > now) {
              return throttle.blockedUntil;
            }

            if (
              !throttle ||
              throttle.windowStartedAt.getTime() + windowMilliseconds <=
                now.getTime()
            ) {
              await transaction.authThrottle.upsert({
                where: { keyHash },
                create: {
                  keyHash,
                  action,
                  attempts: 1,
                  windowStartedAt: now,
                },
                update: {
                  action,
                  attempts: 1,
                  windowStartedAt: now,
                  blockedUntil: null,
                },
              });
              return null;
            }

            const attempts = throttle.attempts + 1;
            const nextBlockedUntil =
              attempts > environment.authAdminIpMaxAttempts
                ? new Date(now.getTime() + blockMilliseconds)
                : null;
            await transaction.authThrottle.update({
              where: { keyHash },
              data: { attempts, blockedUntil: nextBlockedUntil },
            });
            return nextBlockedUntil;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10_000,
          },
        );
        break;
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || error.code === 'P2028')
        )) {
          throw error;
        }
      }
    }

    // Repeated serialization contention fails closed with a controlled response.
    if (blockedUntil === undefined) {
      blockedUntil = new Date(now.getTime() + blockMilliseconds);
    }

    if (blockedUntil) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((blockedUntil.getTime() - now.getTime()) / 1_000),
      );
      throw new HttpException(
        {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many authentication attempts; try again later',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async reset(action: string, source: string): Promise<void> {
    await this.database.authThrottle.deleteMany({
      where: { keyHash: this.keyHash(action, source) },
    });
  }

  sourceHash(source: string): string {
    return this.crypto.hashSource(source);
  }

  private keyHash(action: string, source: string): string {
    return this.crypto.hashSource(`${action}\u0000${source}`);
  }
}
