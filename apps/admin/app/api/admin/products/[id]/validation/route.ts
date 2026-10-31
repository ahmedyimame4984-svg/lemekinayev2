import { cookies } from 'next/headers';
import type { ArticleValidationRecord } from '@/lib/article-validation-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  _request: Request,
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
    const validation = await requestAdminApi<ArticleValidationRecord>(
      `/admin/products/${id}/validation`,
      { accessToken },
    );
    return jsonNoStore(validation);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
