import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  requestSellerApi: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  })),
}));

vi.mock('@/lib/server/seller-api', () => {
  class SellerApiError extends Error {
    constructor(
      readonly status: number,
      readonly retryAfter: string | null,
      readonly apiCode?: string,
      readonly apiMessage?: string,
    ) {
      super('API error');
    }
  }
  return {
    SellerApiError,
    requestSellerApi: mocks.requestSellerApi,
  };
});

import { POST as sellerLogin } from './auth/login/route';
import { POST as sellerSession } from './auth/session/route';
import { POST as sellerLogout } from './auth/logout/route';
import {
  GET as sellerCatalogGet,
  POST as sellerCatalogPost,
  PATCH as sellerCatalogPatch,
} from './catalog/[...path]/route';
import { GET as sellerReferenceGet } from './reference/[...path]/route';
import { POST as sellerEntryPost } from './entry/route';
import { GET as listingOfferRequirementsGet } from './entry/offer-requirements/[articleId]/route';
import { GET as assetsGet, POST as assetsPost, PATCH as assetsPatch } from './listings/[id]/assets/[[...operation]]/route';
import { POST as listingFinish } from './listings/[id]/finish/route';

const origin = process.env.SELLER_APP_ORIGIN ?? 'http://seller.local';
const accessToken = 'A'.repeat(48);

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.cookieSet.mockReset();
  mocks.requestSellerApi.mockReset();
});

function postRequest(path: string, body: unknown, requestOrigin = origin) {
  return new Request(origin + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: requestOrigin,
      'sec-fetch-site':
        requestOrigin === origin ? 'same-origin' : 'cross-site',
    },
    body: JSON.stringify(body),
  });
}

describe('Seller Article workspace BFF', () => {
  it('logs in with the Seller auth endpoint and stores only the Seller access cookie', async () => {
    mocks.requestSellerApi.mockResolvedValue({
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const response = await sellerLogin(
      postRequest('/api/seller/auth/login', {
        identifier: 'seller@example.com',
        password: 'long-enough-password',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      '/seller/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: {
          identifier: 'seller@example.com',
          password: 'long-enough-password',
        },
      }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      expect.stringContaining('lemekinaye_seller_access'),
      accessToken,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });

  it('resolves only an active Seller principal for the Seller session', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue({
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: '22222222-2222-4222-8222-222222222222',
      accountType: 'SELLER',
      status: 'ACTIVE',
      roles: [],
      permissions: [],
    });

    const response = await sellerSession(
      postRequest('/api/seller/auth/session', {}),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith('/auth/me', {
      accessToken,
    });
  });

  it('fetches the Seller catalog classification separately from eligible Product Types', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    const classification = {
      categories: [{ id: 'category-1', name: 'Brakes' }],
      partGroups: [{ id: 'group-1', categoryId: 'category-1', name: 'Brake Pads' }],
    };
    mocks.requestSellerApi.mockResolvedValue(classification);
    const response = await sellerCatalogGet(
      new Request(origin + '/api/seller/catalog/classification'),
      { params: Promise.resolve({ path: ['classification'] }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(classification);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      '/seller/catalog/classification', { accessToken },
    );
  });

  it('forwards only whitelisted Seller catalog GET and POST operations', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue([]);

    const getResponse = await sellerCatalogGet(
      new Request(origin + '/api/seller/catalog/product-types'),
      { params: Promise.resolve({ path: ['product-types'] }) },
    );
    expect(getResponse.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenNthCalledWith(
      1,
      '/seller/catalog/product-types',
      { accessToken },
    );

    const body = {
      productTypeId: '33333333-3333-4333-8333-333333333333',
      values: {},
    };
    const postResponse = await sellerCatalogPost(
      postRequest('/api/seller/catalog/articles/submit', body),
      { params: Promise.resolve({ path: ['articles', 'submit'] }) },
    );
    expect(postResponse.status).toBe(201);
    expect(mocks.requestSellerApi).toHaveBeenNthCalledWith(
      2,
      '/seller/catalog/articles/submit',
      {
        method: 'POST',
        body,
        accessToken,
        timeoutMs: 20_000,
      },
    );
  });

  it('gives the atomic Inventory Save enough time to complete', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue({ record: { sku: 'SKU-TEST' } });
    const payload = {
      kind: 'INVENTORY',
      articleId: '33333333-3333-4333-8333-333333333333',
      locationId: '44444444-4444-4444-8444-444444444444',
      sku: 'SKU-TEST',
      openingQuantity: 1,
    };

    const response = await sellerEntryPost(postRequest('/api/seller/entry', payload));
    expect(response.status).toBe(201);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith('/seller/entry', {
      method: 'POST',
      accessToken,
      body: payload,
      timeoutMs: 30_000,
    });
  });

  it('reads Article-bound Listing requirements only through Seller-authenticated route', async () => {
    const articleId = '33333333-3333-4333-8333-333333333333';
    const requirements = {
      price: 'REQUIRED', stock: 'REQUIRED', condition: 'REQUIRED', warranty: 'OPTIONAL',
    };
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue(requirements);

    const response = await listingOfferRequirementsGet(
      new Request(origin + `/api/seller/entry/offer-requirements/${articleId}`),
      { params: Promise.resolve({ articleId }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(requirements);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      `/seller/entry/offer-requirements/${articleId}`,
      { method: 'GET', accessToken },
    );
  });

  it('supports exact identity resolution and explicit review submission as non-create transitions', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi
      .mockResolvedValueOnce({ resolution: 'REUSED_ACTIVE' })
      .mockResolvedValueOnce({
        articleId: '33333333-3333-4333-8333-333333333333',
        catalogReviewSubmittedAt: '2026-10-07T05:45:00.000Z',
      });

    const identityResponse = await sellerCatalogPost(
      postRequest('/api/seller/catalog/articles/resolve-identity', {
        brandId: '44444444-4444-4444-8444-444444444444',
        manufacturerPartNumber: '0 986 494 596',
      }),
      { params: Promise.resolve({ path: ['articles', 'resolve-identity'] }) },
    );
    expect(identityResponse.status).toBe(200);

    const reviewResponse = await sellerCatalogPost(
      postRequest(
        '/api/seller/catalog/articles/33333333-3333-4333-8333-333333333333/submit-for-review',
        {},
      ),
      {
        params: Promise.resolve({
          path: [
            'articles',
            '33333333-3333-4333-8333-333333333333',
            'submit-for-review',
          ],
        }),
      },
    );
    expect(reviewResponse.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenNthCalledWith(
      2,
      '/seller/catalog/articles/33333333-3333-4333-8333-333333333333/submit-for-review',
      expect.objectContaining({
        method: 'POST',
        accessToken,
      }),
    );
  });

  it('forwards Seller-owned Draft editing with same-origin restrictions and rejects other paths', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue({ article: { version: 2 } });
    const id = '33333333-3333-4333-8333-333333333333';
    const path = `/api/seller/catalog/articles/${id}/draft`;
    const body = { version: 1, values: { HEIGHT: 75 } };

    const result = await sellerCatalogPatch(new Request(origin + path, {
      method: 'PATCH',
      headers: {
        origin,
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ path: ['articles', id, 'draft'] }) });
    expect(result.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      `/seller/catalog/articles/${id}/draft`,
      expect.objectContaining({ accessToken, method: 'PATCH', body }),
    );

    const forbidden = await sellerCatalogPatch(new Request(origin + path, {
      method: 'PATCH',
      headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ path: ['admin', 'products'] }) });
    expect(forbidden.status).toBe(404);

    const crossSite = await sellerCatalogPatch(new Request(origin + path, {
      method: 'PATCH',
      headers: {
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ path: ['articles', id, 'draft'] }) });
    expect(crossSite.status).toBe(403);
    expect(mocks.requestSellerApi).toHaveBeenCalledTimes(1);
  });

  it('allows canonical Derivative/Body Line reference lookup without exposing arbitrary vehicle APIs', async () => {
    mocks.requestSellerApi.mockResolvedValue([]);
    const modelId = '33333333-3333-4333-8333-333333333333';
    const derivativeId = '44444444-4444-4444-8444-444444444444';
    const derivatives = await sellerReferenceGet(
      new Request(origin + `/api/seller/reference/vehicles/derivatives?modelId=${modelId}`),
      { params: Promise.resolve({ path: ['vehicles', 'derivatives'] }) },
    );
    expect(derivatives.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(`/vehicles/derivatives?modelId=${modelId}`);

    const generations = await sellerReferenceGet(
      new Request(origin + `/api/seller/reference/vehicles/generations?modelId=${modelId}&derivativeId=${derivativeId}`),
      { params: Promise.resolve({ path: ['vehicles', 'generations'] }) },
    );
    expect(generations.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(`/vehicles/generations?modelId=${modelId}&derivativeId=${derivativeId}`);

    const blocked = await sellerReferenceGet(
      new Request(origin + `/api/seller/reference/vehicles/derivatives?modelId=${modelId}&status=DRAFT`),
      { params: Promise.resolve({ path: ['vehicles', 'derivatives'] }) },
    );
    expect(blocked.status).toBe(404);
  });

  it('rejects unapproved Seller catalog paths and cross-site writes', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });

    const blocked = await sellerCatalogGet(
      new Request(origin + '/api/seller/catalog/../../admin/products'),
      { params: Promise.resolve({ path: ['admin', 'products'] }) },
    );
    expect(blocked.status).toBe(404);

    const crossSite = await sellerCatalogPost(
      postRequest(
        '/api/seller/catalog/articles/submit',
        { values: {} },
        'https://attacker.example',
      ),
      { params: Promise.resolve({ path: ['articles', 'submit'] }) },
    );
    expect(crossSite.status).toBe(403);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('proxies only approved public reference routes and validates catalog search', async () => {
    mocks.requestSellerApi.mockResolvedValue({ articles: [] });

    const response = await sellerReferenceGet(
      new Request(
        origin + '/api/seller/reference/search/catalog?q=brake%20pad&limit=8',
      ),
      { params: Promise.resolve({ path: ['search', 'catalog'] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      '/search/catalog?q=brake+pad&limit=8',
    );

    const bad = await sellerReferenceGet(
      new Request(origin + '/api/seller/reference/search/catalog?q=x&limit=50'),
      { params: Promise.resolve({ path: ['search', 'catalog'] }) },
    );
    expect(bad.status).toBe(400);
  });

  it('revokes the API session and clears the Seller cookie on logout', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue(undefined);

    const response = await sellerLogout(
      postRequest('/api/seller/auth/logout', {}),
    );

    expect(response.status).toBe(204);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      accessToken,
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      expect.stringContaining('lemekinaye_seller_access'),
      '',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

describe('Seller Listing media BFF', () => {
  const listingId = '11111111-1111-4111-8111-111111111111';
  const assetId = '22222222-2222-4222-8222-222222222222';

  it('passes the immutable media policy through an authenticated GET', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    const rules = {
      image: 'REQUIRED', minimumImageCount: 2,
      document: 'OPTIONAL', minimumDocumentCount: 0,
    };
    mocks.requestSellerApi.mockResolvedValue(rules);
    const res = await assetsGet(
      new Request(origin + `/api/seller/listings/${listingId}/assets/requirements`),
      { params: Promise.resolve({ id: listingId, operation: ['requirements'] }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(rules);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      `/seller/listings/${listingId}/assets/requirements`,
      { method: 'GET', accessToken },
    );
  });

  it('forwards presign only for same-origin Seller requests', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue({ assetId, uploadUrl: 'https://example.invalid/signed' });
    const params = { params: Promise.resolve({ id: listingId, operation: ['presign'] }) };
    const res = await assetsPost(postRequest(`/api/seller/listings/${listingId}/assets/presign`, {
      mimeType: 'image/jpeg', sizeBytes: 42, fileName: 'part.jpg',
    }), params);
    expect(res.status).toBe(201);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      `/seller/listings/${listingId}/assets/presign`,
      expect.objectContaining({
        method: 'POST', accessToken,
        body: { mimeType: 'image/jpeg', sizeBytes: 42, fileName: 'part.jpg' },
      }),
    );
    mocks.requestSellerApi.mockClear();
    const blocked = await assetsPost(postRequest(
      `/api/seller/listings/${listingId}/assets/presign`,
      { mimeType: 'image/jpeg' }, 'https://evil.example',
    ), params);
    expect(blocked.status).toBe(403);
    expect(mocks.requestSellerApi).not.toHaveBeenCalled();
  });

  it('bounds upload verification and disallows unknown or invalid asset routes', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue({ status: 'ACTIVE' });
    const complete = await assetsPost(postRequest(
      `/api/seller/listings/${listingId}/assets/${assetId}/complete`, {},
    ), { params: Promise.resolve({ id: listingId, operation: [assetId, 'complete'] }) });
    expect(complete.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      `/seller/listings/${listingId}/assets/${assetId}/complete`,
      expect.objectContaining({ method: 'POST', accessToken, timeoutMs: 60000 }),
    );
    const invalid = await assetsGet(
      new Request(origin + `/api/seller/listings/${listingId}/assets/wrong`),
      { params: Promise.resolve({ id: listingId, operation: ['wrong'] }) },
    );
    expect(invalid.status).toBe(404);
    const forbidden = await assetsPatch(
      new Request(origin + `/api/seller/listings/${listingId}/assets/arbitrary`, {
        method: 'PATCH', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: listingId, operation: ['arbitrary'] }) },
    );
    expect(forbidden.status).toBe(404);
  });
  it('forwards Create Listing completion for the signed-in Seller without manual submit', async () => {
    mocks.cookieGet.mockReturnValue({ value: accessToken });
    mocks.requestSellerApi.mockResolvedValue({ id: listingId, status: 'SUBMITTED', reviewIntent: true });
    const response = await listingFinish(
      postRequest(`/api/seller/listings/${listingId}/finish`, {}),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.requestSellerApi).toHaveBeenCalledWith(
      `/seller/listings/${listingId}/finish`,
      expect.objectContaining({ method: 'POST', accessToken }),
    );
  });

});
