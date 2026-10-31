import { cookies } from 'next/headers';
import type { ArticleIdentifierRecord } from '@/lib/product-identity-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { sellerOwnedProductWriteResponse } from '@/lib/server/seller-product-boundary';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const query = new URLSearchParams();
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    if (status) query.set('status', status);
    if (type) query.set('type', type);
    const suffix = query.size > 0 ? `?${query.toString()}` : '';

    const records = await requestAdminApi<ArticleIdentifierRecord[]>(
      `/admin/products/${id}/article-identifiers${suffix}`,
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
