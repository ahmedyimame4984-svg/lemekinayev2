import { cookies } from 'next/headers';
import type { ManufacturerArticleInspectorRecord } from '@/lib/article-inspector-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = [
  'fitmentPage',
  'fitmentPageSize',
  'relationPage',
  'relationPageSize',
] as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return jsonNoStore(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
      401,
    );
  }

  try {
    const { id } = await context.params;
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    for (const key of QUERY_KEYS) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const inspector = await requestAdminApi<ManufacturerArticleInspectorRecord>(
      `/admin/products/${id}/inspector${suffix}`,
      { accessToken },
    );
    return jsonNoStore(inspector);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
