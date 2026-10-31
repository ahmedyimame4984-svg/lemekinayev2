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
import {
  GET as getResource,
  POST as createResource,
} from './master/[resource]/route';
import {
  GET as getResourceById,
  PATCH as updateResource,
} from './master/[resource]/[id]/route';
import { GET as getConfigurationLibrary } from './configuration-library/route';
import { GET as getConfigurationSummary } from './configuration-summary/route';
import { GET as validateConfigurationActivation } from './master/configurations/[id]/validate-activation/route';
import {
  GET as getConfigurationProvenance,
  POST as createConfigurationProvenance,
} from './master/configurations/[id]/provenance/route';
import { PATCH as updateConfigurationProvenance } from './master/configurations/[id]/provenance/[provenanceId]/route';
import { GET as getMasterPage } from './master/[resource]/page/route';

const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const token = 'access-token';
const generationId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin extended Vehicle Master BFF', () => {
  it('requires the Admin access cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getResource(
      new Request(`${adminOrigin}/api/admin/vehicles/master/generations`),
      { params: Promise.resolve({ resource: 'generations' }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards allowlisted resource reads and preserves filters', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getResource(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/generations?modelId=model-1&status=ACTIVE`,
      ),
      { params: Promise.resolve({ resource: 'generations' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/generations?modelId=model-1&status=ACTIVE',
      { accessToken: token },
    );
  });

  it('rejects unknown resource names before contacting the API', async () => {
    const response = await getResource(
      new Request(`${adminOrigin}/api/admin/vehicles/master/not-real`),
      { params: Promise.resolve({ resource: 'not-real' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards direct reads for all supported Vehicle Master resources', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: generationId,
      modelId: 'model-1',
      name: 'E140',
    });

    const response = await getResourceById(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/generations/${generationId}`,
      ),
      {
        params: Promise.resolve({
          resource: 'generations',
          id: generationId,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/vehicles/generations/${generationId}`,
      { accessToken: token },
    );

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue({
      id: generationId,
      code: '2ZR-FE',
      name: '2ZR-FE 1.8L',
    });
    const engine = await getResourceById(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/engines/${generationId}`,
      ),
      {
        params: Promise.resolve({
          resource: 'engines',
          id: generationId,
        }),
      },
    );
    expect(engine.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/vehicles/engines/${generationId}`,
      { accessToken: token },
    );
  });

  it('forwards paged Vehicle Master search for technical and hierarchy resources', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await getMasterPage(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/engines/page?search=2zr&status=ACTIVE&page=2&pageSize=50`,
      ),
      { params: Promise.resolve({ resource: 'engines' }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/engines/page?search=2zr&status=ACTIVE&page=2&pageSize=50',
      { accessToken: token },
    );

    mocks.requestAdminApi.mockClear();
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      pageCount: 0,
    });
    const hierarchy = await getMasterPage(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/generations/page?search=e140&modelId=model-1&derivativeId=derivative-1&status=ACTIVE&page=1&pageSize=50`,
      ),
      { params: Promise.resolve({ resource: 'generations' }) },
    );
    expect(hierarchy.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/generations/page?search=e140&status=ACTIVE&modelId=model-1&derivativeId=derivative-1&page=1&pageSize=50',
      { accessToken: token },
    );
  });

  it('rejects unsupported paged Vehicle Master resources', async () => {
    const response = await getMasterPage(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/page?page=1`,
      ),
      { params: Promise.resolve({ resource: 'configurations' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards the aggregate Configured Vehicle overview summary', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      total: 100,
      active: 80,
      draft: 12,
    });

    const response = await getConfigurationSummary();

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/configurations/summary',
      { accessToken: token },
    );
  });

  it('forwards resolved Configured Vehicle library paging and filters', async () => {
    const makeId = '11111111-1111-4111-8111-111111111111';
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 25,
      pageCount: 0,
    });

    const response = await getConfigurationLibrary(
      new Request(
        `${adminOrigin}/api/admin/vehicles/configuration-library?search=corolla&makeId=${makeId}&status=ACTIVE&page=2&pageSize=25&sortBy=MAKE&sortDirection=DESC`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/vehicles/configurations/library?search=corolla&makeId=${makeId}&status=ACTIVE&page=2&pageSize=25&sortBy=MAKE&sortDirection=DESC`,
      { accessToken: token },
    );
  });

  it('forwards configured vehicle activation validation', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      configurationId: generationId,
      version: 3,
      valid: true,
      message: 'Configured vehicle is ready for activation.',
    });

    const response = await validateConfigurationActivation(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/${generationId}/validate-activation`,
      ),
      { params: Promise.resolve({ id: generationId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/vehicles/configurations/${generationId}/validate-activation`,
      { accessToken: token },
    );
  });

  it('forwards same-origin creation through the allowlisted resource', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: generationId,
      modelId: 'model-1',
      code: 'E140',
      name: 'E140',
      status: 'DRAFT',
      version: 1,
    });

    const body = {
      modelId: 'model-1',
      code: 'E140',
      name: 'E140',
      status: 'DRAFT',
    };

    const response = await createResource(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/generations`,
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
      { params: Promise.resolve({ resource: 'generations' }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/generations',
      { method: 'POST', body, accessToken: token },
    );
  });

  it('rejects cross-origin mutation requests', async () => {
    const response = await createResource(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/engines`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ name: '2ZR-FE' }),
        },
      ),
      { params: Promise.resolve({ resource: 'engines' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards optimistic PATCH updates', async () => {
    const body = { version: 2, status: 'ACTIVE' };
    mocks.requestAdminApi.mockResolvedValue({
      id: generationId,
      version: 3,
      status: 'ACTIVE',
    });

    const response = await updateResource(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/generations/${generationId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify(body),
        },
      ),
      {
        params: Promise.resolve({
          resource: 'generations',
          id: generationId,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/vehicles/generations/${generationId}`,
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('maps upstream conflicts to the bounded Vehicle response', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null));

    const response = await updateResource(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/${generationId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({ version: 1, status: 'ACTIVE' }),
        },
      ),
      {
        params: Promise.resolve({
          resource: 'configurations',
          id: generationId,
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'VEHICLE_CONFLICT',
        message: expect.stringContaining('Reload'),
      },
    });
  });

  it('forwards configured-vehicle provenance reads and same-origin writes', async () => {
    const provenanceId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    mocks.requestAdminApi
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: provenanceId,
        entityType: 'VehicleConfiguration',
        entityId: generationId,
        sourceName: 'Toyota EPC',
        verificationState: 'UNVERIFIED',
        version: 1,
      })
      .mockResolvedValueOnce({
        id: provenanceId,
        entityType: 'VehicleConfiguration',
        entityId: generationId,
        sourceName: 'Toyota EPC',
        verificationState: 'VERIFIED',
        version: 2,
      });

    const listed = await getConfigurationProvenance(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/${generationId}/provenance`,
      ),
      { params: Promise.resolve({ id: generationId }) },
    );
    expect(listed.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      `/admin/vehicles/configurations/${generationId}/provenance`,
      { accessToken: token },
    );

    const created = await createConfigurationProvenance(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/${generationId}/provenance`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            sourceName: 'Toyota EPC',
            verificationState: 'UNVERIFIED',
          }),
        },
      ),
      { params: Promise.resolve({ id: generationId }) },
    );
    expect(created.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      `/admin/vehicles/configurations/${generationId}/provenance`,
      {
        method: 'POST',
        body: {
          sourceName: 'Toyota EPC',
          verificationState: 'UNVERIFIED',
        },
        accessToken: token,
      },
    );

    const updated = await updateConfigurationProvenance(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/${generationId}/provenance/${provenanceId}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            version: 1,
            verificationState: 'VERIFIED',
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: generationId,
          provenanceId,
        }),
      },
    );
    expect(updated.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      3,
      `/admin/vehicles/configurations/${generationId}/provenance/${provenanceId}`,
      {
        method: 'PATCH',
        body: {
          version: 1,
          verificationState: 'VERIFIED',
        },
        accessToken: token,
      },
    );
  });

  it('rejects cross-origin provenance mutation before contacting the API', async () => {
    const response = await createConfigurationProvenance(
      new Request(
        `${adminOrigin}/api/admin/vehicles/master/configurations/${generationId}/provenance`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://attacker.example',
            'sec-fetch-site': 'cross-site',
          },
          body: JSON.stringify({ sourceName: 'Untrusted' }),
        },
      ),
      { params: Promise.resolve({ id: generationId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

});
