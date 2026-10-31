import { cookies } from 'next/headers';
import type { ProfessionalCatalogBaselineReconcileResult } from '@/lib/professional-catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { assertSameOrigin } from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const result =
      await requestAdminApi<ProfessionalCatalogBaselineReconcileResult>(
        '/admin/catalog/professional-baseline/reconcile',
        { method: 'POST', accessToken, timeoutMs: 300_000 },
      );
    return jsonNoStore(result, 201);
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
