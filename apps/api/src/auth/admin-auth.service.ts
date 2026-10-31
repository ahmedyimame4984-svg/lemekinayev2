import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  AdminAuthChallengeType,
  Prisma,
} from '@prisma/client';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import { AdminAuthCrypto } from './admin-auth.crypto.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import type {
  AdminAccountPageQueryDto,
  AdminAccountPageResponseDto,
  AdminAccountSummaryResponseDto,
  AdminActivationResponseDto,
  AdminLoginDto,
  AdminMfaChallengeResponseDto,
  AdminProvisioningResponseDto,
  AdminSessionResponseDto,
  BeginAdminActivationDto,
  ProvisionAdminDto,
  UpdateAdminAccountStatusDto,
  VerifyAdminActivationDto,
  VerifyAdminMfaDto,
} from './dto/admin-auth.dto.js';
import { SessionService } from './session.service.js';

export interface AdminAuthRequestContext {
  sourceIp: string;
  userAgent?: string;
}

const adminAccountSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  adminCredential: {
    select: {
      mfaEnrolledAt: true,
      lockedUntil: true,
    },
  },
  userRoles: {
    orderBy: { assignedAt: 'asc' },
    select: {
      role: {
        select: {
          key: true,
          name: true,
          rolePermissions: {
            select: {
              permission: { select: { key: true } },
            },
          },
        },
      },
    },
  },
  sessions: {
    where: { revokedAt: null },
    orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    select: { lastSeenAt: true, createdAt: true },
  },
} satisfies Prisma.UserSelect;

type AdminAccountView = Prisma.UserGetPayload<{
  select: typeof adminAccountSelect;
}>;

type ChallengeWithUser = Prisma.AdminAuthChallengeGetPayload<{
  include: {
    provisioningToken: true;
    user: { include: { adminCredential: true } };
  };
}>;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: AdminAuthCrypto,
    private readonly throttles: AuthThrottleService,
    private readonly sessions: SessionService,
  ) {}

  async listAdminAccounts(): Promise<AdminAccountSummaryResponseDto[]> {
    const users = await this.database.user.findMany({
      where: { accountType: AccountType.ADMIN },
      orderBy: [{ name: 'asc' }, { email: 'asc' }, { id: 'asc' }],
      select: adminAccountSelect,
    });

    return users.map((user) => this.toAdminAccountSummary(user));
  }

  async listAdminAccountsPage(
    query: AdminAccountPageQueryDto,
  ): Promise<AdminAccountPageResponseDto> {
    const search = query.search?.trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.UserWhereInput = {
      accountType: AccountType.ADMIN,
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { email: 'asc' }, { id: 'asc' }],
        select: adminAccountSelect,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: users.map((user) => this.toAdminAccountSummary(user)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getAdminAccountSummary(
    userId: string,
  ): Promise<AdminAccountSummaryResponseDto> {
    const user = await this.database.user.findFirst({
      where: { id: userId, accountType: AccountType.ADMIN },
      select: adminAccountSelect,
    });
    if (!user) {
      throw new NotFoundException({
        code: 'ADMIN_ACCOUNT_NOT_FOUND',
        message: 'Admin account not found',
      });
    }
    return this.toAdminAccountSummary(user);
  }

  async updateAdminAccountStatus(
    userId: string,
    input: UpdateAdminAccountStatusDto,
    actorId: string,
  ): Promise<AdminAccountSummaryResponseDto> {
    const allowedStatuses = new Set<AccountStatus>([
      AccountStatus.ACTIVE,
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
    ]);
    if (!allowedStatuses.has(input.status)) {
      throw new ConflictException({
        code: 'ADMIN_ACCOUNT_STATUS_INVALID',
        message: 'That Admin account status transition is not allowed',
      });
    }
    if (userId === actorId && input.status !== AccountStatus.ACTIVE) {
      throw new ConflictException({
        code: 'ADMIN_ACCOUNT_SELF_LOCKOUT_FORBIDDEN',
        message: 'An administrator cannot suspend or deactivate their own account',
      });
    }

    const current = await this.database.user.findFirst({
      where: { id: userId, accountType: AccountType.ADMIN },
      select: {
        id: true,
        status: true,
        adminCredential: { select: { mfaEnrolledAt: true } },
      },
    });
    if (!current) {
      throw new NotFoundException({
        code: 'ADMIN_ACCOUNT_NOT_FOUND',
        message: 'Admin account not found',
      });
    }
    if (
      input.status === AccountStatus.ACTIVE &&
      !current.adminCredential?.mfaEnrolledAt
    ) {
      throw new ConflictException({
        code: 'ADMIN_ACCOUNT_MFA_REQUIRED',
        message: 'MFA enrollment is required before an Admin account can be active',
      });
    }

    if (current.status !== input.status) {
      const now = new Date();
      await this.database.$transaction(
        async (transaction) => {
          await transaction.user.update({
            where: { id: userId },
            data: { status: input.status },
          });
          if (input.status !== AccountStatus.ACTIVE) {
            await transaction.session.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: now },
            });
          }
          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ADMIN_ACCOUNT_STATUS_CHANGED',
              entityType: 'User',
              entityId: userId,
              metadata: {
                result: 'success',
                previousStatus: current.status,
                status: input.status,
                sessionsRevoked: input.status !== AccountStatus.ACTIVE,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }

    return this.getAdminAccountSummary(userId);
  }

  private toAdminAccountSummary(
    user: AdminAccountView,
  ): AdminAccountSummaryResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      mfaEnrolled: Boolean(user.adminCredential?.mfaEnrolledAt),
      lockedUntil: user.adminCredential?.lockedUntil ?? null,
      lastSeenAt:
        user.sessions[0]?.lastSeenAt ?? user.sessions[0]?.createdAt ?? null,
      roles: user.userRoles.map(({ role }) => ({
        key: role.key,
        name: role.name,
        permissions: role.rolePermissions
          .map(({ permission }) => permission.key)
          .sort(),
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async provisionAdmin(
    input: ProvisionAdminDto,
    actorId: string | null,
  ): Promise<AdminProvisioningResponseDto> {
    const environment = validateEnvironment(process.env);
    const now = new Date();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const activationToken = this.crypto.randomToken();
    const expiresAt = new Date(
      now.getTime() + environment.authAdminActivationTtlMinutes * 60_000,
    );

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const platformAdminRole = await transaction.role.findUnique({
            where: { key: 'platform-admin' },
            select: { id: true },
          });
          if (!platformAdminRole) {
            throw new ServiceUnavailableException({
              code: 'ADMIN_PROVISIONING_UNAVAILABLE',
              message: 'The platform Admin role is not configured',
            });
          }

          const existing = await transaction.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, accountType: true, status: true },
          });
          if (
            existing &&
            (existing.accountType !== AccountType.ADMIN ||
              existing.status !== AccountStatus.PROVISIONED)
          ) {
            throw new ConflictException({
              code: 'ADMIN_ACCOUNT_ALREADY_EXISTS',
              message: 'The account cannot be provisioned',
            });
          }

          const user = existing
            ? await transaction.user.update({
                where: { id: existing.id },
                data: { email, name },
                select: { id: true },
              })
            : await transaction.user.create({
                data: {
                  email,
                  name,
                  accountType: AccountType.ADMIN,
                  status: AccountStatus.PROVISIONED,
                },
                select: { id: true },
              });

          await transaction.userRole.upsert({
            where: {
              userId_roleId: {
                userId: user.id,
                roleId: platformAdminRole.id,
              },
            },
            create: {
              userId: user.id,
              roleId: platformAdminRole.id,
              assignedById: actorId,
            },
            update: { assignedById: actorId, assignedAt: now },
          });
          await transaction.adminAuthChallenge.deleteMany({
            where: { userId: user.id },
          });
          await transaction.adminCredential.deleteMany({
            where: { userId: user.id },
          });
          await transaction.adminProvisioningToken.updateMany({
            where: { userId: user.id, consumedAt: null },
            data: { consumedAt: now },
          });

          const provisioning = await transaction.adminProvisioningToken.create({
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
              action: 'ADMIN_ACCOUNT_PROVISIONED',
              entityType: 'User',
              entityId: user.id,
              metadata: {
                result: 'success',
                provisioningId: provisioning.id,
                expiresAt: expiresAt.toISOString(),
                source: actorId ? 'admin-api' : 'offline-command',
              },
            },
          });

          return { userId: user.id, activationToken, expiresAt };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'ADMIN_ACCOUNT_ALREADY_EXISTS',
          message: 'The account cannot be provisioned',
        });
      }
      throw error;
    }
  }

  async beginActivation(
    input: BeginAdminActivationDto,
    context: AdminAuthRequestContext,
  ): Promise<AdminActivationResponseDto> {
    await this.throttles.consume('admin-activation', context.sourceIp);
    const now = new Date();
    const provisioning = await this.database.adminProvisioningToken.findUnique({
      where: { tokenHash: this.crypto.hashToken(input.activationToken) },
      include: { user: true },
    });
    if (
      !provisioning ||
      provisioning.consumedAt ||
      provisioning.expiresAt <= now ||
      provisioning.failedAttempts >=
        validateEnvironment(process.env).authAdminMaxAttempts ||
      provisioning.user.accountType !== AccountType.ADMIN ||
      provisioning.user.status !== AccountStatus.PROVISIONED
    ) {
      await this.auditUnknownFailure(
        'ADMIN_ACTIVATION_FAILED',
        context,
        'invalid-or-expired-token',
      );
      throw this.activationRejected();
    }

    const environment = validateEnvironment(process.env);
    const secret = this.crypto.generateMfaSecret();
    const encryptedSecret = this.crypto.encryptMfaSecret(secret);
    const passwordHash = await this.crypto.hashPassword(input.password);
    const challengeToken = this.crypto.randomToken();
    const expiresAt = new Date(
      now.getTime() + environment.authAdminChallengeTtlMinutes * 60_000,
    );

    await this.database.$transaction(
      async (transaction) => {
        const stillValid = await transaction.adminProvisioningToken.findFirst({
          where: {
            id: provisioning.id,
            consumedAt: null,
            expiresAt: { gt: now },
            failedAttempts: {
              lt: environment.authAdminMaxAttempts,
            },
            user: {
              accountType: AccountType.ADMIN,
              status: AccountStatus.PROVISIONED,
            },
          },
          select: { id: true },
        });
        if (!stillValid) {
          throw this.activationRejected();
        }

        await transaction.adminCredential.upsert({
          where: { userId: provisioning.userId },
          create: {
            userId: provisioning.userId,
            passwordHash,
            mfaSecretCiphertext: encryptedSecret.ciphertext,
            mfaSecretNonce: encryptedSecret.nonce,
            mfaSecretAuthTag: encryptedSecret.authTag,
            passwordChangedAt: now,
          },
          update: {
            passwordHash,
            mfaSecretCiphertext: encryptedSecret.ciphertext,
            mfaSecretNonce: encryptedSecret.nonce,
            mfaSecretAuthTag: encryptedSecret.authTag,
            mfaEnrolledAt: null,
            lastTotpCounter: null,
            failedLoginAttempts: 0,
            failedMfaAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: now,
          },
        });
        await transaction.adminAuthChallenge.updateMany({
          where: {
            userId: provisioning.userId,
            type: AdminAuthChallengeType.MFA_ENROLLMENT,
            consumedAt: null,
          },
          data: { consumedAt: now },
        });
        const challenge = await transaction.adminAuthChallenge.create({
          data: {
            userId: provisioning.userId,
            provisioningTokenId: provisioning.id,
            type: AdminAuthChallengeType.MFA_ENROLLMENT,
            tokenHash: this.crypto.hashToken(challengeToken),
            expiresAt,
          },
          select: { id: true },
        });
        await transaction.auditLog.create({
          data: {
            actorId: provisioning.userId,
            action: 'ADMIN_MFA_ENROLLMENT_STARTED',
            entityType: 'AdminAuthChallenge',
            entityId: challenge.id,
            metadata: {
              result: 'success',
              expiresAt: expiresAt.toISOString(),
              sourceIpHash: this.throttles.sourceHash(context.sourceIp),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      challengeToken,
      expiresAt,
      secret,
      otpauthUri: this.crypto.buildTotpUri(
        provisioning.user.email ?? '',
        secret,
      ),
    };
  }

  async verifyActivation(
    input: VerifyAdminActivationDto,
    context: AdminAuthRequestContext,
  ): Promise<void> {
    await this.throttles.consume('admin-activation-verify', context.sourceIp);
    const challenge = await this.findChallenge(input.challengeToken);
    const now = new Date();
    if (!this.isUsableEnrollmentChallenge(challenge, now)) {
      await this.auditChallengeRejection(
        challenge,
        context,
        'ADMIN_MFA_ENROLLMENT_FAILED',
        'invalid-or-expired-challenge',
      );
      throw this.activationRejected();
    }

    const credential = challenge.user.adminCredential;
    const counter = this.verifyCredentialTotp(credential, input.code);
    if (counter === null) {
      await this.recordChallengeFailure(
        challenge,
        context,
        'ADMIN_MFA_ENROLLMENT_FAILED',
        false,
      );
      throw this.activationRejected();
    }

    await this.database.$transaction(
      async (transaction) => {
        const claimed = await transaction.adminAuthChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            failedAttempts: challenge.failedAttempts,
          },
          data: { consumedAt: now },
        });
        if (claimed.count !== 1) {
          throw this.activationRejected();
        }

        const activated = await transaction.user.updateMany({
          where: {
            id: challenge.userId,
            accountType: AccountType.ADMIN,
            status: AccountStatus.PROVISIONED,
          },
          data: { status: AccountStatus.ACTIVE },
        });
        const provisioning =
          await transaction.adminProvisioningToken.updateMany({
            where: {
              id: challenge.provisioningTokenId ?? '',
              consumedAt: null,
              expiresAt: { gt: now },
            },
            data: { consumedAt: now },
          });
        if (activated.count !== 1 || provisioning.count !== 1) {
          throw this.activationRejected();
        }

        await transaction.adminCredential.update({
          where: { userId: challenge.userId },
          data: {
            mfaEnrolledAt: now,
            lastTotpCounter: counter,
            failedMfaAttempts: 0,
            lockedUntil: null,
          },
        });
        await transaction.adminAuthChallenge.updateMany({
          where: { userId: challenge.userId, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.auditLog.create({
          data: {
            actorId: challenge.userId,
            action: 'ADMIN_ACCOUNT_ACTIVATED',
            entityType: 'User',
            entityId: challenge.userId,
            metadata: {
              result: 'success',
              mfa: 'totp',
              sourceIpHash: this.throttles.sourceHash(context.sourceIp),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.throttles.reset('admin-activation', context.sourceIp);
    await this.throttles.reset('admin-activation-verify', context.sourceIp);
  }

  async login(
    input: AdminLoginDto,
    context: AdminAuthRequestContext,
  ): Promise<AdminMfaChallengeResponseDto> {
    await this.throttles.consume('admin-login', context.sourceIp);
    const email = input.email.trim().toLowerCase();
    const user = await this.database.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { adminCredential: true },
    });
    const credential = user?.adminCredential;
    const passwordValid = credential
      ? await this.crypto.verifyPassword(
          input.password,
          credential.passwordHash,
        )
      : await this.consumeDummyPasswordWork(input.password);
    const now = new Date();
    const eligible =
      user?.accountType === AccountType.ADMIN &&
      user.status === AccountStatus.ACTIVE &&
      credential?.mfaEnrolledAt &&
      (!credential.lockedUntil || credential.lockedUntil <= now);

    if (!passwordValid || !eligible || !user || !credential) {
      if (user && credential && !passwordValid) {
        await this.recordPasswordFailure(user.id, credential, context);
      } else {
        await this.auditKnownOrUnknownFailure(
          user?.id ?? null,
          'ADMIN_LOGIN_FAILED',
          context,
          credential?.lockedUntil && credential.lockedUntil > now
            ? 'temporarily-locked'
            : 'credentials-or-account-state',
        );
      }
      throw this.authenticationRejected();
    }

    const environment = validateEnvironment(process.env);
    const challengeToken = this.crypto.randomToken();
    const expiresAt = new Date(
      now.getTime() + environment.authAdminChallengeTtlMinutes * 60_000,
    );
    await this.database.$transaction(
      async (transaction) => {
        await transaction.adminAuthChallenge.updateMany({
          where: {
            userId: user.id,
            type: AdminAuthChallengeType.LOGIN,
            consumedAt: null,
          },
          data: { consumedAt: now },
        });
        const challenge = await transaction.adminAuthChallenge.create({
          data: {
            userId: user.id,
            type: AdminAuthChallengeType.LOGIN,
            tokenHash: this.crypto.hashToken(challengeToken),
            expiresAt,
          },
          select: { id: true },
        });
        await transaction.adminCredential.update({
          where: { userId: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            action: 'ADMIN_PASSWORD_VERIFIED',
            entityType: 'AdminAuthChallenge',
            entityId: challenge.id,
            metadata: {
              result: 'success',
              expiresAt: expiresAt.toISOString(),
              sourceIpHash: this.throttles.sourceHash(context.sourceIp),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { challengeToken, expiresAt };
  }

  async verifyLoginMfa(
    input: VerifyAdminMfaDto,
    context: AdminAuthRequestContext,
  ): Promise<AdminSessionResponseDto> {
    await this.throttles.consume('admin-mfa', context.sourceIp);
    const challenge = await this.findChallenge(input.challengeToken);
    const now = new Date();
    if (!this.isUsableLoginChallenge(challenge, now)) {
      await this.auditChallengeRejection(
        challenge,
        context,
        'ADMIN_MFA_VERIFICATION_FAILED',
        'invalid-or-expired-challenge',
      );
      throw this.mfaRejected();
    }

    const credential = challenge.user.adminCredential;
    const counter = this.verifyCredentialTotp(credential, input.code);
    if (counter === null) {
      await this.recordChallengeFailure(
        challenge,
        context,
        'ADMIN_MFA_VERIFICATION_FAILED',
        true,
      );
      throw this.mfaRejected();
    }

    await this.database.$transaction(
      async (transaction) => {
        const claimed = await transaction.adminAuthChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            failedAttempts: challenge.failedAttempts,
          },
          data: { consumedAt: now },
        });
        if (claimed.count !== 1) {
          throw this.mfaRejected();
        }
        await transaction.adminCredential.update({
          where: { userId: challenge.userId },
          data: {
            lastTotpCounter: counter,
            failedLoginAttempts: 0,
            failedMfaAttempts: 0,
            lockedUntil: null,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: challenge.userId,
            action: 'ADMIN_MFA_VERIFIED',
            entityType: 'AdminAuthChallenge',
            entityId: challenge.id,
            metadata: {
              result: 'success',
              sourceIpHash: this.throttles.sourceHash(context.sourceIp),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const session = await this.sessions.issueSession(challenge.userId, {
      mfaVerified: true,
      sourceIp: context.sourceIp,
      userAgent: context.userAgent,
    });
    if (!session.refreshToken || !session.refreshExpiresAt) {
      throw new ServiceUnavailableException({
        code: 'ADMIN_SESSION_UNAVAILABLE',
        message: 'The Admin session could not be created',
      });
    }
    await this.throttles.reset('admin-login', context.sourceIp);
    await this.throttles.reset('admin-mfa', context.sourceIp);

    return {
      accessToken: session.token,
      accessTokenExpiresAt: session.expiresAt,
      refreshToken: session.refreshToken,
      sessionExpiresAt: session.refreshExpiresAt,
    };
  }

  async refreshSession(
    refreshToken: string,
    context: AdminAuthRequestContext,
  ): Promise<AdminSessionResponseDto> {
    await this.throttles.consume('admin-refresh', context.sourceIp);
    const session = await this.sessions.rotateAdminSession(refreshToken, {
      sourceIp: context.sourceIp,
      userAgent: context.userAgent,
    });
    await this.throttles.reset('admin-refresh', context.sourceIp);

    return {
      accessToken: session.token,
      accessTokenExpiresAt: session.expiresAt,
      refreshToken: session.refreshToken,
      sessionExpiresAt: session.refreshExpiresAt,
    };
  }

  async logoutSession(
    refreshToken: string,
    context: AdminAuthRequestContext,
  ): Promise<void> {
    await this.throttles.consume('admin-logout', context.sourceIp);
    const revoked = await this.sessions.revokeByRefreshToken(refreshToken);
    if (revoked) {
      await this.throttles.reset('admin-logout', context.sourceIp);
    }
  }

  private async findChallenge(
    rawToken: string,
  ): Promise<ChallengeWithUser | null> {
    return this.database.adminAuthChallenge.findUnique({
      where: { tokenHash: this.crypto.hashToken(rawToken) },
      include: {
        provisioningToken: true,
        user: { include: { adminCredential: true } },
      },
    });
  }

  private isUsableEnrollmentChallenge(
    challenge: ChallengeWithUser | null,
    now: Date,
  ): challenge is ChallengeWithUser {
    const environment = validateEnvironment(process.env);
    return Boolean(
      challenge &&
      challenge.type === AdminAuthChallengeType.MFA_ENROLLMENT &&
      !challenge.consumedAt &&
      challenge.expiresAt > now &&
      challenge.failedAttempts < environment.authAdminMaxAttempts &&
      challenge.user.accountType === AccountType.ADMIN &&
      challenge.user.status === AccountStatus.PROVISIONED &&
      challenge.user.adminCredential &&
      challenge.provisioningToken &&
      !challenge.provisioningToken.consumedAt &&
      challenge.provisioningToken.expiresAt > now &&
      challenge.provisioningToken.failedAttempts <
        environment.authAdminMaxAttempts,
    );
  }

  private isUsableLoginChallenge(
    challenge: ChallengeWithUser | null,
    now: Date,
  ): challenge is ChallengeWithUser {
    const environment = validateEnvironment(process.env);
    const credential = challenge?.user.adminCredential;
    return Boolean(
      challenge &&
      challenge.type === AdminAuthChallengeType.LOGIN &&
      !challenge.consumedAt &&
      challenge.expiresAt > now &&
      challenge.failedAttempts < environment.authAdminMaxAttempts &&
      challenge.user.accountType === AccountType.ADMIN &&
      challenge.user.status === AccountStatus.ACTIVE &&
      credential?.mfaEnrolledAt &&
      (!credential.lockedUntil || credential.lockedUntil <= now),
    );
  }

  private verifyCredentialTotp(
    credential: ChallengeWithUser['user']['adminCredential'],
    code: string,
  ): bigint | null {
    if (!credential) return null;

    try {
      const secret = this.crypto.decryptMfaSecret({
        ciphertext: credential.mfaSecretCiphertext,
        nonce: credential.mfaSecretNonce,
        authTag: credential.mfaSecretAuthTag,
      });
      return this.crypto.verifyTotp(secret, code, credential.lastTotpCounter);
    } catch {
      return null;
    }
  }

  private async consumeDummyPasswordWork(password: string): Promise<false> {
    await this.crypto.hashPassword(password);
    return false;
  }

  private async recordPasswordFailure(
    userId: string,
    credential: NonNullable<ChallengeWithUser['user']['adminCredential']>,
    context: AdminAuthRequestContext,
  ): Promise<void> {
    const environment = validateEnvironment(process.env);
    const now = new Date();
    const attempts = credential.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= environment.authAdminMaxAttempts
        ? new Date(now.getTime() + environment.authAdminLockMinutes * 60_000)
        : credential.lockedUntil;

    await this.database.$transaction(async (transaction) => {
      await transaction.adminCredential.update({
        where: { userId },
        data: { failedLoginAttempts: attempts, lockedUntil },
      });
      if (lockedUntil && lockedUntil > now) {
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'User',
          entityId: userId,
          metadata: {
            result: 'failure',
            reason: 'credentials-or-account-state',
            locked: Boolean(lockedUntil && lockedUntil > now),
            sourceIpHash: this.throttles.sourceHash(context.sourceIp),
          },
        },
      });
    });
  }

  private async recordChallengeFailure(
    challenge: ChallengeWithUser,
    context: AdminAuthRequestContext,
    action: string,
    lockCredential: boolean,
  ): Promise<void> {
    const environment = validateEnvironment(process.env);
    const now = new Date();
    const attempts = challenge.failedAttempts + 1;
    const consumeChallenge = attempts >= environment.authAdminMaxAttempts;
    const credential = challenge.user.adminCredential;
    const credentialAttempts = (credential?.failedMfaAttempts ?? 0) + 1;
    const lockAccount =
      lockCredential && credentialAttempts >= environment.authAdminMaxAttempts;
    const lockedUntil = lockAccount
      ? new Date(now.getTime() + environment.authAdminLockMinutes * 60_000)
      : credential?.lockedUntil;

    await this.database.$transaction(async (transaction) => {
      const updated = await transaction.adminAuthChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          failedAttempts: challenge.failedAttempts,
        },
        data: {
          failedAttempts: attempts,
          consumedAt: consumeChallenge ? now : undefined,
        },
      });
      if (updated.count !== 1) return;

      if (lockCredential && credential) {
        await transaction.adminCredential.update({
          where: { userId: challenge.userId },
          data: {
            failedMfaAttempts: credentialAttempts,
            lockedUntil,
          },
        });
      }
      if (!lockCredential && challenge.provisioningTokenId) {
        await transaction.adminProvisioningToken.update({
          where: { id: challenge.provisioningTokenId },
          data: {
            failedAttempts: { increment: 1 },
            consumedAt: consumeChallenge ? now : undefined,
          },
        });
      }
      if (lockAccount) {
        await transaction.session.updateMany({
          where: { userId: challenge.userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId: challenge.userId,
          action,
          entityType: 'AdminAuthChallenge',
          entityId: challenge.id,
          metadata: {
            result: 'failure',
            reason: 'invalid-code',
            attempt: attempts,
            challengeConsumed: consumeChallenge,
            accountLocked: lockAccount,
            sourceIpHash: this.throttles.sourceHash(context.sourceIp),
          },
        },
      });
    });
  }

  private async auditChallengeRejection(
    challenge: ChallengeWithUser | null,
    context: AdminAuthRequestContext,
    action: string,
    reason: string,
  ): Promise<void> {
    await this.auditKnownOrUnknownFailure(
      challenge?.userId ?? null,
      action,
      context,
      reason,
      challenge?.id,
    );
  }

  private async auditUnknownFailure(
    action: string,
    context: AdminAuthRequestContext,
    reason: string,
  ): Promise<void> {
    await this.auditKnownOrUnknownFailure(null, action, context, reason);
  }

  private async auditKnownOrUnknownFailure(
    actorId: string | null,
    action: string,
    context: AdminAuthRequestContext,
    reason: string,
    entityId?: string,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorId,
        action,
        entityType: entityId ? 'AdminAuthChallenge' : 'Authentication',
        entityId,
        metadata: {
          result: 'failure',
          reason,
          sourceIpHash: this.throttles.sourceHash(context.sourceIp),
        },
      },
    });
  }

  private activationRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'ADMIN_ACTIVATION_REJECTED',
      message: 'The Admin activation request could not be verified',
    });
  }

  private authenticationRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'ADMIN_AUTHENTICATION_FAILED',
      message: 'The Admin credentials or account state are not valid',
    });
  }

  private mfaRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'ADMIN_MFA_FAILED',
      message: 'The Admin MFA challenge could not be verified',
    });
  }
}
