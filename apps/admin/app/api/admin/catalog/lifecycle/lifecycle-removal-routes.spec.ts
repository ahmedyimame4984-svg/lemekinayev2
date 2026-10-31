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
    ) {
      super('Admin API request failed');
    }
  },
  requestAdminApi: mocks.requestAdminApi,
}));

import { GET as getPreflight } from './[entityType]/[id]/removal-preflight/route';
import { POST as postPermanentDelete } from './[entityType]/[id]/permanent-delete/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const entityId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin catalog lifecycle removal BFF', () => {
  it('loads deletion preflight through the governed API', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      entityType: 'CATEGORY',
      entityId,
      status: 'DRAFT',
      version: 3,
      canPermanentlyDelete: true,
      deletionPolicy: 'DRAFT_ONLY_UNUSED',
      dependencies: [],
      blockers: [],
    });

    const response = await getPreflight(
      new Request(
        `${adminOrigin}/api/admin/catalog/lifecycle/CATEGORY/${entityId}/removal-preflight`,
      ),
      {
        params: Promise.resolve({
          entityType: 'CATEGORY',
          id: entityId,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/lifecycle/CATEGORY/${entityId}/removal-preflight`,
      { accessToken: token },
    );
  });

  it('uses an explicit POST action for permanent deletion', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      entityType: 'CATEGORY',
      entityId,
      deleted: true,
    });

    const response = await postPermanentDelete(
      new Request(
        `${adminOrigin}/api/admin/catalog/lifecycle/CATEGORY/${entityId}/permanent-delete`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminOrigin,
            'sec-fetch-site': 'same-origin',
          },
          body: JSON.stringify({
            version: 3,
            reason: 'Unused draft is no longer needed.',
          }),
        },
      ),
      {
        params: Promise.resolve({
          entityType: 'CATEGORY',
          id: entityId,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/catalog/lifecycle/CATEGORY/${entityId}/permanent-delete`,
      {
        method: 'POST',
        body: {
          version: 3,
          reason: 'Unused draft is no longer needed.',
        },
        accessToken: token,
      },
    );
  });
});
