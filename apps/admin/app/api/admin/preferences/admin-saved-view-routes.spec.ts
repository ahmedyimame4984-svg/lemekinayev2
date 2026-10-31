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
      readonly apiCode?: string,
      readonly apiMessage?: string,
    ) {
      super('Admin API request failed');
    }
  },
  requestAdminApi: mocks.requestAdminApi,
}));

import {
  GET as listSavedViews,
  POST as createSavedView,
} from './saved-views/route';
import {
  DELETE as deleteSavedView,
  PATCH as updateSavedView,
} from './saved-views/[id]/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const viewId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

function sameOriginRequest(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Request {
  return new Request(adminOrigin + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      origin: adminOrigin,
      'sec-fetch-site': 'same-origin',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Admin saved-view BFF routes', () => {
  it('requires an Admin access cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await listSavedViews(
      new Request(
        adminOrigin +
          '/api/admin/preferences/saved-views?scope=CATALOG_PRODUCT_TYPES',
      ),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards saved-view scope for the current Admin', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await listSavedViews(
      new Request(
        adminOrigin +
          '/api/admin/preferences/saved-views?scope=CATALOG_PRODUCT_TYPES',
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/preferences/saved-views?scope=CATALOG_PRODUCT_TYPES',
      { accessToken: token },
    );
  });

  it('forwards same-origin saved-view creation', async () => {
    const body = {
      scope: 'CATALOG_PRODUCT_TYPES',
      name: 'Draft brake parts',
      state: { status: 'DRAFT', sortBy: 'NAME' },
    };
    mocks.requestAdminApi.mockResolvedValue({
      id: viewId,
      ...body,
      version: 1,
    });

    const response = await createSavedView(
      sameOriginRequest(
        '/api/admin/preferences/saved-views',
        'POST',
        body,
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/preferences/saved-views',
      { method: 'POST', body, accessToken: token },
    );
  });

  it('forwards optimistic saved-view updates', async () => {
    const body = {
      version: 2,
      name: 'Active brake parts',
      state: { status: 'ACTIVE', sortBy: 'UPDATED_AT' },
    };
    mocks.requestAdminApi.mockResolvedValue({
      id: viewId,
      ...body,
      version: 3,
    });

    const response = await updateSavedView(
      sameOriginRequest(
        '/api/admin/preferences/saved-views/' + viewId,
        'PATCH',
        body,
      ),
      { params: Promise.resolve({ id: viewId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/preferences/saved-views/' + viewId,
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('forwards saved-view deletion with optimistic version safety', async () => {
    mocks.requestAdminApi.mockResolvedValue(undefined);

    const response = await deleteSavedView(
      sameOriginRequest(
        '/api/admin/preferences/saved-views/' + viewId + '?version=4',
        'DELETE',
      ),
      { params: Promise.resolve({ id: viewId }) },
    );

    expect(response.status).toBe(204);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/preferences/saved-views/' + viewId + '?version=4',
      { method: 'DELETE', accessToken: token },
    );
  });

  it('rejects cross-origin saved-view writes before contacting the API', async () => {
    const response = await createSavedView(
      new Request(adminOrigin + '/api/admin/preferences/saved-views', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({
          scope: 'CATALOG_PRODUCT_TYPES',
          name: 'Unsafe',
          state: {},
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
