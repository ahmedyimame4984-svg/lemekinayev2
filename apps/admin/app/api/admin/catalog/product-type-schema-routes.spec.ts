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

import { AdminApiError } from '@/lib/server/admin-api';
import { GET as getSchemas } from './product-types/[id]/schemas/route';
import { POST as publishSchema } from './product-types/[id]/schemas/publish/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const productTypeId = '44444444-4444-4444-8444-444444444444';
const schemaId = '88888888-8888-4888-8888-888888888888';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Product Type schema BFF routes', () => {
  it('requires the Admin access cookie for schema history', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getSchemas(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/schemas`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards Product Type schema history reads', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getSchemas(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/schemas`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/schemas`,
      { accessToken: token },
    );
  });

  it('forwards same-origin publication with the optimistic Product Type version', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: schemaId,
      productTypeId,
      schemaVersion: 2,
      schemaHash: 'a'.repeat(64),
      snapshot: {
        productType: { id: productTypeId, code: 'BRAKE_PAD' },
        attributes: [{ code: 'ATTR_POSITION' }],
      },
      publishedAt: '2026-09-27T17:30:00.000Z',
    });

    const response = await publishSchema(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/schemas/publish`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ productTypeVersion: 4 }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/product-types/${productTypeId}/schemas/publish`,
      {
        method: 'POST',
        body: { productTypeVersion: 4 },
        accessToken: token,
      },
    );
  });

  it('rejects cross-origin publication before contacting the API', async () => {
    const response = await publishSchema(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/schemas/publish`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ productTypeVersion: 4 }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('maps publication conflicts to the safe catalog reload response', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null));

    const response = await publishSchema(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/schemas/publish`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ productTypeVersion: 4 }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'CATALOG_CONFLICT',
        message: expect.stringContaining('Reload'),
      },
    });
  });
});
