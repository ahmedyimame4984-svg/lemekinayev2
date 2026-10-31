import { cookies } from 'next/headers';
import type { SellerApplicationPage } from '@/lib/seller-application-review';
import { requestAdminApi } from '@/lib/server/admin-api';
import { safeErrorResponse, jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 120;
const validStatuses = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED',
]);

export async function GET(request: Request): Promise<Response> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return jsonNoStore(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
      401,
    );
  }

  try {
    const url = new URL(request.url);
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return jsonNoStore(
        { error: { code: 'INVALID_PAGE', message: 'Choose a valid page number.' } },
        400,
      );
    }
    const search = (url.searchParams.get('search') ?? '').trim();
    if (search.length > MAX_SEARCH_LENGTH) {
      return jsonNoStore(
        { error: { code: 'INVALID_SEARCH', message: 'Search must be 120 characters or fewer.' } },
        400,
      );
    }
    const status = url.searchParams.get('status');
    if (status && !validStatuses.has(status)) {
      return jsonNoStore(
        { error: { code: 'INVALID_STATUS', message: 'Choose a valid application status.' } },
        400,
      );
    }

    const query = new URLSearchParams({
      page: String(requestedPage),
      pageSize: String(PAGE_SIZE),
    });
    if (search) query.set('search', search);
    if (status) query.set('status', status);

    // The API must authorize seller.manage before returning applicant data.
    const result = await requestAdminApi<SellerApplicationPage>(
      `/admin/seller-applications/page?${query.toString()}`,
      { accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return safeErrorResponse(error);
  }
}
