import { cookies } from 'next/headers';
import type { GlobalCatalogSearchResult } from '@/lib/global-catalog-search-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
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
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    const q = source.get('q')?.trim();
    const limit = source.get('limit')?.trim();
    if (q) query.set('q', q);
    if (limit) query.set('limit', limit);

    const result = await requestAdminApi<GlobalCatalogSearchResult>(
      `/search/catalog?${query.toString()}`,
      { accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
