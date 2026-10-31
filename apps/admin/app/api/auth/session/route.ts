import { cookies } from 'next/headers';
import type { AdminPrincipal, AdminSession } from '@/lib/auth-contracts';
import { AdminApiError, requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore, safeErrorResponse } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from '@/lib/server/session-cookies';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    await readJsonObject(request);
  } catch (error) {
    return safeErrorResponse(error);
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  try {
    if (accessToken) {
      try {
        return jsonNoStore(await getPrincipal(accessToken));
      } catch (error) {
        if (!(error instanceof AdminApiError) || error.status !== 401)
          throw error;
      }
    }

    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      clearSessionCookies(cookieStore);
      return unauthenticated();
    }

    const session = await requestAdminApi<AdminSession>('/admin/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    setSessionCookies(cookieStore, session);
    return jsonNoStore(await getPrincipal(session.accessToken));
  } catch (error) {
    if (error instanceof AdminApiError && [401, 403].includes(error.status)) {
      clearSessionCookies(cookieStore);
      return unauthenticated();
    }
    return safeErrorResponse(error);
  }
}

async function getPrincipal(accessToken: string): Promise<AdminPrincipal> {
  const value = await requestAdminApi<AdminPrincipal>('/admin/me', {
    accessToken,
  });
  if (
    !value ||
    value.accountType !== 'ADMIN' ||
    value.status !== 'ACTIVE' ||
    typeof value.userId !== 'string' ||
    typeof value.sessionId !== 'string' ||
    !Array.isArray(value.roles) ||
    !value.roles.every((role) => typeof role === 'string') ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every((p) => typeof p === 'string') ||
    !value.permissions.includes('admin.portal.access')
  ) {
    throw new AdminApiError(403, null);
  }
  return {
    userId: value.userId,
    sessionId: value.sessionId,
    accountType: value.accountType,
    status: value.status,
    roles: value.roles,
    permissions: value.permissions,
  };
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
