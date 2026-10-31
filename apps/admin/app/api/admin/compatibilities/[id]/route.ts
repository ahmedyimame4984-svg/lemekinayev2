import { cookies } from 'next/headers';
import type { VehicleCompatibilityRecord } from '@/lib/compatibility-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { sellerOwnedProductWriteResponse } from '@/lib/server/seller-product-boundary';
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
    const record = await requestAdminApi<VehicleCompatibilityRecord>(
      `/admin/compatibilities/${id}`,
      { accessToken },
    );
    return jsonNoStore(record);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export function PATCH(): Response {
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
