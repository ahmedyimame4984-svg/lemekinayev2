import type { DatabaseService } from '../database/database.service.js';
import { AdminAuthCrypto } from './admin-auth.crypto.js';
import { AuthThrottleService } from './auth-throttle.service.js';

describe('AuthThrottleService', () => {
  const authThrottle = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };
  const database = {
    authThrottle,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ authThrottle }),
    ),
  };
  let service: AuthThrottleService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost/lemekinaye');
    vi.stubEnv(
      'AUTH_MFA_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64'),
    );
    service = new AuthThrottleService(
      database as unknown as DatabaseService,
      new AdminAuthCrypto(),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts a persistent source bucket without storing the source value', async () => {
    authThrottle.findUnique.mockResolvedValue(null);
    authThrottle.upsert.mockResolvedValue({});

    await service.consume('admin-login', '203.0.113.8');

    expect(database.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: 'Serializable',
        maxWait: 10_000,
      }),
    );
    expect(authThrottle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          keyHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          attempts: 1,
        }),
      }),
    );
    expect(JSON.stringify(authThrottle.upsert.mock.calls)).not.toContain(
      '203.0.113.8',
    );
  });

  it('blocks attempts beyond the configured source limit', async () => {
    authThrottle.findUnique.mockResolvedValue({
      keyHash: 'a'.repeat(64),
      action: 'admin-login',
      attempts: 20,
      windowStartedAt: new Date(),
      blockedUntil: null,
    });
    authThrottle.update.mockResolvedValue({});

    await expect(
      service.consume('admin-login', '203.0.113.8'),
    ).rejects.toMatchObject({
      status: 429,
      response: expect.objectContaining({ code: 'AUTH_RATE_LIMITED' }),
    });
    expect(authThrottle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: 21 }),
      }),
    );
  });

  it('clears only the matching action and source bucket', async () => {
    authThrottle.deleteMany.mockResolvedValue({ count: 1 });

    await service.reset('admin-login', '203.0.113.8');

    expect(authThrottle.deleteMany).toHaveBeenCalledWith({
      where: { keyHash: expect.stringMatching(/^[a-f0-9]{64}$/u) },
    });
  });
});
