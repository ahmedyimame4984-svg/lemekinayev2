import { cookies } from 'next/headers';
import type { ReferencePage } from '@/lib/oe-reference-review-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = ['search', 'type', 'issuerBrandId', 'referenceStatus', 'articleStatus', 'integrity', 'page', 'pageSize'] as const;

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return jsonNoStore(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
      401,
    );
  }
  try {
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    for (const key of QUERY_KEYS) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const result = await requestAdminApi<ReferencePage>(
      `/admin/catalog/oe-references/references${suffix}`,
      { accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
