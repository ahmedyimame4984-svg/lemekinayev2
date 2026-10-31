import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requestSellerApi, SellerApiError } from './seller-api';

beforeEach(() => {
  vi.stubEnv('SELLER_API_BASE_URL', 'http://127.0.0.1:3000/api/v1');
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Seller API transport for atomic saves', () => {
  const options = {
    method: 'POST' as const,
    body: { kind: 'INVENTORY', sku: 'SKU-TEST' },
    timeoutMs: 30_000,
  };

  it('returns a clear connection failure without automatically retrying the write', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestSellerApi('/seller/entry', options))
      .rejects.toMatchObject({
        status: 503,
        apiCode: 'SELLER_API_CONNECTION_FAILED',
      } satisfies Partial<SellerApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a timeout as an uncertain Save, not a confirmed failure', async () => {
    const timeout = new Error('request aborted');
    timeout.name = 'TimeoutError';
    const fetchMock = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestSellerApi('/seller/entry', options))
      .rejects.toMatchObject({
        status: 504,
        apiCode: 'SELLER_API_TIMEOUT',
      } satisfies Partial<SellerApiError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a missing production API URL without exposing a secret or URL', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SELLER_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestSellerApi('/seller/entry', options))
      .rejects.toMatchObject({
        status: 503,
        apiCode: 'SELLER_API_CONFIGURATION_ERROR',
      } satisfies Partial<SellerApiError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an invalid response error if a successful upstream response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<html>not the Seller API</html>', { status: 200 }),
    ));

    await expect(requestSellerApi('/seller/entry', options))
      .rejects.toMatchObject({
        status: 502,
        apiCode: 'SELLER_API_INVALID_RESPONSE',
      } satisfies Partial<SellerApiError>);
  });

  it('does not describe a read-only response failure as an Inventory Save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(requestSellerApi('/seller/listings/record/pending-edit', { method: 'GET' }))
      .rejects.toMatchObject({
        status: 502,
        apiCode: 'SELLER_API_INVALID_RESPONSE',
        apiMessage: 'The API returned an invalid response. Reload the page and try again.',
      } satisfies Partial<SellerApiError>);
  });

  it('preserves a successful create response and the caller timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ record: { sku: 'SKU-TEST' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestSellerApi('/seller/entry', options))
      .resolves.toEqual({ record: { sku: 'SKU-TEST' } });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/seller/entry',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
