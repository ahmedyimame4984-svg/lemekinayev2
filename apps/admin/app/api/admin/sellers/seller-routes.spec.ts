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

import { GET as getSellerPage } from './page/route';
import { GET as getSellerSummary } from './summary/route';

const token = 'access-token';
const adminOrigin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';

beforeEach(() => {
  mocks.cookieGet.mockReset();
  mocks.requestAdminApi.mockReset();
  mocks.cookieGet.mockReturnValue({ value: token });
});

describe('Admin Seller governance BFF routes', () => {
  it('requires the Admin access cookie for paged Seller reads', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await getSellerPage(
      new Request(`${adminOrigin}/api/admin/sellers/page?page=1&pageSize=50`),
    );

    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });

  it('forwards the aggregate Seller overview summary', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      total: 36,
      active: 24,
      suspended: 3,
      pendingReview: 9,
    });

    const response = await getSellerSummary();

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/sellers/summary',
      { accessToken: token },
    );
  });

  it('forwards Seller governance search, lifecycle filters, and paging', async () => {
    mocks.requestAdminApi.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 50,
      pageCount: 0,
    });

    const response = await getSellerPage(
      new Request(
        `${adminOrigin}/api/admin/sellers/page?search=addis&status=APPLICATION&approvalStatus=PENDING&verificationStatus=UNDER_REVIEW&sellerType=RETAILER&page=2&pageSize=50&sortBy=BUSINESS_NAME&sortDirection=ASC`,
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(
      '/admin/sellers/page?search=addis&status=APPLICATION&approvalStatus=PENDING&verificationStatus=UNDER_REVIEW&sellerType=RETAILER&page=2&pageSize=50&sortBy=BUSINESS_NAME&sortDirection=ASC',
      { accessToken: token },
    );
  });
});
