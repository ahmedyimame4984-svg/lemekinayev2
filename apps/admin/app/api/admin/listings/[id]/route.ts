import { cookies } from 'next/headers';
import type { SellerListingRecord } from '@/lib/marketplace-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { marketplaceManagementSafeErrorResponse } from '@/lib/server/marketplace-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const { id } = await context.params;
    const listing = await requestAdminApi<SellerListingRecord>(
      `/admin/listings/${id}`,
      { accessToken },
    );
    return jsonNoStore(listing);
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
