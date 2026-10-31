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
  AdminApiError: class extends Error {
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
import { POST } from './route';

function request() {
  return new Request(
    'http://admin.local/api/admin/vehicles/identification/resolve',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: 'JTDBU4EE9B9123456',
        modelYear: 2011,
      }),
    },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookieGet.mockReturnValue({ value: 'admin-access-token' });
});

describe('Admin VIN lookup BFF', () => {
  it('requires the Admin session before reaching the decoder-backed resolver', async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards model-year evidence and preserves decoder output without caching the identifier', async () => {
    const result = {
      status: 'NO_MATCH',
      resolutionSource: 'VIN_PROVIDER',
      provider: 'nhtsa-vpic',
      decoded: { make: 'Toyota', model: 'Corolla', modelYear: 2011 },
      warnings: ['Verify decoder evidence.'],
      candidates: [],
      candidateCount: 0,
    };
    mocks.requestAdminApi.mockResolvedValue(result);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual(result);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/vehicles/identifiers/resolve',
      {
        method: 'POST',
        accessToken: 'admin-access-token',
        timeoutMs: 15_000,
        body: { identifier: 'JTDBU4EE9B9123456', modelYear: 2011 },
      },
    );
  });

  it('preserves the permission denial as a safe Admin response', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(403, null));
    expect((await POST(request())).status).toBe(403);
  });
});
