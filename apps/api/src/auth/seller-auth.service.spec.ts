import {
  AccountStatus,
  AccountType,
  SellerApprovalStatus,
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { AdminAuthCrypto } from './admin-auth.crypto.js';
import type { AuthThrottleService } from './auth-throttle.service.js';
import type { SessionService } from './session.service.js';
import { SellerAuthService } from './seller-auth.service.js';

describe('SellerAuthService', () => {
  const user = {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const seller = {
    create: vi.fn(),
    update: vi.fn(),
  };
  const sellerCredential = {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  };
  const sellerProvisioningToken = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    user,
    seller,
    sellerCredential,
    sellerProvisioningToken,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          user,
          seller,
          sellerCredential,
          sellerProvisioningToken,
          auditLog,
        }),
    ),
  };

  const crypto = {
    randomToken: vi.fn(() => 'x'.repeat(43)),
    hashToken: vi.fn(() => 'a'.repeat(64)),
    hashPassword: vi.fn(async () => 'password-hash'),
    verifyPassword: vi.fn(async () => true),
  };

  const throttles = {
    consume: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    sourceHash: vi.fn(() => 'source-hash'),
  };

  const sessions = {
    issueSession: vi.fn(async () => ({
      token: 'seller-access-token',
      expiresAt: new Date('2026-10-02T08:00:00.000Z'),
    })),
  };

  const service = new SellerAuthService(
    database as unknown as DatabaseService,
    crypto as unknown as AdminAuthCrypto,
    throttles as unknown as AuthThrottleService,
    sessions as unknown as SessionService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const sellerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeEach(() => {
    // Unit tests validate service behavior with mocked database calls. Supply
    // syntactically valid, nonfunctional configuration; never connect to it.
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@127.0.0.1:5432/seller_auth_unit_test');
    vi.stubEnv('AUTH_MFA_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
    vi.clearAllMocks();
    user.findFirst.mockResolvedValue(null);
    user.create.mockResolvedValue({ id: userId });
    seller.create.mockResolvedValue({ id: sellerId });
    sellerCredential.deleteMany.mockResolvedValue({ count: 0 });
    sellerProvisioningToken.updateMany.mockResolvedValue({ count: 0 });
    sellerProvisioningToken.create.mockResolvedValue({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    sellerCredential.upsert.mockResolvedValue({});
    sellerCredential.update.mockResolvedValue({});
    auditLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('provisions a restricted Seller identity and one-time activation token', async () => {
    const result = await service.provisionSeller(
      {
        name: 'Demo Seller Owner',
        phone: '+251911223344',
        email: 'SELLER@example.com',
        sellerCode: ' sel-001 ',
        businessName: ' Demo Auto Parts ',
        displayName: ' Demo Auto ',
        sellerType: SellerType.RETAILER,
      },
      actorId,
    );

    expect(user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountType: AccountType.SELLER,
          status: AccountStatus.PROVISIONED,
          phone: '+251911223344',
          email: 'seller@example.com',
        }),
      }),
    );
    expect(seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          sellerCode: 'SEL-001',
        }),
      }),
    );
    expect(result).toMatchObject({ userId, sellerId });
    expect(result.activationToken).toHaveLength(43);
  });

  it('activates Seller credentials without bypassing Admin approval', async () => {
    sellerProvisioningToken.findUnique.mockResolvedValue({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      userId,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      failedAttempts: 0,
      user: {
        id: userId,
        accountType: AccountType.SELLER,
        status: AccountStatus.PROVISIONED,
        sellerProfile: {
          id: sellerId,
          status: SellerStatus.APPLICATION,
        },
      },
    });
    sellerProvisioningToken.updateMany.mockResolvedValue({ count: 1 });

    await service.activateSeller(
      {
        activationToken: 'x'.repeat(43),
        password: 'strong-password-123',
      },
      { sourceIp: '127.0.0.1', userAgent: 'vitest' },
    );

    expect(sellerCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId,
          passwordHash: 'password-hash',
        }),
      }),
    );
    expect(user.update).not.toHaveBeenCalled();
    expect(throttles.reset).toHaveBeenCalledWith(
      'seller-activation',
      '127.0.0.1',
    );
  });

  it('activates an approved and verified Seller after credentials are set', async () => {
    sellerProvisioningToken.findUnique.mockResolvedValue({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      userId,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      failedAttempts: 0,
      user: {
        id: userId,
        accountType: AccountType.SELLER,
        status: AccountStatus.PROVISIONED,
        sellerProfile: {
          id: sellerId,
          status: SellerStatus.APPLICATION,
          approvalStatus: SellerApprovalStatus.APPROVED,
          verificationStatus: SellerVerificationStatus.VERIFIED,
        },
      },
    });
    sellerProvisioningToken.updateMany.mockResolvedValue({ count: 1 });

    await service.activateSeller({
      activationToken: 'x'.repeat(43),
      password: 'strong-password-123',
    }, { sourceIp: '127.0.0.1' });

    expect(seller.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: SellerStatus.ACTIVE }),
    }));
    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: AccountStatus.ACTIVE },
    }));
  });

  it('allows a verified Seller to login without Admin business approval', async () => {
    user.findFirst.mockResolvedValue({
      id: userId,
      accountType: AccountType.SELLER,
      emailVerifiedAt: new Date('2026-10-01'),
      status: AccountStatus.ACTIVE,
      sellerCredential: {
        passwordHash: 'password-hash',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      sellerProfile: null,
    });

    await expect(service.login(
      { identifier: 'seller@example.com', password: 'strong-password-123' },
      { sourceIp: '127.0.0.1' },
    )).resolves.toMatchObject({ accessToken: 'seller-access-token' });

    expect(sessions.issueSession).toHaveBeenCalledWith(userId, expect.any(Object));
  });

  it('blocks email-unverified Seller accounts from logging in', async () => {
    user.findFirst.mockResolvedValue({
      id: userId,
      accountType: AccountType.SELLER,
      emailVerifiedAt: null,
      status: AccountStatus.PROVISIONED,
      sellerCredential: {
        passwordHash: 'password-hash',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      sellerProfile: null,
    });

    await expect(service.login(
      { identifier: 'seller@example.com', password: 'strong-password-123' },
      { sourceIp: '127.0.0.1' },
    )).rejects.toMatchObject({ status: 401 });
    expect(sessions.issueSession).not.toHaveBeenCalled();
  });

  it('issues a session only for an approved operational Seller', async () => {
    user.findFirst.mockResolvedValue({
      id: userId,
      status: AccountStatus.ACTIVE,
      sellerCredential: {
        passwordHash: 'password-hash',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      sellerProfile: {
        id: sellerId,
        status: SellerStatus.ACTIVE,
        verificationStatus: SellerVerificationStatus.VERIFIED,
        approvalStatus: SellerApprovalStatus.APPROVED,
      },
    });

    const result = await service.login(
      {
        identifier: '+251911223344',
        password: 'strong-password-123',
      },
      { sourceIp: '127.0.0.1', userAgent: 'vitest' },
    );

    expect(crypto.verifyPassword).toHaveBeenCalledWith(
      'strong-password-123',
      'password-hash',
    );
    expect(sessions.issueSession).toHaveBeenCalledWith(userId, {
      sourceIp: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(result.accessToken).toBe('seller-access-token');
  });
});
