import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { requestAdminApi } from './admin-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Admin API server client', () => {
  it('retains bounded backend domain error metadata for safe route mapping', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE',
            message: 'An active product type requires an active category',
          }),
          {
            status: 409,
            headers: {
              'content-type': 'application/json',
              'retry-after': '4',
            },
          },
        ),
      ),
    );

    await expect(
      requestAdminApi('/admin/catalog/product-types', {
        method: 'POST',
        body: { code: 'BRAKE_PAD' },
        accessToken: 'token',
      }),
    ).rejects.toMatchObject({
      status: 409,
      retryAfter: '4',
      apiCode: 'PRODUCT_TYPE_CATEGORY_NOT_ACTIVE',
      apiMessage: 'An active product type requires an active category',
    });
  });

  it('keeps non-JSON upstream failures bounded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('upstream error', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    );

    await expect(
      requestAdminApi('/admin/catalog/categories', { accessToken: 'token' }),
    ).rejects.toMatchObject({
      status: 502,
      apiCode: undefined,
      apiMessage: undefined,
    });
  });
});
