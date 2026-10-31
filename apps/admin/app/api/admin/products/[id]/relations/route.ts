import { cookies } from 'next/headers';
import type { ArticleRelationRecord } from '@/lib/article-relation-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
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
    const { id } = await context.params;
    const url = new URL(request.url);
    const query = new URLSearchParams();
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    if (type) query.set('type', type);
    if (status) query.set('status', status);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const relations = await requestAdminApi<ArticleRelationRecord[]>(
      `/admin/products/${id}/relations${suffix}`,
      { accessToken },
    );
    return jsonNoStore(relations);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
