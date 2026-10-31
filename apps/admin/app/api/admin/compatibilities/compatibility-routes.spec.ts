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
  requestAdminApi: mocks.requestAdminApi,
}));

import {
  GET as getCompatibilities,
  POST as postCompatibility,
} from './route';
import {
  GET as getCompatibility,
  PATCH as patchCompatibility,
} from './[id]/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const productId = '11111111-1111-4111-8111-111111111111';
const configurationId = '22222222-2222-4222-8222-222222222222';
const compatibilityId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin seller-owned fitment boundary', () => {
  it('keeps fitment reads available for future moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);

    const response = await getCompatibilities(
      new Request(
        adminOrigin +
          '/api/admin/compatibilities?productId=' +
          productId +
          '&vehicleConfigurationId=' +
          configurationId,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/compatibilities?productId=' +
        productId +
        '&vehicleConfigurationId=' +
        configurationId,
      { accessToken: token },
    );
  });

  it('keeps fitment detail readable for future moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      id: compatibilityId,
      productId,
      version: 1,
    });

    const response = await getCompatibility(
      new Request(adminOrigin + '/api/admin/compatibilities/' + compatibilityId),
      { params: Promise.resolve({ id: compatibilityId }) },
    );

    expect(response.status).toBe(200);
  });

  it.each([
    ['create Product fitment', () => postCompatibility()],
    ['update Product fitment', () => patchCompatibility()],
  ])('blocks Admin write action: %s', async (_label, action) => {
    const response = await action();

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SELLER_PRODUCT_OWNED' },
    });
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
