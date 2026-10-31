import { cookies } from 'next/headers';
import type { AdminAccountPage } from '@/lib/admin-account-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { adminAccountSafeErrorResponse } from '@/lib/server/admin-account-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = ['search', 'status', 'page', 'pageSize'] as const;

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
    const page = await requestAdminApi<AdminAccountPage>(
      `/admin/accounts/page${suffix}`,
      { accessToken },
    );

    return jsonNoStore(page);
  } catch (error) {
    return adminAccountSafeErrorResponse(error);
  }
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
