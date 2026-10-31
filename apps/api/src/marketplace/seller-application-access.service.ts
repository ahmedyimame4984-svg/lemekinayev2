import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma, SellerApplicationStatus } from '@prisma/client';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import { AuthThrottleService } from '../auth/auth-throttle.service.js';
import { SellerApplicationMailService } from './seller-application-mail.service.js';

const CODE_LIFETIME_MS = 10 * 60_000;
const SESSION_LIFETIME_MS = 30 * 60_000;
const MAX_CODE_ATTEMPTS = 5;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const contactEmailChangeStatuses: SellerApplicationStatus[] = [
  SellerApplicationStatus.SUBMITTED,
  SellerApplicationStatus.RESUBMITTED,
  SellerApplicationStatus.CHANGES_REQUESTED,
];

@Injectable()
export class SellerApplicationAccessService {
  private readonly codeKey: Buffer;

  constructor(
    private readonly database: DatabaseService,
    private readonly throttles: AuthThrottleService,
    private readonly mail: SellerApplicationMailService,
  ) {
    const master = validateEnvironment(process.env).authMfaEncryptionKey;
    this.codeKey = createHash('sha256')
      .update('lemekinaye:seller-application-otp:v1\u0000')
      .update(master)
      .digest();
  }

  async requestCode(
    referenceCode: string,
    contactEmail: string,
    sourceIp: string,
  ): Promise<{ message: string }> {
    await this.throttles.consume('seller-application-otp-ip', sourceIp);
    await this.throttles.consume(
      'seller-application-otp-target',
      `${referenceCode.toUpperCase()}:${contactEmail.toLowerCase()}`,
    );

    const application = await this.database.sellerApplication.findFirst({
      where: {
        referenceCode: referenceCode.trim().toUpperCase(),
        contactEmail: { equals: contactEmail.trim().toLowerCase(), mode: 'insensitive' },
      },
      select: { id: true, contactEmail: true, referenceCode: true },
    });
    if (application) {
      const challengeId = randomUUID();
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await this.database.$transaction(async (tx) => {
        await tx.sellerApplicationAccessChallenge.create({
          data: {
            id: challengeId,
            applicationId: application.id,
            purpose: 'ACCESS',
            codeHash: this.hashCode(challengeId, code),
            expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
          },
        });
        await this.mail.queue(tx, {
          applicationId: application.id,
          eventKey: `access:${challengeId}`,
          recipient: application.contactEmail,
          payload: {
            kind: 'ACCESS_CODE',
            referenceCode: application.referenceCode,
            code,
          },
        });
      });
    }

    // Identical response for existing and nonexistent applicants.
    return {
      message: 'If these details match an application, a verification code will be sent.',
    };
  }

  async verifyCode(
    referenceCode: string,
    contactEmail: string,
    code: string,
    sourceIp: string,
  ) {
    await this.throttles.consume('seller-application-otp-verify-ip', sourceIp);
    const application = await this.database.sellerApplication.findFirst({
      where: {
        referenceCode: referenceCode.trim().toUpperCase(),
        contactEmail: { equals: contactEmail.trim().toLowerCase(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    const challenge = application
      ? await this.database.sellerApplicationAccessChallenge.findFirst({
          where: {
            applicationId: application.id,
            purpose: 'ACCESS',
            consumedAt: null,
            expiresAt: { gt: new Date() },
            attempts: { lt: MAX_CODE_ATTEMPTS },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : null;
    const expected = challenge ? Buffer.from(challenge.codeHash, 'hex') : Buffer.alloc(32);
    const actual = Buffer.from(
      this.hashCode(challenge?.id || 'unknown', code),
      'hex',
    );
    if (!challenge || !timingSafeEqual(expected, actual)) {
      if (challenge) {
        await this.database.sellerApplicationAccessChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
          data: { attempts: { increment: 1 } },
        });
      }
      throw this.invalidCode();
    }

    const token = randomBytes(32).toString('base64url');
    await this.database.$transaction(async (tx) => {
      const claimed = await tx.sellerApplicationAccessChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: MAX_CODE_ATTEMPTS },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw this.invalidCode();

      await tx.sellerApplicationAccessSession.create({
        data: {
          applicationId: challenge.applicationId,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { accessToken: token, expiresInSeconds: SESSION_LIFETIME_MS / 1_000 };
  }

  async requireApplication(token: string): Promise<string> {
    if (!TOKEN_PATTERN.test(token)) throw this.invalidCode();
    const session = await this.database.sellerApplicationAccessSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw this.invalidCode();
    }
    return session.applicationId;
  }

  async revoke(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) return;
    await this.database.sellerApplicationAccessSession.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestContactEmailChange(
    applicationId: string,
    email: string,
    sourceIp: string,
  ): Promise<void> {
    const nextEmail = email.trim().toLowerCase();
    await this.throttles.consume('seller-application-email-change', sourceIp);
    await this.throttles.consume('seller-application-new-email', nextEmail);
    const application = await this.database.sellerApplication.findUnique({
      where: { id: applicationId },
      select: { status: true, referenceCode: true, contactEmail: true },
    });
    if (
      !application ||
      !contactEmailChangeStatuses.includes(application.status)
    ) {
      throw this.invalidCode();
    }
    if (application.contactEmail.toLowerCase() === nextEmail) return;

    const challengeId = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.database.$transaction(async (tx) => {
      await tx.sellerApplicationAccessChallenge.create({
        data: {
          id: challengeId,
          applicationId,
          purpose: 'EMAIL_CHANGE',
          targetEmail: nextEmail,
          codeHash: this.hashCode(challengeId, code),
          expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
        },
      });
      await this.mail.queue(tx, {
        applicationId,
        eventKey: `email-change:${challengeId}`,
        recipient: nextEmail,
        payload: { kind: 'ACCESS_CODE', referenceCode: application.referenceCode, code },
      });
    });
  }

  async verifyContactEmailChange(
    applicationId: string,
    nextEmail: string,
    code: string,
  ): Promise<string> {
    await this.throttles.consume('seller-application-email-verify', applicationId);
    const challenge = await this.database.sellerApplicationAccessChallenge.findFirst({
      where: {
        applicationId,
        purpose: 'EMAIL_CHANGE',
        targetEmail: nextEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_CODE_ATTEMPTS },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!challenge || !/^\d{6}$/u.test(code)) throw this.invalidCode();
    const valid = timingSafeEqual(
      Buffer.from(challenge.codeHash, 'hex'),
      Buffer.from(this.hashCode(challenge.id, code), 'hex'),
    );
    if (!valid) {
      await this.database.sellerApplicationAccessChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      throw this.invalidCode();
    }
    return challenge.id;
  }

  async consumeContactEmailChange(
    tx: Prisma.TransactionClient,
    challengeId: string,
    applicationId: string,
    nextEmail: string,
  ): Promise<void> {
    const claimed = await tx.sellerApplicationAccessChallenge.updateMany({
      where: {
        id: challengeId,
        applicationId,
        purpose: 'EMAIL_CHANGE',
        targetEmail: nextEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_CODE_ATTEMPTS },
      },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw this.invalidCode();
  }

  private hashCode(id: string, code: string): string {
    return createHmac('sha256', this.codeKey)
      .update(`${id}:\u0000${code}`)
      .digest('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private invalidCode(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'APPLICATION_ACCESS_REJECTED',
      message: 'The application verification code or session is invalid or expired',
    });
  }
}
