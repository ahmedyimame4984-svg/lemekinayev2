import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SellerR2StorageService } from './seller-r2-storage.service.js';

const key = 'seller-listings/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.webp';

describe('Cloudflare R2 SigV4 signed upload contract', () => {
  const storage = new SellerR2StorageService();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T12:30:00.000Z'));
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('CLOUDFLARE_ACCESS_KEY_ID', 'CFTESTACCESSKEY');
    vi.stubEnv('CLOUDFLARE_SECRET_ACCESS_KEY', 'test-secret-not-for-real-use');
    vi.stubEnv('CLOUDFLARE_R2_BUCKET_NAME', 'test-bucket');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('issues an expiring path-style signed URL restricted to the exact PUT Content-Type', () => {
    const signed = new URL(storage.sign(key, 'PUT', 300, 'image/webp'));
    expect(signed.origin).toBe('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
    expect(signed.pathname).toBe('/test-bucket/' + key);
    expect(signed.searchParams.get('X-Amz-Date')).toBe('20261027T123000Z');
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(signed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(signed.searchParams.get('X-Amz-Content-Sha256')).toBe('UNSIGNED-PAYLOAD');
    expect(signed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.href).not.toContain('test-secret-not-for-real-use');
  });

  it('does not reuse a PUT signature for read-only previews', () => {
    const put = storage.sign(key, 'PUT', 60, 'image/webp');
    const get = storage.sign(key, 'GET', 60);
    const head = storage.sign(key, 'HEAD', 60);
    expect(new URL(get).searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(put).not.toBe(get);
    expect(head).not.toBe(get);
  });

  it('rejects untrusted storage paths, extended lifetimes and missing configuration', () => {
    expect(() => storage.sign('../secrets.json', 'GET', 60)).toThrow('Invalid server-managed');
    expect(() => storage.sign(key, 'PUT', 601, 'image/webp')).toThrow('lifetime');
    vi.stubEnv('CLOUDFLARE_SECRET_ACCESS_KEY', '');
    expect(() => storage.sign(key, 'PUT', 60, 'image/webp')).toThrow('not configured');
  });
});
