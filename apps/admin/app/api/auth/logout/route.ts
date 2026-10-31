import { cookies } from 'next/headers';
import { AdminApiError, requestAdminApi } from '@/lib/server/admin-api';
import { assertSameOrigin } from '@/lib/server/request-security';
import { noContent, safeErrorResponse } from '@/lib/server/safe-response';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
} from '@/lib/server/session-cookies';

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  try {
    assertSameOrigin(request);
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      await requestAdminApi<void>('/admin/auth/logout', {
        method: 'POST',
        body: { refreshToken },
      });
    }
    clearSessionCookies(cookieStore);
    return noContent();
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      clearSessionCookies(cookieStore);
      return noContent();
    }
    return safeErrorResponse(error);
  }
}
