import { AdminAuthCrypto } from './admin-auth.crypto.js';

describe('AdminAuthCrypto', () => {
  let crypto: AdminAuthCrypto;

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost/lemekinaye');
    vi.stubEnv(
      'AUTH_MFA_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64'),
    );
    crypto = new AdminAuthCrypto();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hashes passwords with scrypt and verifies them in constant-time form', async () => {
    const encoded = await crypto.hashPassword('correct horse battery staple');

    expect(encoded).toMatch(/^\$scrypt\$n=32768,r=8,p=1\$/u);
    expect(encoded).not.toContain('correct horse battery staple');
    await expect(
      crypto.verifyPassword('correct horse battery staple', encoded),
    ).resolves.toBe(true);
    await expect(
      crypto.verifyPassword('wrong password', encoded),
    ).resolves.toBe(false);
  });

  it('encrypts MFA seeds with authenticated encryption', () => {
    const encrypted = crypto.encryptMfaSecret('JBSWY3DPEHPK3PXP');

    expect(encrypted.ciphertext).not.toContain('JBSWY3DPEHPK3PXP');
    expect(crypto.decryptMfaSecret(encrypted)).toBe('JBSWY3DPEHPK3PXP');
    expect(() =>
      crypto.decryptMfaSecret({
        ...encrypted,
        authTag: 'AAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).toThrow();
  });

  it('matches the first RFC 6238 SHA-1 test vector', () => {
    const secret = crypto.encodeBase32(
      Buffer.from('12345678901234567890', 'ascii'),
    );

    expect(crypto.generateTotp(secret, 59_000, 8)).toBe('94287082');
  });

  it('accepts a small clock window but rejects TOTP replay', () => {
    const secret = crypto.generateMfaSecret();
    const timestamp = 1_800_000;
    const code = crypto.generateTotp(secret, timestamp);
    const counter = crypto.verifyTotp(secret, code, null, timestamp + 30_000);

    expect(counter).toBe(60n);
    expect(crypto.verifyTotp(secret, code, counter, timestamp)).toBeNull();
  });

  it('builds a standards-compatible authenticator provisioning URI', () => {
    const uri = new URL(
      crypto.buildTotpUri('admin@example.com', 'JBSWY3DPEHPK3PXP'),
    );

    expect(uri.protocol).toBe('otpauth:');
    expect(uri.searchParams.get('issuer')).toBe('Lemekinaye Admin');
    expect(uri.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(uri.searchParams.get('period')).toBe('30');
  });
});
