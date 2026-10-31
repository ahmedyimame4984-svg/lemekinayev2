import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
  requestSellerApi: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.getCookie })),
}));
vi.mock('./seller-api', () => ({
  SellerApiError: class SellerApiError extends Error {
    constructor(
      readonly status: number,
      readonly retryAfter: string | null,
      readonly apiCode?: string,
      readonly apiMessage?: string,
    ) {
      super('Seller API failure');
    }
  },
  requestSellerApi: mocks.requestSellerApi,
}));

import { sellerWorkspaceRequest, validSellerUuid } from './seller-workspace-proxy';
import { SellerApiError } from './seller-api';

const origin = 'http://localhost:3002';

function request(method: 'GET' | 'POST', pathname: string, options: { origin?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (method === 'POST') {
    headers.set('origin', options.origin ?? origin);
    headers.set('sec-fetch-site', options.origin && options.origin !== origin ? 'cross-site' : 'same-origin');
    headers.set('content-type', 'application/json');
  }
  return new Request(origin + pathname, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SELLER_APP_ORIGIN', origin);
  mocks.getCookie.mockReturnValue({ value: 'seller-secret-session' });
  mocks.requestSellerApi.mockResolvedValue({ id: 'seller-product' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Seller Product and Inventory BFF', () => {
  it('rejects unauthenticated reads before calling upstream API', async () => {
    mocks.getCookie.mockReturnValue(undefined);
    const response = await sellerWorkspaceRequest(
      request('GET', '/api/seller/products'), '/seller/products', 'GET',
    );
    expect(response.status).toBe(401);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('rejects cross-origin changes without forwarding credentials', async () => {
    const response = await sellerWorkspaceRequest(
      request('POST', '/api/seller/products', { origin: 'https://attacker.example', body: {} }),
      '/seller/products', 'POST',
    );
    expect(response.status).toBe(403);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('forwards authorized Seller Product writes with access token kept server-side', async () => {
    const response = await sellerWorkspaceRequest(
      request('POST', '/api/seller/products', { body: { name: 'Oil Filter' } }),
      '/seller/products', 'POST', true,
    );
    expect(response.status).toBe(201);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith('/seller/products', {
      method: 'POST',
      accessToken: 'seller-secret-session',
      body: { name: 'Oil Filter' },
    });
    expect((await response.json())).toEqual({ id: 'seller-product' });
  });

  it('accepts same-origin Save in production without an explicit SELLER_APP_ORIGIN', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SELLER_APP_ORIGIN', '');

    const response = await sellerWorkspaceRequest(
      request('POST', '/api/seller/entry', { body: { kind: 'INVENTORY' } }),
      '/seller/entry', 'POST', true, 30_000,
    );

    expect(response.status).toBe(201);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith('/seller/entry', {
      method: 'POST',
      accessToken: 'seller-secret-session',
      body: { kind: 'INVENTORY' },
      timeoutMs: 30_000,
    });

    const rejected = await sellerWorkspaceRequest(
      request('POST', '/api/seller/entry', { origin: 'https://attacker.example' }),
      '/seller/entry', 'POST', true, 30_000,
    );
    expect(rejected.status).toBe(403);
    expect(mocks.requestSellerApi).toHaveBeenCalledTimes(1);
  });

  it('returns a precise timeout error instead of the generic unavailable message', async () => {
    mocks.requestSellerApi.mockRejectedValue(
      new SellerApiError(
        504, null, 'SELLER_API_TIMEOUT',
        'The Save request timed out. Check Inventory before retrying.',
      ),
    );

    const response = await sellerWorkspaceRequest(
      request('POST', '/api/seller/entry', { body: { kind: 'INVENTORY' } }),
      '/seller/entry', 'POST', true, 30_000,
    );

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      error: {
        code: 'SELLER_API_TIMEOUT',
        message: 'The Save request timed out. Check Inventory before retrying.',
      },
    });
  });

  it('rejects malformed record IDs before building upstream paths', () => {
    expect(() => validSellerUuid('../../admin')).toThrow();
    expect(validSellerUuid('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))
      .toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});
