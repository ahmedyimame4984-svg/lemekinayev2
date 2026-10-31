import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, AccountType, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { EmailService } from '../common/email/email.service.js';
import { resolveSellerEmailOrigin } from '../marketplace/seller-email-origin.js';
import { AdminAuthCrypto } from './admin-auth.crypto.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import type {
  RegisterSellerAccountDto,
  ResendSellerVerificationDto,
} from './dto/seller-registration-auth.dto.js';

const VERIFICATION_LIFETIME_MS = 30 * 60_000;
const RESEND_COOLDOWN_MS = 2 * 60_000;

@Injectable()
export class SellerAccountRegistrationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: AdminAuthCrypto,
    private readonly throttles: AuthThrottleService,
    private readonly email: EmailService,
  ) {}

  async register(input: RegisterSellerAccountDto, sourceIp: string): Promise<void> {
    await this.throttles.consume('seller-account-register', sourceIp);
    if (!this.email.isConfigured) throw this.emailUnavailable();

    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.crypto.hashPassword(input.password);
    const token = this.crypto.randomToken();
    const now = new Date();

    try {
      const created = await this.database.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: {
            id: true,
            accountType: true,
            status: true,
            sellerCredential: { select: { userId: true } },
          },
        });
        if (existing) {
          // Existing, provisioned Seller records can recover from the old
          // invitation flow without an Admin-generated activation link.
          if (
            existing.accountType !== AccountType.SELLER ||
            existing.status !== AccountStatus.PROVISIONED ||
            existing.sellerCredential
          ) return false;
          await tx.user.update({
            where: { id: existing.id },
            data: {
              sellerCredential: {
                create: { passwordHash, passwordChangedAt: now },
              },
              sellerEmailVerifications: {
                create: {
                  tokenHash: this.crypto.hashToken(token),
                  expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
                },
              },
            },
          });
          return true;
        }

        const user = await tx.user.create({
          data: {
            email,
            accountType: AccountType.SELLER,
            status: AccountStatus.PROVISIONED,
            sellerCredential: {
              create: { passwordHash, passwordChangedAt: now },
            },
            sellerEmailVerifications: {
              create: {
                tokenHash: this.crypto.hashToken(token),
                expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
              },
            },
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'SELLER_ACCOUNT_REGISTERED',
            entityType: 'User',
            entityId: user.id,
            metadata: { sourceIpHash: this.throttles.sourceHash(sourceIp) },
          },
        });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // Never reveal that an email belongs to an existing account.
      if (created) await this.sendVerification(email, token);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)) {
        return;
      }
      throw error;
    }
  }

  async resend(input: ResendSellerVerificationDto, sourceIp: string): Promise<void> {
    await this.throttles.consume('seller-email-resend', sourceIp);
    if (!this.email.isConfigured) throw this.emailUnavailable();

    const email = input.email.trim().toLowerCase();
    const user = await this.database.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        accountType: AccountType.SELLER,
        status: AccountStatus.PROVISIONED,
        emailVerifiedAt: null,
        sellerCredential: { isNot: null },
      },
      select: { id: true },
    });
    if (!user) return;

    const now = new Date();
    const issuedRecently = await this.database.sellerEmailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
      },
      select: { id: true },
    });
    if (issuedRecently) return;

    const token = this.crypto.randomToken();
    try {
      await this.database.$transaction(async (tx) => {
        await tx.sellerEmailVerificationToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        });
        await tx.sellerEmailVerificationToken.create({
          data: {
            userId: user.id,
            tokenHash: this.crypto.hashToken(token),
            expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return;
      }
      throw error;
    }
    await this.sendVerification(email, token);
  }

  async verify(token: string, sourceIp: string): Promise<void> {
    await this.throttles.consume('seller-email-verify', sourceIp);
    if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) throw this.verificationRejected();
    const now = new Date();
    const record = await this.database.sellerEmailVerificationToken.findUnique({
      where: { tokenHash: this.crypto.hashToken(token) },
      select: {
        id: true,
        userId: true,
        consumedAt: true,
        expiresAt: true,
        user: {
          select: {
            accountType: true,
            status: true,
            emailVerifiedAt: true,
            sellerProfile: {
              select: {
                id: true,
                status: true,
                approvalStatus: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
    });
    if (
      !record || record.consumedAt || record.expiresAt <= now ||
      record.user.accountType !== AccountType.SELLER ||
      record.user.status !== AccountStatus.PROVISIONED ||
      record.user.emailVerifiedAt
    ) throw this.verificationRejected();

    await this.database.$transaction(async (tx) => {
      const claimed = await tx.sellerEmailVerificationToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw this.verificationRejected();
      const activated = await tx.user.updateMany({
        where: {
          id: record.userId,
          status: AccountStatus.PROVISIONED,
          emailVerifiedAt: null,
        },
        data: { status: AccountStatus.ACTIVE, emailVerifiedAt: now },
      });
      if (activated.count !== 1) throw this.verificationRejected();
      // Previously approved Sellers move to operational status without
      // requiring the obsolete Admin invitation process.
      const profile = record.user.sellerProfile;
      if (
        profile?.status === 'APPLICATION' &&
        profile.approvalStatus === 'APPROVED' &&
        profile.verificationStatus === 'VERIFIED'
      ) {
        await tx.seller.update({
          where: { id: profile.id },
          data: { status: 'ACTIVE', version: { increment: 1 } },
        });
      }
      await tx.sellerEmailVerificationToken.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { consumedAt: now },
      });
      // Connect legacy applications only after proof of email ownership.
      await tx.sellerApplication.updateMany({
        where: {
          ownerUserId: null,
          contactEmail: { equals: await this.emailForUser(tx, record.userId), mode: 'insensitive' },
        },
        data: { ownerUserId: record.userId },
      });
      await tx.auditLog.create({
        data: {
          actorId: record.userId,
          action: 'SELLER_EMAIL_VERIFIED',
          entityType: 'User',
          entityId: record.userId,
          metadata: { sourceIpHash: this.throttles.sourceHash(sourceIp) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async emailForUser(tx: Prisma.TransactionClient, id: string): Promise<string> {
    const user = await tx.user.findUniqueOrThrow({
      where: { id },
      select: { email: true },
    });
    if (!user.email) throw this.verificationRejected();
    return user.email;
  }

  private async sendVerification(toEmail: string, token: string): Promise<void> {
    const origin = resolveSellerEmailOrigin(
      process.env.SELLER_APP_ORIGIN,
      process.env.NODE_ENV,
    );
    const url = new URL('/verify-email', origin);
    url.hash = new URLSearchParams({ token }).toString();
    try {
      await this.email.send({
        template: 'seller-email-verification',
        toEmail,
        subject: 'Lemekinaye Seller — Verify your email',
        data: { referenceCode: 'SELLER-ACCOUNT', verificationUrl: url.toString() },
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'SELLER_VERIFICATION_EMAIL_FAILED',
        message: 'Email could not be delivered. Use resend verification to try again.',
      });
    }
  }

  private emailUnavailable() {
    return new ServiceUnavailableException({
      code: 'SELLER_EMAIL_UNAVAILABLE',
      message: 'Email verification is temporarily unavailable.',
    });
  }

  private verificationRejected() {
    return new UnauthorizedException({
      code: 'SELLER_VERIFICATION_INVALID',
      message: 'This verification link is invalid or expired. Request a new link.',
    });
  }
}
