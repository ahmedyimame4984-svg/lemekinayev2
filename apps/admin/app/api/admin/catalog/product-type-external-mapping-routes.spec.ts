import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  requestAdminApi: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
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

import {
  GET as getMappings,
  POST as createMapping,
} from './product-types/[id]/external-mappings/route';
import {
  DELETE as deleteMapping,
  PATCH as updateMapping,
} from './product-types/[id]/external-mappings/[mappingId]/route';

const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const token = 'access-token';
const productTypeId = '44444444-4444-4444-8444-444444444444';
const mappingId = '77777777-7777-4777-8777-777777777777';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Product Type external mapping BFF routes', () => {
  it('forwards mapping reads and same-origin create/update/delete writes', async () => {
    mocks.requestAdminApi
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: mappingId, version: 1 })
      .mockResolvedValueOnce({ id: mappingId, version: 2 })
      .mockResolvedValueOnce({ id: mappingId, version: 2 });

    const listed = await getMappings(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/external-mappings`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );
    expect(listed.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      `/admin/catalog/product-types/${productTypeId}/external-mappings`,
      { accessToken: token },
    );

    const body = {
      provider: 'TecAlliance',
      standard: 'TecDoc',
      externalEntityType: 'GenericArticle',
      externalIdentifier: '402',
    };
    const created = await createMapping(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/external-mappings`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(body),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );
    expect(created.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/catalog/product-types/${productTypeId}/external-mappings`,
      { method: 'POST', body, accessToken: token },
    );

    const updated = await updateMapping(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/external-mappings/${mappingId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, externalVersion: '2026Q4' }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId, mappingId }) },
    );
    expect(updated.status).toBe(200);

    const removed = await deleteMapping(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/external-mappings/${mappingId}`,
        {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 2 }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId, mappingId }) },
    );
    expect(removed.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      4,
      `/admin/catalog/product-types/${productTypeId}/external-mappings/${mappingId}`,
      { method: 'DELETE', body: { version: 2 }, accessToken: token },
    );
  });

  it('rejects cross-origin external mapping writes before contacting the API', async () => {
    const response = await createMapping(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/external-mappings`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({
            provider: 'Bad',
            standard: 'Bad',
            externalEntityType: 'Bad',
            externalIdentifier: 'Bad',
          }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
