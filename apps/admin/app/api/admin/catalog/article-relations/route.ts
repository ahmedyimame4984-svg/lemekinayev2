import { cookies } from 'next/headers';
import type { ArticleRelationGovernancePage, ArticleRelationMutationResult } from '@/lib/article-relation-governance-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = ['search', 'articleId', 'type', 'status', 'page', 'pageSize'] as const;

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    for (const key of QUERY_KEYS) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const result = await requestAdminApi<ArticleRelationGovernancePage>(
      `/admin/catalog/article-relations${suffix}`,
      { accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();
    const result = await requestAdminApi<ArticleRelationMutationResult>(
      '/admin/catalog/article-relations',
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}
