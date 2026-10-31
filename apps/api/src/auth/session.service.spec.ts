import { AccountStatus, AccountType } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  const session = {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const user = { findUnique: vi.fn() };
  const auditLog = { create: vi.fn() };
  const database = {
    session,
    user,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ session, auditLog }),
    ),
  };
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost/lemekinaye');
    vi.stubEnv(
      'AUTH_MFA_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64'),
    );
    vi.stubEnv('AUTH_SESSION_TTL_MINUTES', '1440');
    vi.stubEnv('AUTH_ADMIN_SESSION_TTL_MINUTES', '30');
    service = new SessionService(database as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves active sessions into deduplicated roles and permissions', async () => {
    session.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      mfaVerifiedAt: new Date(),
      user: {
        id: 'user-1',
        accountType: AccountType.ADMIN,
        status: AccountStatus.ACTIVE,
        userRoles: [
          {
            role: {
              key: 'platform-admin',
              rolePermissions: [
                { permission: { key: 'admin.portal.access' } },
                { permission: { key: 'catalog.manage' } },
              ],
            },
          },
          {
            role: {
              key: 'admin-staff',
              rolePermissions: [{ permission: { key: 'admin.portal.access' } }],
            },
          },
        ],
      },
    });
    session.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.authenticateToken('opaque-token')).resolves.toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
      accountType: AccountType.ADMIN,
      status: AccountStatus.ACTIVE,
      roles: ['platform-admin', 'admin-staff'],
      permissions: ['admin.portal.access', 'catalog.manage'],
    });
    expect(session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      }),
    );
  });

  it.each([
    [
      'revoked',
      new Date(),
      new Date(Date.now() + 60_000),
      AccountStatus.ACTIVE,
    ],
    ['expired', null, new Date(Date.now() - 1), AccountStatus.ACTIVE],
    ['suspended', null, new Date(Date.now() + 60_000), AccountStatus.SUSPENDED],
  ])('rejects a %s session', async (_name, revokedAt, expiresAt, status) => {
    session.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt,
      revokedAt,
      user: { status },
    });

    await expect(service.authenticateToken('opaque-token')).resolves.toBeNull();
    expect(session.updateMany).not.toHaveBeenCalled();
  });

  it('issues a short-lived Admin session without storing the raw token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T16:00:00.000Z'));
    user.findUnique.mockResolvedValue({
      accountType: AccountType.ADMIN,
      status: AccountStatus.ACTIVE,
    });
    session.create.mockResolvedValue({});
    auditLog.create.mockResolvedValue({});

    const issued = await service.issueSession('user-1', { mfaVerified: true });

    expect(issued.expiresAt).toEqual(new Date('2026-09-23T16:30:00.000Z'));
    const createInput = session.create.mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };
    expect(createInput.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createInput.data.tokenHash).not.toBe(issued.token);
    expect(issued.refreshToken).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(createInput.data).toMatchObject({
      refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      mfaVerifiedAt: expect.any(Date),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTH_SESSION_CREATED' }),
      }),
    );
  });

  it('refuses to issue an Admin session without verified MFA', async () => {
    user.findUnique.mockResolvedValue({
      accountType: AccountType.ADMIN,
      status: AccountStatus.ACTIVE,
    });

    await expect(service.issueSession('admin-1')).rejects.toMatchObject({
      response: { code: 'MFA_REQUIRED' },
    });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a legacy Admin session without an MFA verification marker', async () => {
    session.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      mfaVerifiedAt: null,
      user: {
        accountType: AccountType.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });

    await expect(service.authenticateToken('legacy-token')).resolves.toBeNull();
    expect(session.updateMany).not.toHaveBeenCalled();
  });

  it('atomically rotates both Admin session credentials', async () => {
    const absoluteExpiry = new Date(Date.now() + 3_600_000);
    session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'admin-1',
      revokedAt: null,
      refreshExpiresAt: absoluteExpiry,
      mfaVerifiedAt: new Date(),
      user: {
        accountType: AccountType.ADMIN,
        status: AccountStatus.ACTIVE,
      },
    });
    session.updateMany.mockResolvedValue({ count: 1 });
    auditLog.create.mockResolvedValue({});

    const rotated = await service.rotateAdminSession('old-refresh-token');

    expect(rotated.refreshToken).not.toBe('old-refresh-token');
    expect(rotated.refreshExpiresAt).toEqual(absoluteExpiry);
    expect(session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
        data: expect.objectContaining({
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
      }),
    );
  });

  it('revokes only the caller session and records an audit event', async () => {
    session.updateMany.mockResolvedValue({ count: 1 });
    auditLog.create.mockResolvedValue({});

    await service.revokeSession('session-1', 'user-1');

    expect(session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1', userId: 'user-1', revokedAt: null },
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTH_SESSION_REVOKED' }),
      }),
    );
  });

  it('revokes by a valid refresh credential without exposing lookup state', async () => {
    session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
    });
    session.updateMany.mockResolvedValue({ count: 1 });
    auditLog.create.mockResolvedValue({});

    await expect(service.revokeByRefreshToken('refresh-token')).resolves.toBe(
      true,
    );
    expect(session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u) },
      }),
    );
  });

  it('treats an unknown refresh credential as an idempotent no-op', async () => {
    session.findUnique.mockResolvedValue(null);

    await expect(service.revokeByRefreshToken('unknown-token')).resolves.toBe(
      false,
    );
    expect(auditLog.create).not.toHaveBeenCalled();
  });
});
