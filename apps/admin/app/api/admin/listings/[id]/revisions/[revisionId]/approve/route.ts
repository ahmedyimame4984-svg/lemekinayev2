import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { marketplaceManagementSafeErrorResponse } from '@/lib/server/marketplace-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { assertSameOrigin } from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; revisionId: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = {};
    const { id, revisionId } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return jsonNoStore({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' },
      }, 401);
    }
    const decision = await requestAdminApi(
      `/admin/listings/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/approve`,
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(decision);
  } catch (error) {
    return marketplaceManagementSafeErrorResponse(error);
  }
}
