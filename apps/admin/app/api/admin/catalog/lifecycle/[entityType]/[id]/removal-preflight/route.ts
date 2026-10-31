import { cookies } from 'next/headers';
import type { MasterDataRemovalPreflight } from '@/lib/catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  _request: Request,
  context: { params: Promise<{ entityType: string; id: string }> },
): Promise<Response> {
  try {
    const { entityType, id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) return unauthenticated();

    const result = await requestAdminApi<MasterDataRemovalPreflight>(
      `/admin/catalog/lifecycle/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}/removal-preflight`,
      { accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
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
