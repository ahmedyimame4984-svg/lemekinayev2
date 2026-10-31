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
import { GET as listAdmins } from './route';
import { GET as listAdminsPage } from './page/route';
import { PATCH as updateAdminStatus } from './[id]/status/route';
import { POST as provisionAdmin } from './provision/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin account BFF routes', () => {
  it('requires the Admin access cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await provisionAdmin(
      new Request(`${adminOrigin}/api/admin/accounts/provision`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          email: 'new-admin@example.com',
          name: 'New Admin',
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards same-origin provisioning and returns the one-time response', async () => {
    const created = {
      userId: '44444444-4444-4444-8444-444444444444',
      activationToken: 'a'.repeat(48),
      expiresAt: '2026-09-28T12:00:00.000Z',
    };
    mocks.requestAdminApi.mockResolvedValue(created);

    const response = await provisionAdmin(
      new Request(`${adminOrigin}/api/admin/accounts/provision`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          email: 'new-admin@example.com',
          name: 'New Admin',
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(created);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/accounts/provision',
      {
        method: 'POST',
        accessToken: token,
        body: {
          email: 'new-admin@example.com',
          name: 'New Admin',
        },
      },
    );
  });

  it('rejects cross-origin provisioning before contacting the API', async () => {
    const response = await provisionAdmin(
      new Request(`${adminOrigin}/api/admin/accounts/provision`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({
          email: 'new-admin@example.com',
          name: 'New Admin',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });



  it('forwards paged Admin account search and lifecycle filters', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await listAdminsPage(
      new Request(
        `${adminOrigin}/api/admin/accounts/page?search=ops&status=ACTIVE&page=2&pageSize=50`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/accounts/page?search=ops&status=ACTIVE&page=2&pageSize=50',
      { accessToken: token },
    );
  });

  it('lists Admin accounts through the authenticated BFF', async () => {
    const accounts = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        email: 'admin@example.com',
        name: 'Platform Admin',
        status: 'ACTIVE',
        mfaEnrolled: true,
        lockedUntil: null,
        lastSeenAt: '2026-10-05T09:00:00.000Z',
        roles: [{ key: 'platform-admin', name: 'Platform Admin', permissions: ['admin.accounts.manage'] }],
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-10-05T09:00:00.000Z',
      },
    ];
    mocks.requestAdminApi.mockResolvedValue(accounts);

    const response = await listAdmins();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(accounts);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith('/admin/accounts', {
      accessToken: token,
    });
  });

  it('forwards same-origin Admin status changes', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const updated = { id, status: 'SUSPENDED' };
    mocks.requestAdminApi.mockResolvedValue(updated);

    const response = await updateAdminStatus(
      new Request(`${adminOrigin}/api/admin/accounts/${id}/status`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({ status: 'SUSPENDED' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      `/admin/accounts/${id}/status`,
      {
        method: 'PATCH',
        accessToken: token,
        body: { status: 'SUSPENDED' },
      },
    );
  });

  it('rejects cross-origin Admin status changes', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const response = await updateAdminStatus(
      new Request(`${adminOrigin}/api/admin/accounts/${id}/status`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({ status: 'SUSPENDED' }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('maps provisioning conflicts to a safe account-state message', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null));

    const response = await provisionAdmin(
      new Request(`${adminOrigin}/api/admin/accounts/provision`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          email: 'existing-admin@example.com',
          name: 'Existing Admin',
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'ADMIN_ACCOUNT_CONFLICT',
        message: expect.stringContaining('current state'),
      },
    });
  });
});
