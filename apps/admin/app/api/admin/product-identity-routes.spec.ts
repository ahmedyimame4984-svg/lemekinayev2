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

import { GET as getBrands, POST as postBrand } from './brands/route';
import { GET as getBrandsPage } from './brands/page/route';
import { PATCH as patchBrand } from './brands/[id]/route';
import { PATCH as bulkPatchBrands } from './brands/bulk-status/route';
import {
  GET as getArticleIdentifiers,
  POST as postArticleIdentifier,
} from './products/[id]/article-identifiers/route';
import {
  GET as getPartNumbers,
  POST as postPartNumber,
} from './products/[id]/part-numbers/route';
import { PATCH as patchPartNumber } from './products/[id]/part-numbers/[partNumberId]/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const brandId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Product identity boundary', () => {
  it('forwards paged Brand Master search and status filters', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await getBrandsPage(
      new Request(
        adminOrigin +
          '/api/admin/brands/page?search=bosch&status=ACTIVE&page=2&pageSize=50',
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/brands/page?search=bosch&status=ACTIVE&page=2&pageSize=50',
      { accessToken: token },
    );
  });

  it('forwards same-origin Brand bulk lifecycle changes', async () => {
    const body = {
      items: [{ id: brandId, version: 1 }],
      status: 'INACTIVE',
    };
    mocks.requestAdminApi.mockResolvedValue({
      items: [{ id: brandId, status: 'INACTIVE', version: 2 }],
      updated: 1,
    });

    const response = await bulkPatchBrands(
      new Request(adminOrigin + '/api/admin/brands/bulk-status', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/brands/bulk-status',
      {
        method: 'PATCH',
        body,
        accessToken: token,
      },
    );
  });

  it('keeps Brand Master writable reference data', async () => {
    mocks.requestAdminApi.mockResolvedValueOnce([]);
    await getBrands(new Request(adminOrigin + '/api/admin/brands?status=ACTIVE'));
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/brands?status=ACTIVE',
      { accessToken: token },
    );

    const body = { code: 'BOSCH', name: 'Bosch', status: 'ACTIVE' };
    mocks.requestAdminApi.mockResolvedValueOnce({
      id: brandId,
      ...body,
      version: 1,
    });
    const createResponse = await postBrand(
      new Request(adminOrigin + '/api/admin/brands', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(createResponse.status).toBe(201);

    mocks.requestAdminApi.mockResolvedValueOnce({
      id: brandId,
      code: 'BOSCH',
      name: 'Bosch Automotive',
      version: 2,
    });
    const updateResponse = await patchBrand(
      new Request(adminOrigin + '/api/admin/brands/' + brandId, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: adminOrigin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({ version: 1, name: 'Bosch Automotive' }),
      }),
      { params: Promise.resolve({ id: brandId }) },
    );
    expect(updateResponse.status).toBe(200);
  });

  it('keeps seller GTIN/trade identifiers readable for moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);
    const response = await getArticleIdentifiers(
      new Request(
        adminOrigin +
          '/api/admin/products/' +
          productId +
          '/article-identifiers?status=ACTIVE&type=GTIN_13',
      ),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/' +
        productId +
        '/article-identifiers?status=ACTIVE&type=GTIN_13',
      { accessToken: token },
    );
  });

  it('keeps seller Product identifiers readable for future moderation', async () => {
    mocks.requestAdminApi.mockResolvedValue([]);
    const response = await getPartNumbers(
      new Request(
        adminOrigin +
          '/api/admin/products/' +
          productId +
          '/part-numbers?status=ACTIVE&type=OE&issuerBrandId=' +
          brandId,
      ),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/products/' +
        productId +
        '/part-numbers?status=ACTIVE&type=OE&issuerBrandId=' +
        brandId,
      { accessToken: token },
    );
  });

  it.each([
    ['create Product GTIN/trade identifier', () => postArticleIdentifier()],
    ['create Product part number', () => postPartNumber()],
    ['update Product part number', () => patchPartNumber()],
  ])('blocks Admin write action: %s', async (_label, action) => {
    const response = await action();

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SELLER_PRODUCT_OWNED' },
    });
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});
