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

import { GET as getSuppliers, POST as postSupplier } from './suppliers/route';
import { GET as getSuppliersPage } from './suppliers/page/route';
import { PATCH as patchSupplier } from './suppliers/[id]/route';
import { PATCH as patchSupplierBulkStatus } from './suppliers/bulk-status/route';
import { GET as getOffers, POST as postOffer } from './offers/route';
import { PATCH as patchOffer } from './offers/[id]/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const supplierId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const offerId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin sourcing BFF routes', () => {
  it('requires Admin authentication for sourcing reads', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const supplierResponse = await getSuppliers(
      new Request(adminOrigin + '/api/admin/sourcing/suppliers'),
    );
    const offerResponse = await getOffers(
      new Request(adminOrigin + '/api/admin/sourcing/offers'),
    );

    expect(supplierResponse.status).toBe(401);
    expect(offerResponse.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards paged Supplier Master search and filters', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await getSuppliersPage(
      new Request(
        adminOrigin +
          '/api/admin/sourcing/suppliers/page?search=bosch&status=ACTIVE&supplierType=DISTRIBUTOR&countryCode=ET&page=2&pageSize=50&sortBy=UPDATED_AT&sortDirection=DESC',
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/sourcing/suppliers/page?search=bosch&status=ACTIVE&countryCode=ET&supplierType=DISTRIBUTOR&page=2&pageSize=50&sortBy=UPDATED_AT&sortDirection=DESC',
      { accessToken: token },
    );
  });

  it('forwards Supplier filters and creation', async () => {
    mocks.requestAdminApi.mockResolvedValueOnce([]);
    await getSuppliers(
      new Request(
        adminOrigin +
          '/api/admin/sourcing/suppliers?status=ACTIVE&countryCode=AE',
      ),
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/sourcing/suppliers?status=ACTIVE&countryCode=AE',
      { accessToken: token },
    );

    const body = {
      code: 'SUPPLIER_AE',
      name: 'Supplier AE',
      supplierType: 'DISTRIBUTOR',
      countryCode: 'AE',
      status: 'ACTIVE',
    };
    mocks.requestAdminApi.mockResolvedValueOnce({
      id: supplierId,
      ...body,
      version: 1,
    });

    const response = await postSupplier(
      sameOriginRequest('/api/admin/sourcing/suppliers', body),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/sourcing/suppliers',
      { method: 'POST', body, accessToken: token },
    );
  });

  it('forwards same-origin Supplier bulk lifecycle updates', async () => {
    const body = {
      items: [{ id: supplierId, version: 1 }],
      status: 'INACTIVE',
    };
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      updated: 1,
    });

    const response = await patchSupplierBulkStatus(
      sameOriginRequest(
        '/api/admin/sourcing/suppliers/bulk-status',
        body,
        'PATCH',
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/sourcing/suppliers/bulk-status',
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('forwards optimistic Supplier updates', async () => {
    const body = { version: 1, name: 'Supplier Updated' };
    mocks.requestAdminApi.mockResolvedValue({
      id: supplierId,
      ...body,
      version: 2,
    });

    const response = await patchSupplier(
      sameOriginRequest(
        '/api/admin/sourcing/suppliers/' + supplierId,
        body,
        'PATCH',
      ),
      { params: Promise.resolve({ id: supplierId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/sourcing/suppliers/' + supplierId,
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('forwards Supplier Offer filters and creation', async () => {
    mocks.requestAdminApi.mockResolvedValueOnce([]);
    await getOffers(
      new Request(
        adminOrigin +
          '/api/admin/sourcing/offers?supplierId=' +
          supplierId +
          '&productId=' +
          productId +
          '&currency=USD&status=DRAFT',
      ),
    );

    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      1,
      '/admin/sourcing/offers?supplierId=' +
        supplierId +
        '&productId=' +
        productId +
        '&status=DRAFT&currency=USD',
      { accessToken: token },
    );

    const body = {
      supplierId,
      productId,
      unitCost: 24.5,
      currency: 'USD',
      minOrderQuantity: 10,
      leadTimeDaysMin: 3,
      leadTimeDaysMax: 5,
      incoterm: 'FOB',
      status: 'DRAFT',
    };
    mocks.requestAdminApi.mockResolvedValueOnce({
      id: offerId,
      ...body,
      orderMultiple: 1,
      availableQuantity: null,
      version: 1,
    });

    const response = await postOffer(
      sameOriginRequest('/api/admin/sourcing/offers', body),
    );

    expect(response.status).toBe(201);
    expect(mocks.requestAdminApi).toHaveBeenNthCalledWith(
      2,
      '/admin/sourcing/offers',
      { method: 'POST', body, accessToken: token },
    );
  });

  it('forwards optimistic Supplier Offer updates', async () => {
    const body = { version: 1, status: 'ACTIVE' };
    mocks.requestAdminApi.mockResolvedValue({
      id: offerId,
      supplierId,
      productId,
      ...body,
      version: 2,
    });

    const response = await patchOffer(
      sameOriginRequest(
        '/api/admin/sourcing/offers/' + offerId,
        body,
        'PATCH',
      ),
      { params: Promise.resolve({ id: offerId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/sourcing/offers/' + offerId,
      { method: 'PATCH', body, accessToken: token },
    );
  });

  it('rejects cross-origin sourcing mutations', async () => {
    const response = await postOffer(
      new Request(adminOrigin + '/api/admin/sourcing/offers', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
        body: JSON.stringify({
          supplierId,
          productId,
          unitCost: 10,
          currency: 'USD',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
});

function sameOriginRequest(
  path: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST',
): Request {
  return new Request(adminOrigin + path, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: adminOrigin,
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  });
}
