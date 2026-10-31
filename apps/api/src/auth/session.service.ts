import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, AccountType } from '@prisma/client';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';
import { deriveSourceHashKey } from './auth-key-derivation.js';
import type { AuthPrincipal } from './auth.types.js';

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  refreshToken?: string;
  refreshExpiresAt?: Date;
}

export interface IssuedAdminSession extends IssuedSession {
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface SessionAssurance {
  mfaVerified?: boolean;
  sourceIp?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  private readonly sourceHashKey: Buffer;

  constructor(private readonly database: DatabaseService) {
    this.sourceHashKey = deriveSourceHashKey(
      validateEnvironment(process.env).authMfaEncryptionKey,
    );
  }

  async authenticateToken(token: string): Promise<AuthPrincipal | null> {
    if (!token) {
      return null;
    }

    const session = await this.database.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        mfaVerifiedAt: true,
        user: {
          select: {
            id: true,
            accountType: true,
            status: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    key: true,
                    rolePermissions: {
                      select: {
                        permission: { select: { key: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== AccountStatus.ACTIVE ||
      (session.user.accountType === AccountType.ADMIN && !session.mfaVerifiedAt)
    ) {
      return null;
    }

    const touched = await this.database.session.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { lastSeenAt: new Date() },
    });
    if (touched.count !== 1) {
      return null;
    }

    const roles = session.user.userRoles.map(({ role }) => role.key);
    const permissions = [
      ...new Set(
        session.user.userRoles.flatMap(({ role }) =>
          role.rolePermissions.map(({ permission }) => permission.key),
        ),
      ),
    ];

    return {
      userId: session.user.id,
      sessionId: session.id,
      accountType: session.user.accountType,
      status: session.user.status,
      roles,
      permissions,
    };
  }

  async issueSession(
    userId: string,
    assurance: SessionAssurance = {},
  ): Promise<IssuedSession> {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { accountType: true, status: true },
    });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'The account is not eligible for an authenticated session',
      });
    }
    if (user.accountType === AccountType.ADMIN && !assurance.mfaVerified) {
      throw new ForbiddenException({
        code: 'MFA_REQUIRED',
        message: 'A verified MFA challenge is required for an Admin session',
      });
    }

    const environment = validateEnvironment(process.env);
    const ttlMinutes =
      user.accountType === AccountType.ADMIN
        ? environment.authAdminSessionTtlMinutes
        : environment.authSessionTtlMinutes;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const token = randomBytes(32).toString('base64url');
    const refreshToken =
      user.accountType === AccountType.ADMIN
        ? randomBytes(32).toString('base64url')
        : undefined;
    const refreshExpiresAt = refreshToken
      ? new Date(Date.now() + environment.authAdminRefreshTtlMinutes * 60_000)
      : undefined;
    const mfaVerifiedAt = assurance.mfaVerified ? new Date() : undefined;
    const sessionId = randomUUID();
    const sourceIpHash = assurance.sourceIp
      ? this.hashSource(assurance.sourceIp)
      : undefined;
    const userAgent = this.normalizeUserAgent(assurance.userAgent);

    await this.database.$transaction(async (transaction) => {
      await transaction.session.create({
        data: {
          id: sessionId,
          userId,
          tokenHash: this.hashToken(token),
          refreshTokenHash: refreshToken
            ? this.hashToken(refreshToken)
            : undefined,
          expiresAt,
          refreshExpiresAt,
          mfaVerifiedAt,
          sourceIpHash,
          userAgent,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_CREATED',
          entityType: 'Session',
          entityId: sessionId,
          metadata: {
            expiresAt: expiresAt.toISOString(),
            refreshExpiresAt: refreshExpiresAt?.toISOString(),
            mfaVerified: assurance.mfaVerified === true,
            sourceIpHash,
            userAgent,
          },
        },
      });
    });

    return { token, expiresAt, refreshToken, refreshExpiresAt };
  }

  async rotateAdminSession(
    refreshToken: string,
    assurance: Pick<SessionAssurance, 'sourceIp' | 'userAgent'> = {},
  ): Promise<IssuedAdminSession> {
    const refreshTokenHash = this.hashToken(refreshToken);
    const current = await this.database.session.findUnique({
      where: { refreshTokenHash },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        refreshExpiresAt: true,
        mfaVerifiedAt: true,
        user: { select: { accountType: true, status: true } },
      },
    });
    const now = new Date();
    if (
      !current ||
      current.revokedAt ||
      !current.refreshExpiresAt ||
      current.refreshExpiresAt <= now ||
      !current.mfaVerifiedAt ||
      current.user.accountType !== AccountType.ADMIN ||
      current.user.status !== AccountStatus.ACTIVE
    ) {
      throw this.refreshRejected();
    }
    const absoluteExpiresAt = current.refreshExpiresAt;

    const environment = validateEnvironment(process.env);
    const token = randomBytes(32).toString('base64url');
    const nextRefreshToken = randomBytes(32).toString('base64url');
    const accessLifetime = new Date(
      now.getTime() + environment.authAdminSessionTtlMinutes * 60_000,
    );
    const expiresAt =
      accessLifetime < absoluteExpiresAt ? accessLifetime : absoluteExpiresAt;
    const sourceIpHash = assurance.sourceIp
      ? this.hashSource(assurance.sourceIp)
      : undefined;
    const userAgent = this.normalizeUserAgent(assurance.userAgent);

    await this.database.$transaction(async (transaction) => {
      const rotated = await transaction.session.updateMany({
        where: {
          id: current.id,
          refreshTokenHash,
          revokedAt: null,
        },
        data: {
          tokenHash: this.hashToken(token),
          refreshTokenHash: this.hashToken(nextRefreshToken),
          expiresAt,
          lastSeenAt: now,
          sourceIpHash,
          userAgent,
        },
      });
      if (rotated.count !== 1) {
        throw this.refreshRejected();
      }

      await transaction.auditLog.create({
        data: {
          actorId: current.userId,
          action: 'AUTH_SESSION_REFRESHED',
          entityType: 'Session',
          entityId: current.id,
          metadata: {
            expiresAt: expiresAt.toISOString(),
            absoluteExpiresAt: absoluteExpiresAt.toISOString(),
            sourceIpHash,
            userAgent,
          },
        },
      });
    });

    return {
      token,
      expiresAt,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: absoluteExpiresAt,
    };
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const result = await transaction.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (result.count > 0) {
        await transaction.auditLog.create({
          data: {
            actorId: userId,
            action: 'AUTH_SESSION_REVOKED',
            entityType: 'Session',
            entityId: sessionId,
          },
        });
      }
    });
  }

  async revokeByRefreshToken(refreshToken: string): Promise<boolean> {
    const current = await this.database.session.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!current || current.revokedAt) {
      return false;
    }

    await this.revokeSession(current.id, current.userId);
    return true;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashSource(source: string): string {
    return createHmac('sha256', this.sourceHashKey)
      .update('lemekinaye:auth-source:v1\u0000')
      .update(source)
      .digest('hex');
  }

  private normalizeUserAgent(
    userAgent: string | undefined,
  ): string | undefined {
    const normalized = userAgent?.trim();
    return normalized ? normalized.slice(0, 300) : undefined;
  }

  private refreshRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'ADMIN_REFRESH_REJECTED',
      message: 'The Admin session cannot be refreshed',
    });
  }
}
