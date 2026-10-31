import { cookies } from 'next/headers';
import type { CatalogHealthResponse } from '@/lib/catalog-health-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
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

  try {
    const health = await requestAdminApi<CatalogHealthResponse>(
      '/admin/catalog/health',
      { accessToken },
    );
    return jsonNoStore(health);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
