import { AccountStatus, AccountType } from '@prisma/client';
import { afterEach, describe, beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { EmailService } from '../common/email/email.service.js';
import type { AdminAuthCrypto } from './admin-auth.crypto.js';
import type { AuthThrottleService } from './auth-throttle.service.js';
import { SellerAccountRegistrationService } from './seller-account-registration.service.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const source = '127.0.0.1';

function setup() {
  const tx = {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: userId }),
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ email: 'seller@example.com' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    seller: { update: vi.fn().mockResolvedValue({}) },
    sellerApplication: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sellerEmailVerificationToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    ...tx,
    user: { ...tx.user, findFirst: tx.user.findFirst },
    sellerEmailVerificationToken: {
      ...tx.sellerEmailVerificationToken,
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  } as unknown as DatabaseService;
  const crypto = {
    randomToken: vi.fn(() => 'a'.repeat(43)),
    hashToken: vi.fn(() => 'b'.repeat(64)),
    hashPassword: vi.fn().mockResolvedValue('secure-scrypt-hash'),
  } as unknown as AdminAuthCrypto;
  const throttles = {
    consume: vi.fn().mockResolvedValue(undefined),
    sourceHash: vi.fn(() => 'hashed-ip'),
  } as unknown as AuthThrottleService;
  const email = {
    isConfigured: true,
    send: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailService;
  const service = new SellerAccountRegistrationService(database, crypto, throttles, email);
  return { service, database, tx, email };
}

describe('Seller account-first verification', () => {
  beforeEach(() => {
    vi.stubEnv('SELLER_APP_ORIGIN', 'http://localhost:3002');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a provisioned account with hashed password and token and emails a safe fragment link', async () => {
    const { service, tx, email } = setup();
    await service.register({
      email: 'SELLER@example.com',
      password: 'strong-password-123',
    }, source);

    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'seller@example.com',
        accountType: AccountType.SELLER,
        status: AccountStatus.PROVISIONED,
        sellerCredential: { create: expect.objectContaining({ passwordHash: 'secure-scrypt-hash' }) },
        sellerEmailVerifications: {
          create: expect.objectContaining({ tokenHash: 'b'.repeat(64) }),
        },
      }),
      select: { id: true },
    });
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({
      template: 'seller-email-verification',
      toEmail: 'seller@example.com',
      data: expect.objectContaining({
        verificationUrl: `http://localhost:3002/verify-email#token=${'a'.repeat(43)}`,
      }),
    }));
  });

  it('does not reveal or re-create an already registered account', async () => {
    const { service, tx, email } = setup();
    tx.user.findFirst.mockResolvedValue({
      id: userId,
      accountType: AccountType.SELLER,
      status: AccountStatus.ACTIVE,
      sellerCredential: { userId },
    });
    await expect(service.register({
      email: 'seller@example.com',
      password: 'strong-password-123',
    }, source)).resolves.toBeUndefined();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('allows a provisioned legacy Seller to set a password by verifying their existing email', async () => {
    const { service, tx, email } = setup();
    tx.user.findFirst.mockResolvedValue({
      id: userId,
      accountType: AccountType.SELLER,
      status: AccountStatus.PROVISIONED,
      sellerCredential: null,
    });
    await service.register({
      email: 'seller@example.com',
      password: 'strong-password-123',
    }, source);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({
        sellerCredential: { create: expect.any(Object) },
      }),
    }));
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('atomically consumes one token and activates a verified Seller without an application', async () => {
    const { service, database, tx } = setup();
    const verification = database.sellerEmailVerificationToken as unknown as {
      findUnique: ReturnType<typeof vi.fn>;
    };
    verification.findUnique.mockResolvedValue({
      id: 'token-id',
      userId,
      consumedAt: null,
      expiresAt: new Date('2099-01-01'),
      user: {
        accountType: AccountType.SELLER,
        status: AccountStatus.PROVISIONED,
        emailVerifiedAt: null,
        sellerProfile: null,
      },
    });
    await service.verify('a'.repeat(43), source);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, status: AccountStatus.PROVISIONED, emailVerifiedAt: null },
      data: { status: AccountStatus.ACTIVE, emailVerifiedAt: expect.any(Date) },
    });
    expect(tx.sellerApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerUserId: null }),
      data: { ownerUserId: userId },
    }));
  });

  it('rejects used tokens and never activates an account', async () => {
    const { service, database, tx } = setup();
    const verification = database.sellerEmailVerificationToken as unknown as {
      findUnique: ReturnType<typeof vi.fn>;
    };
    verification.findUnique.mockResolvedValue({
      id: 'token-id',
      userId,
      consumedAt: new Date(),
      expiresAt: new Date('2099-01-01'),
      user: {
        accountType: AccountType.SELLER,
        status: AccountStatus.PROVISIONED,
        emailVerifiedAt: null,
        sellerProfile: null,
      },
    });
    await expect(service.verify('a'.repeat(43), source)).rejects.toMatchObject({
      response: { code: 'SELLER_VERIFICATION_INVALID' },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('does not leave an account falsely reported as emailed when SMTP fails', async () => {
    const { service, email } = setup();
    vi.mocked(email.send).mockRejectedValue(new Error('SMTP offline'));
    await expect(service.register({
      email: 'seller@example.com',
      password: 'strong-password-123',
    }, source)).rejects.toMatchObject({
      response: { code: 'SELLER_VERIFICATION_EMAIL_FAILED' },
    });
  });
});
