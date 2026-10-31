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

import { GET as getAuditHistory } from './route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Audit History BFF', () => {
  it('requires the Admin access cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getAuditHistory(
      new Request(`${adminOrigin}/api/admin/audit`),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards allowlisted Audit History filters and pagination', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await getAuditHistory(
      new Request(
        `${adminOrigin}/api/admin/audit?search=schema&action=PRODUCT_TYPE_SCHEMA_PUBLISHED&entityType=ProductTypeSchemaVersion&entityId=entity-1&actor=catalog&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-06T00%3A00%3A00.000Z&page=2&pageSize=50&ignored=drop-me`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/audit?search=schema&action=PRODUCT_TYPE_SCHEMA_PUBLISHED&entityType=ProductTypeSchemaVersion&entityId=entity-1&actor=catalog&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-06T00%3A00%3A00.000Z&page=2&pageSize=50',
      { accessToken: token },
    );
  });
});
