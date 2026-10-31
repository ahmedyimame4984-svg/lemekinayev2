import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  requestAdminApi: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
  })),
}));

vi.mock('@/lib/server/admin-api', () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(
      readonly status: number,
      readonly retryAfter: string | null,
    ) {
      super('Admin API request failed');
    }
  },
  requestAdminApi: mocks.requestAdminApi,
}));

import { GET as getEntityHistory } from './route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Audit Entity History BFF', () => {
  it('requires the Admin access cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getEntityHistory(
      new Request(
        `${adminOrigin}/api/admin/audit/entities/Product/product-1/history`,
      ),
      {
        params: Promise.resolve({
          entityType: 'Product',
          entityId: 'product-1',
        }),
      },
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards only allowlisted entity history controls', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      entityType: 'Product',
      entityId: 'product-1',
      items: [],
    });

    const response = await getEntityHistory(
      new Request(
        `${adminOrigin}/api/admin/audit/entities/Product/product-1/history?includeRelated=true&limit=75&ignored=drop-me`,
      ),
      {
        params: Promise.resolve({
          entityType: 'Product',
          entityId: 'product-1',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/audit/entities/Product/product-1/history?includeRelated=true&limit=75',
      { accessToken: token },
    );
  });

  it('encodes dynamic entity path values before calling the Admin API', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      entityType: 'Product Type',
      entityId: 'article/ref 1',
      items: [],
    });

    await getEntityHistory(
      new Request(
        `${adminOrigin}/api/admin/audit/entities/Product%20Type/article%2Fref%201/history`,
      ),
      {
        params: Promise.resolve({
          entityType: 'Product Type',
          entityId: 'article/ref 1',
        }),
      },
    );

    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/audit/entities/Product%20Type/article%2Fref%201/history',
      { accessToken: token },
    );
  });
});
