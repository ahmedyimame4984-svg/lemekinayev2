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

  describe('verifyUploaded', () => {
    it('verifies WebP with odd-byte RIFF chunk padding', async () => {
      const expectedSize = 1001; // odd length
      const riffPayloadSize = expectedSize - 9; // odd payload excludes trailing 1-byte padding
      const sigBuf = Buffer.alloc(32);
      sigBuf.write('RIFF', 0, 'ascii');
      sigBuf.writeUInt32LE(riffPayloadSize, 4);
      sigBuf.write('WEBP', 8, 'ascii');

      const tailBuf = Buffer.alloc(64);

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const method = (init as any)?.method || 'GET';
        if (method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'content-type': 'image/webp; charset=binary',
              'content-length': String(expectedSize),
            },
          });
        }
        const range = (init as any)?.headers?.Range || '';
        if (range === 'bytes=0-31') {
          return new Response(sigBuf, { status: 206 });
        }
        return new Response(tailBuf, { status: 206 });
      });

      await expect(storage.verifyUploaded(key, 'image/webp', expectedSize)).resolves.toBeUndefined();
      fetchMock.mockRestore();
    });

    it('verifies JPEG with trailing padding bytes after EOI marker', async () => {
      const expectedSize = 2048;
      const sigBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(28).fill(0)]);
      // Tail has FF D9 followed by trailing null and newline padding bytes
      const tailBuf = Buffer.from([...Array(30).fill(0), 0xff, 0xd9, 0x00, 0x0a]);

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const method = (init as any)?.method || 'GET';
        if (method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'content-type': 'IMAGE/JPEG',
              'content-length': String(expectedSize),
            },
          });
        }
        const range = (init as any)?.headers?.Range || '';
        if (range === 'bytes=0-31') {
          return new Response(sigBuf, { status: 206 });
        }
        return new Response(tailBuf, { status: 206 });
      });

      await expect(storage.verifyUploaded(key, 'image/jpeg', expectedSize)).resolves.toBeUndefined();
      fetchMock.mockRestore();
    });

    it('verifies PNG with trailing padding bytes after IEND chunk', async () => {
      const expectedSize = 2048;
      const sigBuf = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(24).fill(0)]);
      const iend = Buffer.from('0000000049454e44ae426082', 'hex');
      const tailBuf = Buffer.concat([Buffer.alloc(20), iend, Buffer.from([0x00, 0x00])]);

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const method = (init as any)?.method || 'GET';
        if (method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'content-type': 'image/png',
              'content-length': String(expectedSize),
            },
          });
        }
        const range = (init as any)?.headers?.Range || '';
        if (range === 'bytes=0-31') {
          return new Response(sigBuf, { status: 206 });
        }
        return new Response(tailBuf, { status: 206 });
      });

      await expect(storage.verifyUploaded(key, 'image/png', expectedSize)).resolves.toBeUndefined();
      fetchMock.mockRestore();
    });
  });
});
