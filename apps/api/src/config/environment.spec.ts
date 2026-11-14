import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  const mfaKey = Buffer.alloc(32, 7).toString('base64');

  it('parses a valid environment and applies defaults', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://user:pass@localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: mfaKey,
      }),
    ).toEqual({
      databaseUrl: 'postgresql://user:pass@localhost/app',
      nodeEnv: 'development',
      port: 5000,
      authSessionTtlMinutes: 1440,
      authAdminSessionTtlMinutes: 30,
      authAdminRefreshTtlMinutes: 480,
      authAdminActivationTtlMinutes: 1440,
      authAdminChallengeTtlMinutes: 5,
      authAdminMaxAttempts: 5,
      authAdminLockMinutes: 15,
      authAdminIpMaxAttempts: 20,
      authAdminIpWindowMinutes: 15,
      authSellerActivationTtlMinutes: 1440,
      authSellerMaxAttempts: 5,
      authSellerLockMinutes: 15,
      sellerDocumentStoragePath: '.private/seller-documents',
      authMfaEncryptionKey: Buffer.alloc(32, 7),
    });
  });

  it.each([
    [{}, 'DATABASE_URL is required'],
    [
      { DATABASE_URL: 'postgresql://localhost/app' },
      'AUTH_MFA_ENCRYPTION_KEY is required',
    ],
    [
      { DATABASE_URL: 'not-a-url', AUTH_MFA_ENCRYPTION_KEY: mfaKey },
      'valid PostgreSQL',
    ],
    [
      {
        DATABASE_URL: 'mysql://localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: mfaKey,
      },
      'postgresql://',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: mfaKey,
        PORT: '0',
      },
      'PORT',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: mfaKey,
        AUTH_SESSION_TTL_MINUTES: '0',
      },
      'AUTH_SESSION_TTL_MINUTES',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: mfaKey,
        AUTH_ADMIN_SESSION_TTL_MINUTES: 'invalid',
      },
      'AUTH_ADMIN_SESSION_TTL_MINUTES',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: 'not-a-key',
      },
      'AUTH_MFA_ENCRYPTION_KEY',
    ],
    [
      {
        DATABASE_URL: 'postgresql://localhost/app',
        AUTH_MFA_ENCRYPTION_KEY: mfaKey,
        AUTH_ADMIN_SESSION_TTL_MINUTES: '30',
        AUTH_ADMIN_REFRESH_TTL_MINUTES: '30',
      },
      'AUTH_ADMIN_REFRESH_TTL_MINUTES',
    ],
  ])('rejects unsafe configuration', (environment, message) => {
    expect(() => validateEnvironment(environment)).toThrow(message);
  });
});
