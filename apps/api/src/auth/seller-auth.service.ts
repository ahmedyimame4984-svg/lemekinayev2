import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  Prisma,
  SellerApprovalStatus,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminAuthCrypto } from './admin-auth.crypto.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import type {
  ActivateSellerAccountDto,
  ProvisionSellerAccountDto,
  SellerLoginDto,
  SellerProvisioningResponseDto,
  SellerSessionResponseDto,
} from './dto/seller-auth.dto.js';
import { SessionService } from './session.service.js';

export interface SellerAuthRequestContext {
  sourceIp: string;
  userAgent?: string;
}

@Injectable()
export class SellerAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: AdminAuthCrypto,
    private readonly throttles: AuthThrottleService,
    private readonly sessions: SessionService,
  ) {}

  async provisionSeller(
    input: ProvisionSellerAccountDto,
    actorId: string,
  ): Promise<SellerProvisioningResponseDto> {
    const now = new Date();
    const environment = validateEnvironment(process.env);
    const activationToken = this.crypto.randomToken();
    const expiresAt = new Date(
      now.getTime() +
        environment.authSellerActivationTtlMinutes * 60_000,
    );
    const phone = input.phone.trim();
    const email = input.email?.trim().toLowerCase() || null;
    const name = input.name.trim();
    const sellerCode = input.sellerCode.trim().toUpperCase();

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const existingUser = await transaction.user.findFirst({
            where: {
              OR: [
                { phone },
                ...(email
                  ? [{ email: { equals: email, mode: 'insensitive' as const } }]
                  : []),
              ],
            },
            select: {
              id: true,
              accountType: true,
              status: true,
              sellerProfile: { select: { id: true, status: true } },
            },
          });

          if (
            existingUser &&
            (existingUser.accountType !== AccountType.SELLER ||
              existingUser.status !== AccountStatus.PROVISIONED ||
              (existingUser.sellerProfile &&
                existingUser.sellerProfile.status !== SellerStatus.APPLICATION))
          ) {
            throw new ConflictException({
              code: 'SELLER_ACCOUNT_ALREADY_EXISTS',
              message: 'The Seller account cannot be provisioned',
            });
          }

          const user = existingUser
            ? await transaction.user.update({
                where: { id: existingUser.id },
                data: { phone, email, name },
                select: { id: true },
              })
            : await transaction.user.create({
                data: {
                  phone,
                  email,
                  name,
                  accountType: AccountType.SELLER,
                  status: AccountStatus.PROVISIONED,
                },
                select: { id: true },
              });

          const seller = existingUser?.sellerProfile
            ? await transaction.seller.update({
                where: { id: existingUser.sellerProfile.id },
                data: {
                  sellerCode,
                  businessName: input.businessName.trim(),
                  displayName: input.displayName.trim(),
                  sellerType: input.sellerType,
                  updatedById: actorId,
                  version: { increment: 1 },
                },
                select: { id: true },
              })
            : await transaction.seller.create({
                data: {
                  userId: user.id,
                  sellerCode,
                  businessName: input.businessName.trim(),
                  displayName: input.displayName.trim(),
                  sellerType: input.sellerType,
                  createdById: actorId,
                  updatedById: actorId,
                },
                select: { id: true },
              });

          await transaction.sellerCredential.deleteMany({
            where: { userId: user.id },
          });
          await transaction.sellerProvisioningToken.updateMany({
            where: { userId: user.id, consumedAt: null },
            data: { consumedAt: now },
          });

          const provisioning =
            await transaction.sellerProvisioningToken.create({
              data: {
                userId: user.id,
                tokenHash: this.crypto.hashToken(activationToken),
                expiresAt,
              },
              select: { id: true },
            });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'SELLER_ACCOUNT_PROVISIONED',
              entityType: 'Seller',
              entityId: seller.id,
              metadata: {
                userId: user.id,
                sellerCode,
                provisioningId: provisioning.id,
                expiresAt: expiresAt.toISOString(),
              },
            },
          });

          return {
            userId: user.id,
            sellerId: seller.id,
            activationToken,
            expiresAt,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code !== 'P2002')
      ) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SELLER_ACCOUNT_ALREADY_EXISTS',
          message: 'The Seller account cannot be provisioned',
        });
      }
      throw error;
    }
  }

  async activateSeller(
    input: ActivateSellerAccountDto,
    context: SellerAuthRequestContext,
  ): Promise<void> {
    await this.throttles.consume('seller-activation', context.sourceIp);
    const now = new Date();
    const environment = validateEnvironment(process.env);
    const tokenHash = this.crypto.hashToken(input.activationToken);

    const provisioning =
      await this.database.sellerProvisioningToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              sellerProfile: true,
            },
          },
        },
      });

    if (
      !provisioning ||
      provisioning.consumedAt ||
      provisioning.expiresAt <= now ||
      provisioning.failedAttempts >= environment.authSellerMaxAttempts ||
      provisioning.user.accountType !== AccountType.SELLER ||
      provisioning.user.status !== AccountStatus.PROVISIONED ||
      !provisioning.user.sellerProfile ||
      provisioning.user.sellerProfile.status !== SellerStatus.APPLICATION
    ) {
      throw this.activationRejected();
    }

    const passwordHash = await this.crypto.hashPassword(input.password);

    await this.database.$transaction(
      async (transaction) => {
        const claimed = await transaction.sellerProvisioningToken.updateMany({
          where: {
            id: provisioning.id,
            consumedAt: null,
            expiresAt: { gt: now },
            failedAttempts: { lt: environment.authSellerMaxAttempts },
          },
          data: { consumedAt: now },
        });
        if (claimed.count !== 1) throw this.activationRejected();

        await transaction.sellerCredential.upsert({
          where: { userId: provisioning.userId },
          create: {
            userId: provisioning.userId,
            passwordHash,
            passwordChangedAt: now,
          },
          update: {
            passwordHash,
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: now,
          },
        });

        // Automatically activate only an application that Admin already approved.
        // Legacy manually provisioned Sellers still require Admin governance.
        if (
          provisioning.user.sellerProfile!.verificationStatus === SellerVerificationStatus.VERIFIED &&
          provisioning.user.sellerProfile!.approvalStatus === SellerApprovalStatus.APPROVED
        ) {
          await transaction.seller.update({
            where: { id: provisioning.user.sellerProfile!.id },
            data: { status: SellerStatus.ACTIVE, version: { increment: 1 } },
          });
          await transaction.user.update({
            where: { id: provisioning.userId },
            data: { status: AccountStatus.ACTIVE },
          });
        }

        await transaction.auditLog.create({
          data: {
            actorId: provisioning.userId,
            action: 'SELLER_CREDENTIAL_ACTIVATED',
            entityType: 'Seller',
            entityId: provisioning.user.sellerProfile!.id,
            metadata: {
              result: 'success',
              sourceIpHash: this.throttles.sourceHash(context.sourceIp),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.throttles.reset('seller-activation', context.sourceIp);
  }

  async login(
    input: SellerLoginDto,
    context: SellerAuthRequestContext,
  ): Promise<SellerSessionResponseDto> {
    await this.throttles.consume('seller-login', context.sourceIp);
    const now = new Date();
    const environment = validateEnvironment(process.env);
    const identifier = input.identifier.trim();
    const isEmail = identifier.includes('@');

    const user = await this.database.user.findFirst({
      where: isEmail
        ? {
            email: { equals: identifier.toLowerCase(), mode: 'insensitive' },
            accountType: AccountType.SELLER,
          }
        : {
            phone: identifier,
            accountType: AccountType.SELLER,
          },
      include: {
        sellerCredential: true,
        sellerProfile: true,
      },
    });

    if (
      !user ||
      !user.sellerCredential ||
      user.status !== AccountStatus.ACTIVE ||
      (user.emailVerifiedAt === null &&
        (!user.sellerProfile ||
          user.sellerProfile.status !== SellerStatus.ACTIVE ||
          user.sellerProfile.verificationStatus !== SellerVerificationStatus.VERIFIED ||
          user.sellerProfile.approvalStatus !== SellerApprovalStatus.APPROVED)) ||
      (user.sellerCredential.lockedUntil &&
        user.sellerCredential.lockedUntil > now)
    ) {
      await this.auditLoginFailure(user?.id ?? null, context);
      throw this.loginRejected();
    }

    const valid = await this.crypto.verifyPassword(
      input.password,
      user.sellerCredential.passwordHash,
    );
    if (!valid) {
      const attempts = user.sellerCredential.failedLoginAttempts + 1;
      const lockedUntil =
        attempts >= environment.authSellerMaxAttempts
          ? new Date(
              now.getTime() + environment.authSellerLockMinutes * 60_000,
            )
          : null;

      await this.database.$transaction(async (transaction) => {
        await transaction.sellerCredential.update({
          where: { userId: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            action: 'SELLER_LOGIN_FAILED',
            entityType: 'Seller',
            entityId: user.sellerProfile?.id ?? null,
            metadata: {
              reason: 'credential-rejected',
              failedLoginAttempts: attempts,
              lockedUntil: lockedUntil?.toISOString(),
              sourceIpHash: this.throttles.sourceHash(context.sourceIp),
            },
          },
        });
      });
      throw this.loginRejected();
    }

    await this.database.sellerCredential.update({
      where: { userId: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.throttles.reset('seller-login', context.sourceIp);

    const issued = await this.sessions.issueSession(user.id, {
      sourceIp: context.sourceIp,
      userAgent: context.userAgent,
    });

    await this.database.auditLog.create({
      data: {
        actorId: user.id,
        action: 'SELLER_LOGIN_SUCCEEDED',
        entityType: 'Seller',
        entityId: user.sellerProfile?.id ?? null,
        metadata: {
          sessionExpiresAt: issued.expiresAt.toISOString(),
          sourceIpHash: this.throttles.sourceHash(context.sourceIp),
        },
      },
    });

    return {
      accessToken: issued.token,
      accessTokenExpiresAt: issued.expiresAt,
    };
  }

  private async auditLoginFailure(
    userId: string | null,
    context: SellerAuthRequestContext,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorId: userId,
        action: 'SELLER_LOGIN_FAILED',
        entityType: 'Seller',
        metadata: {
          reason: 'account-or-status-rejected',
          sourceIpHash: this.throttles.sourceHash(context.sourceIp),
        },
      },
    });
  }

  private activationRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'SELLER_ACTIVATION_REJECTED',
      message: 'The Seller activation request cannot be accepted',
    });
  }

  private loginRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'SELLER_LOGIN_REJECTED',
      message: 'The Seller credentials or account state could not be verified',
    });
  }
}
