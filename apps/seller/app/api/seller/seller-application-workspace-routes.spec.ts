import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  requestSellerApi: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));
vi.mock('@/lib/server/seller-api', () => ({
  SellerApiError: class SellerApiError extends Error {
    constructor(readonly status: number, readonly retryAfter: string | null) {
      super('Seller API failure');
    }
  },
  requestSellerApi: mocks.requestSellerApi,
}));

import { GET as getWorkspace } from './application/workspace/route';
import { PATCH as saveDraft } from './application/draft/route';
import { GET as browseArticles } from './catalog/browse/route';

const origin = 'http://seller.local';
const token = 'verified-seller-session';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SELLER_APP_ORIGIN', origin);
  mocks.cookieGet.mockReturnValue({ value: token });
  mocks.requestSellerApi.mockResolvedValue({ draft: null });
});

describe('Account-first Seller application and Article BFF', () => {
  it('allows a verified Seller to read only their authenticated workspace', async () => {
    const response = await getWorkspace(new Request(origin + '/api/seller/application/workspace'));
    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      '/seller/registration/workspace', expect.objectContaining({ accessToken: token, method: 'GET' }),
    );
  });

  it('rejects unauthenticated draft access', async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await saveDraft(new Request(origin + '/api/seller/application/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', origin, 'Sec-Fetch-Site': 'same-origin' },
      body: JSON.stringify({ step: 1, version: 0, values: {} }),
    }));
    expect(response.status).toBe(401);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('rejects cross-site draft changes before forwarding credentials', async () => {
    const response = await saveDraft(new Request(origin + '/api/seller/application/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
      body: JSON.stringify({ step: 1, version: 0, values: {} }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('forwards validated draft input under the account session', async () => {
    const input = { step: 2, version: 1, values: { businessName: 'Shop' } };
    const response = await saveDraft(new Request(origin + '/api/seller/application/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', origin, 'Sec-Fetch-Site': 'same-origin' },
      body: JSON.stringify(input),
    }));
    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      '/seller/registration/draft',
      expect.objectContaining({ accessToken: token, method: 'PATCH', body: input }),
    );
  });

  it('does not make approved Article browsing public to unauthenticated visitors', async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await browseArticles(new Request(origin + '/api/seller/catalog/browse'));
    expect(response.status).toBe(401);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('forwards Article search as read-only GET with bounded parameters', async () => {
    const response = await browseArticles(new Request(origin + '/api/seller/catalog/browse?q=filter'));
    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      '/seller/catalog/browse?q=filter', { accessToken: token },
    );
  });
});
