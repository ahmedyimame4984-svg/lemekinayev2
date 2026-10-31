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
  GET as getLocalizations,
  POST as createLocalization,
} from './product-types/[id]/localizations/route';
import {
  DELETE as deleteLocalization,
  PATCH as updateLocalization,
} from './product-types/[id]/localizations/[localizationId]/route';

const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const token = 'access-token';
const productTypeId = '44444444-4444-4444-8444-444444444444';
const localizationId = '88888888-8888-4888-8888-888888888888';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Product Type localization BFF routes', () => {
  it('forwards localized-content reads and same-origin writes', async () => {
    mocks.requestAdminApi
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: localizationId, locale: 'am', version: 1 })
      .mockResolvedValueOnce({ id: localizationId, locale: 'am', version: 2 })
      .mockResolvedValueOnce({ id: localizationId, locale: 'am', version: 2 });

    const listed = await getLocalizations(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/localizations`,
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );
    expect(listed.status).toBe(200);

    const createBody = {
      locale: 'am',
      name: 'የፍሬን ፓድ',
      description: 'የተተረጎመ መግለጫ',
    };
    const created = await createLocalization(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/localizations`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(createBody),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );
    expect(created.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/catalog/product-types/${productTypeId}/localizations`,
      { method: 'POST', body: createBody, accessToken: token },
    );

    const updated = await updateLocalization(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/localizations/${localizationId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, name: 'የፍሬን ፓድ ስብስብ' }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId, localizationId }) },
    );
    expect(updated.status).toBe(200);

    const removed = await deleteLocalization(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/localizations/${localizationId}`,
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
      { params: Promise.resolve({ id: productTypeId, localizationId }) },
    );
    expect(removed.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      4,
      `/admin/catalog/product-types/${productTypeId}/localizations/${localizationId}`,
      { method: 'DELETE', body: { version: 2 }, accessToken: token },
    );
  });

  it('rejects cross-origin localization writes before contacting the API', async () => {
    const response = await createLocalization(
      new Request(
        `${adminOrigin}/api/admin/catalog/product-types/${productTypeId}/localizations`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ locale: 'am', name: 'Bad' }),
        },
      ),
      { params: Promise.resolve({ id: productTypeId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
