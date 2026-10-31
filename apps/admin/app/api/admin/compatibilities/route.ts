import { cookies } from 'next/headers';
import type { VehicleCompatibilityRecord } from '@/lib/compatibility-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { sellerOwnedProductWriteResponse } from '@/lib/server/seller-product-boundary';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();
    for (const key of [
      'productId',
      'vehicleConfigurationId',
      'status',
      'verificationStatus',
    ]) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const records = await requestAdminApi<VehicleCompatibilityRecord[]>(
      `/admin/compatibilities${suffix}`,
      { accessToken },
    );
    return jsonNoStore(records);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export function POST(): Response {
  return sellerOwnedProductWriteResponse();
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
