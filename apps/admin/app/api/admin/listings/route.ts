import { cookies } from 'next/headers';
import type { SellerListingRecord } from '@/lib/marketplace-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { marketplaceManagementSafeErrorResponse } from '@/lib/server/marketplace-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();
    for (const key of ['status', 'productId', 'sellerId']) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const listings = await requestAdminApi<SellerListingRecord[]>(
      `/admin/listings${suffix}`,
      { accessToken },
    );
    return jsonNoStore(listings);
  } catch (error) {
    return marketplaceManagementSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in to continue.',
      },
    },
    401,
  );
}
