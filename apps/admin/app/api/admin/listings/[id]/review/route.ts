import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { marketplaceManagementSafeErrorResponse } from '@/lib/server/marketplace-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return jsonNoStore({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' },
    }, 401);
  }

  try {
    const { id } = await context.params;
    const detail = await requestAdminApi(
      `/admin/listings/${encodeURIComponent(id)}/review`, { accessToken },
    );
    return jsonNoStore(detail);
  } catch (error) {
    return marketplaceManagementSafeErrorResponse(error);
  }
}
