import {
  AccountStatus,
  AccountType,
  AdminAuthChallengeType,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { AdminAuthCrypto } from './admin-auth.crypto.js';
import { AdminAuthService } from './admin-auth.service.js';
import type { AuthThrottleService } from './auth-throttle.service.js';
import type { SessionService } from './session.service.js';

describe('AdminAuthService', () => {
  const role = { findUnique: vi.fn() };
  const user = {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const userRole = { upsert: vi.fn() };
  const adminCredential = {
    upsert: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };
  const adminProvisioningToken = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const adminAuthChallenge = {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const session = { updateMany: vi.fn() };
  const auditLog = { create: vi.fn() };
  const transaction = {
    role,
    user,
    userRole,
    adminCredential,
    adminProvisioningToken,
    adminAuthChallenge,
    session,
    auditLog,
  };
  const database = {
    user,
    adminProvisioningToken,
    adminAuthChallenge,
    auditLog,
    $transaction: vi.fn(
      async (callback: (client: unknown) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const crypto = {
    randomToken: vi.fn(),
    hashToken: vi.fn((value: string) => `hash:${value}`),
    hashSource: vi.fn((value: string) => `source:${value}`),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateMfaSecret: vi.fn(),
    encryptMfaSecret: vi.fn(),
    decryptMfaSecret: vi.fn(),
    verifyTotp: vi.fn(),
    buildTotpUri: vi.fn(),
  };
  const throttles = {
    consume: vi.fn(),
    reset: vi.fn(),
    sourceHash: vi.fn((value: string) => `source:${value}`),
  };
  const sessions = {
    issueSession: vi.fn(),
    rotateAdminSession: vi.fn(),
    revokeByRefreshToken: vi.fn(),
  };
  const service = new AdminAuthService(
    database as unknown as DatabaseService,
    crypto as unknown as AdminAuthCrypto,
    throttles as unknown as AuthThrottleService,
    sessions as unknown as SessionService,
  );
  const context = { sourceIp: '203.0.113.8', userAgent: 'test-agent' };
  const now = new Date('2026-09-23T20:00:00.000Z');
  const credential = {
    userId: 'admin-1',
    passwordHash: 'encoded-password',
    mfaSecretCiphertext: 'ciphertext',
    mfaSecretNonce: 'nonce',
    mfaSecretAuthTag: 'tag',
    mfaEnrolledAt: now,
    lastTotpCounter: 10n,
    failedLoginAttempts: 0,
    failedMfaAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const activeAdmin = {
    id: 'admin-1',
    phone: null,
    email: 'admin@example.com',
    name: 'Admin',
    accountType: AccountType.ADMIN,
    status: AccountStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    adminCredential: credential,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost/lemekinaye');
    vi.stubEnv(
      'AUTH_MFA_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64'),
    );
    throttles.consume.mockResolvedValue(undefined);
    throttles.reset.mockResolvedValue(undefined);
    auditLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('pages Admin accounts with server-side search and lifecycle filters', async () => {
    const adminView = {
      id: 'admin-2',
      email: 'ops@example.com',
      name: 'Operations Admin',
      status: AccountStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      adminCredential: {
        mfaEnrolledAt: now,
        lockedUntil: null,
      },
      userRoles: [
        {
          role: {
            key: 'platform-admin',
            name: 'Platform Admin',
            rolePermissions: [
              { permission: { key: 'admin.accounts.manage' } },
              { permission: { key: 'admin.portal.access' } },
            ],
          },
        },
      ],
      sessions: [{ lastSeenAt: now, createdAt: now }],
    };
    user.count.mockResolvedValue(61);
    user.findMany.mockResolvedValue([adminView]);

    await expect(
      service.listAdminAccountsPage({
        search: 'ops',
        status: AccountStatus.ACTIVE,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 'admin-2',
          email: 'ops@example.com',
          name: 'Operations Admin',
          status: AccountStatus.ACTIVE,
          mfaEnrolled: true,
          lockedUntil: null,
          lastSeenAt: now,
          roles: [
            {
              key: 'platform-admin',
              name: 'Platform Admin',
              permissions: [
                'admin.accounts.manage',
                'admin.portal.access',
              ],
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
      total: 61,
      page: 2,
      pageSize: 25,
      pageCount: 3,
    });

    const where = {
      accountType: AccountType.ADMIN,
      status: AccountStatus.ACTIVE,
      OR: [
        { name: { contains: 'ops', mode: 'insensitive' } },
        { email: { contains: 'ops', mode: 'insensitive' } },
      ],
    };
    expect(user.count).toHaveBeenCalledWith({ where });
    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [
          { name: 'asc' },
          { email: 'asc' },
          { id: 'asc' },
        ],
        skip: 25,
        take: 25,
      }),
    );
  });

  it('returns a lifecycle update through a direct Admin account read', async () => {
    const adminView = {
      id: 'admin-2',
      email: 'ops@example.com',
      name: 'Operations Admin',
      status: AccountStatus.SUSPENDED,
      createdAt: now,
      updatedAt: now,
      adminCredential: {
        mfaEnrolledAt: now,
        lockedUntil: null,
      },
      userRoles: [],
      sessions: [],
    };
    user.findFirst
      .mockResolvedValueOnce({
        id: 'admin-2',
        status: AccountStatus.ACTIVE,
        adminCredential: { mfaEnrolledAt: now },
      })
      .mockResolvedValueOnce(adminView);
    user.update.mockResolvedValue({ id: 'admin-2' });
    session.updateMany.mockResolvedValue({ count: 2 });
    const listSpy = vi.spyOn(service, 'listAdminAccounts');

    await expect(
      service.updateAdminAccountStatus(
        'admin-2',
        { status: AccountStatus.SUSPENDED },
        'admin-1',
      ),
    ).resolves.toMatchObject({
      id: 'admin-2',
      status: AccountStatus.SUSPENDED,
      mfaEnrolled: true,
    });

    expect(listSpy).not.toHaveBeenCalled();
    expect(user.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'admin-2', accountType: AccountType.ADMIN },
      }),
    );
  });

  it('provisions only the fixed platform Admin role and stores a token hash', async () => {
    crypto.randomToken.mockReturnValue('raw-activation-token');
    role.findUnique.mockResolvedValue({ id: 'platform-admin-role' });
    user.findFirst.mockResolvedValue(null);
    user.create.mockResolvedValue({ id: 'admin-1' });
    userRole.upsert.mockResolvedValue({});
    adminAuthChallenge.deleteMany.mockResolvedValue({ count: 0 });
    adminCredential.deleteMany.mockResolvedValue({ count: 0 });
    adminProvisioningToken.updateMany.mockResolvedValue({ count: 0 });
    adminProvisioningToken.create.mockResolvedValue({ id: 'provisioning-1' });

    const result = await service.provisionAdmin(
      { email: 'ADMIN@example.com', name: ' Platform Admin ' },
      null,
    );

    expect(result.activationToken).toBe('raw-activation-token');
    expect(user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          accountType: AccountType.ADMIN,
          status: AccountStatus.PROVISIONED,
        }),
      }),
    );
    expect(userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ roleId: 'platform-admin-role' }),
      }),
    );
    expect(adminProvisioningToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: 'hash:raw-activation-token',
        }),
      }),
    );
    expect(
      JSON.stringify(adminProvisioningToken.create.mock.calls),
    ).not.toContain('"raw-activation-token"');
  });

  it('starts enrollment with an encrypted seed and a hashed challenge', async () => {
    crypto.generateMfaSecret.mockReturnValue('BASE32SECRET');
    crypto.encryptMfaSecret.mockReturnValue({
      ciphertext: 'encrypted',
      nonce: 'nonce',
      authTag: 'tag',
    });
    crypto.hashPassword.mockResolvedValue('password-hash');
    crypto.randomToken.mockReturnValue('enrollment-challenge');
    crypto.buildTotpUri.mockReturnValue('otpauth://totp/example');
    adminProvisioningToken.findUnique.mockResolvedValue({
      id: 'provisioning-1',
      userId: 'admin-1',
      tokenHash: 'hash:activation',
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
      failedAttempts: 0,
      createdAt: now,
      user: { ...activeAdmin, status: AccountStatus.PROVISIONED },
    });
    adminProvisioningToken.findFirst.mockResolvedValue({
      id: 'provisioning-1',
    });
    adminCredential.upsert.mockResolvedValue({});
    adminAuthChallenge.updateMany.mockResolvedValue({ count: 0 });
    adminAuthChallenge.create.mockResolvedValue({ id: 'challenge-1' });

    const result = await service.beginActivation(
      { activationToken: 'activation', password: 'a secure password' },
      context,
    );

    expect(result).toMatchObject({
      secret: 'BASE32SECRET',
      challengeToken: 'enrollment-challenge',
    });
    expect(adminCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          passwordHash: 'password-hash',
          mfaSecretCiphertext: 'encrypted',
        }),
      }),
    );
    expect(adminAuthChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: 'hash:enrollment-challenge',
        }),
      }),
    );
  });

  it('activates a provisioned Admin only after claiming a valid enrollment TOTP', async () => {
    const challenge = {
      id: 'enrollment-1',
      userId: 'admin-1',
      provisioningTokenId: 'provisioning-1',
      type: AdminAuthChallengeType.MFA_ENROLLMENT,
      tokenHash: 'hash:enrollment-challenge',
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
      failedAttempts: 0,
      createdAt: now,
      provisioningToken: {
        id: 'provisioning-1',
        userId: 'admin-1',
        tokenHash: 'hash:activation',
        expiresAt: new Date(now.getTime() + 60_000),
        consumedAt: null,
        failedAttempts: 0,
        createdAt: now,
      },
      user: {
        ...activeAdmin,
        status: AccountStatus.PROVISIONED,
        adminCredential: { ...credential, mfaEnrolledAt: null },
      },
    };
    adminAuthChallenge.findUnique.mockResolvedValue(challenge);
    crypto.decryptMfaSecret.mockReturnValue('BASE32SECRET');
    crypto.verifyTotp.mockReturnValue(11n);
    adminAuthChallenge.updateMany.mockResolvedValue({ count: 1 });
    user.updateMany.mockResolvedValue({ count: 1 });
    adminProvisioningToken.updateMany.mockResolvedValue({ count: 1 });
    adminCredential.update.mockResolvedValue({});

    await service.verifyActivation(
      { challengeToken: 'enrollment-challenge', code: '123456' },
      context,
    );

    expect(user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: AccountStatus.ACTIVE } }),
    );
    expect(adminProvisioningToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumedAt: now } }),
    );
    expect(adminCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mfaEnrolledAt: now,
          lastTotpCounter: 11n,
        }),
      }),
    );
  });

  it('consumes enrollment state at the configured TOTP attempt limit', async () => {
    const challenge = {
      id: 'enrollment-1',
      userId: 'admin-1',
      provisioningTokenId: 'provisioning-1',
      type: AdminAuthChallengeType.MFA_ENROLLMENT,
      tokenHash: 'hash:enrollment-challenge',
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
      failedAttempts: 4,
      createdAt: now,
      provisioningToken: {
        id: 'provisioning-1',
        userId: 'admin-1',
        tokenHash: 'hash:activation',
        expiresAt: new Date(now.getTime() + 60_000),
        consumedAt: null,
        failedAttempts: 4,
        createdAt: now,
      },
      user: {
        ...activeAdmin,
        status: AccountStatus.PROVISIONED,
        adminCredential: { ...credential, mfaEnrolledAt: null },
      },
    };
    adminAuthChallenge.findUnique.mockResolvedValue(challenge);
    crypto.decryptMfaSecret.mockReturnValue('BASE32SECRET');
    crypto.verifyTotp.mockReturnValue(null);
    adminAuthChallenge.updateMany.mockResolvedValue({ count: 1 });
    adminProvisioningToken.update.mockResolvedValue({});

    await expect(
      service.verifyActivation(
        { challengeToken: 'enrollment-challenge', code: '000000' },
        context,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ADMIN_ACTIVATION_REJECTED' },
    });
    expect(adminProvisioningToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          failedAttempts: { increment: 1 },
          consumedAt: now,
        },
      }),
    );
  });

  it('returns the same generic login failure for an unknown identity', async () => {
    user.findFirst.mockResolvedValue(null);
    crypto.hashPassword.mockResolvedValue('dummy-hash');

    await expect(
      service.login(
        { email: 'missing@example.com', password: 'wrong password' },
        context,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ADMIN_AUTHENTICATION_FAILED' },
    });
    expect(crypto.hashPassword).toHaveBeenCalledWith('wrong password');
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: null }),
      }),
    );
  });

  it('issues only an MFA challenge after a valid password', async () => {
    user.findFirst.mockResolvedValue(activeAdmin);
    crypto.verifyPassword.mockResolvedValue(true);
    crypto.randomToken.mockReturnValue('login-challenge');
    adminAuthChallenge.updateMany.mockResolvedValue({ count: 0 });
    adminAuthChallenge.create.mockResolvedValue({ id: 'challenge-1' });
    adminCredential.update.mockResolvedValue({});

    const result = await service.login(
      { email: 'admin@example.com', password: 'valid password' },
      context,
    );

    expect(result.challengeToken).toBe('login-challenge');
    expect(sessions.issueSession).not.toHaveBeenCalled();
    expect(adminAuthChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AdminAuthChallengeType.LOGIN,
          tokenHash: 'hash:login-challenge',
        }),
      }),
    );
  });

  it('claims a TOTP exactly once before issuing an MFA-backed session', async () => {
    const challenge = {
      id: 'challenge-1',
      userId: 'admin-1',
      provisioningTokenId: null,
      type: AdminAuthChallengeType.LOGIN,
      tokenHash: 'hash:login-challenge',
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
      failedAttempts: 0,
      createdAt: now,
      provisioningToken: null,
      user: activeAdmin,
    };
    adminAuthChallenge.findUnique.mockResolvedValue(challenge);
    crypto.decryptMfaSecret.mockReturnValue('BASE32SECRET');
    crypto.verifyTotp.mockReturnValue(11n);
    adminAuthChallenge.updateMany.mockResolvedValue({ count: 1 });
    adminCredential.update.mockResolvedValue({});
    sessions.issueSession.mockResolvedValue({
      token: 'access-token',
      expiresAt: new Date(now.getTime() + 30_000),
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date(now.getTime() + 3_600_000),
    });

    const result = await service.verifyLoginMfa(
      { challengeToken: 'login-challenge', code: '123456' },
      context,
    );

    expect(result.accessToken).toBe('access-token');
    expect(adminAuthChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumedAt: now } }),
    );
    expect(adminCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastTotpCounter: 11n }),
      }),
    );
    expect(sessions.issueSession).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({ mfaVerified: true }),
    );
  });

  it('consumes a challenge and locks the account at the MFA attempt limit', async () => {
    const challenge = {
      id: 'challenge-1',
      userId: 'admin-1',
      provisioningTokenId: null,
      type: AdminAuthChallengeType.LOGIN,
      tokenHash: 'hash:login-challenge',
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
      failedAttempts: 4,
      createdAt: now,
      provisioningToken: null,
      user: {
        ...activeAdmin,
        adminCredential: { ...credential, failedMfaAttempts: 4 },
      },
    };
    adminAuthChallenge.findUnique.mockResolvedValue(challenge);
    crypto.decryptMfaSecret.mockReturnValue('BASE32SECRET');
    crypto.verifyTotp.mockReturnValue(null);
    adminAuthChallenge.updateMany.mockResolvedValue({ count: 1 });
    adminCredential.update.mockResolvedValue({});
    session.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.verifyLoginMfa(
        { challengeToken: 'login-challenge', code: '000000' },
        context,
      ),
    ).rejects.toMatchObject({ response: { code: 'ADMIN_MFA_FAILED' } });
    expect(adminAuthChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedAttempts: 5, consumedAt: now }),
      }),
    );
    expect(session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { revokedAt: now } }),
    );
  });
});
