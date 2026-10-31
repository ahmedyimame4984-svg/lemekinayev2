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
import { GET as getMakes, POST as postMake } from './makes/route';
import { GET as getMakesPage } from './makes/page/route';
import { GET as getMake } from './makes/[id]/route';
import { GET as getModels } from './models/route';
import { GET as getModelsPage } from './models/page/route';
import { GET as getModel, PATCH as patchModel } from './models/[id]/route';
import { GET as getVehicleSummary } from './summary/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin vehicle BFF routes', () => {
  it('rejects make reads when the Admin access cookie is missing', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getMakes(
      new Request(`${adminOrigin}/api/admin/vehicles/makes`),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AUTHENTICATION_REQUIRED' },
    });
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards model filters with the bearer-backed Admin API request', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getModels(
      new Request(
        `${adminOrigin}/api/admin/vehicles/models?status=ACTIVE&makeId=22222222-2222-4222-8222-222222222222`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/models?status=ACTIVE&makeId=22222222-2222-4222-8222-222222222222',
      { accessToken: token },
    );
  });

  it('forwards paged Make and Model reads plus root summary', async () => {
    const makeId = '22222222-2222-4222-8222-222222222222';
    const modelId = '33333333-3333-4333-8333-333333333333';

    mocks.requestAdminApi
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        pageSize: 50,
        pageCount: 0,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
        pageCount: 0,
      })
      .mockResolvedValueOnce({
        totalMakes: 12,
        totalModels: 84,
        modelCountsByMake: { [makeId]: 7 },
      })
      .mockResolvedValueOnce({
        id: makeId,
        code: 'TOYOTA',
        name: 'Toyota',
      })
      .mockResolvedValueOnce({
        id: modelId,
        makeId,
        code: 'COROLLA',
        name: 'Corolla',
      });

    await getMakesPage(
      new Request(
        `${adminOrigin}/api/admin/vehicles/makes/page?search=toy&status=ACTIVE&page=2&pageSize=50`,
      ),
    );
    await getModelsPage(
      new Request(
        `${adminOrigin}/api/admin/vehicles/models/page?search=cor&status=ACTIVE&makeId=${makeId}&page=1&pageSize=50`,
      ),
    );
    await getVehicleSummary();
    await getMake(
      new Request(`${adminOrigin}/api/admin/vehicles/makes/${makeId}`),
      { params: Promise.resolve({ id: makeId }) },
    );
    await getModel(
      new Request(`${adminOrigin}/api/admin/vehicles/models/${modelId}`),
      { params: Promise.resolve({ id: modelId }) },
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/vehicles/makes/page?search=toy&status=ACTIVE&page=2&pageSize=50',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/vehicles/models/page?search=cor&status=ACTIVE&makeId=${makeId}&page=1&pageSize=50`,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      '/admin/vehicles/summary',
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      4,
      `/admin/vehicles/makes/${makeId}`,
      { accessToken: token },
    );
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      5,
      `/admin/vehicles/models/${modelId}`,
      { accessToken: token },
    );
  });

  it('forwards same-origin make creation and returns 201', async () => {
    const created = {
      id: '22222222-2222-4222-8222-222222222222',
      code: 'TOYOTA',
      name: 'Toyota',
      status: 'DRAFT',
      version: 1,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    };
    mocks.requestAdminApi.mockResolvedValue(created);

    const response = await postMake(
      new Request(`${adminOrigin}/api/admin/vehicles/makes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          code: 'TOYOTA',
          name: 'Toyota',
          status: 'DRAFT',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/makes',
      expect.objectContaining({
        method: 'POST',
        accessToken: token,
        body: {
          code: 'TOYOTA',
          name: 'Toyota',
          status: 'DRAFT',
        },
      }),
    );
  });

  it('maps vehicle conflicts to a safe master-data message', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null));

    const response = await postMake(
      new Request(`${adminOrigin}/api/admin/vehicles/makes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          code: 'TOYOTA',
          name: 'Toyota',
          status: 'ACTIVE',
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'VEHICLE_CONFLICT',
        message: expect.stringContaining('Reload'),
      },
    });
  });

  it('forwards optimistic model updates with the route id and version', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    mocks.requestAdminApi.mockResolvedValue({
      id,
      makeId: '22222222-2222-4222-8222-222222222222',
      code: 'COROLLA',
      name: 'Corolla',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    });

    const response = await patchModel(
      new Request(`${adminOrigin}/api/admin/vehicles/models/${id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({ version: 1, name: 'Corolla Cross' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/vehicles/models/${id}`,
      expect.objectContaining({
        method: 'PATCH',
        accessToken: token,
        body: { version: 1, name: 'Corolla Cross' },
      }),
    );
  });
});
