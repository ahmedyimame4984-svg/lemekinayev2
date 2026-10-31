import { cookies } from 'next/headers';
import type { AdminImportJobPage } from '@/lib/admin-import-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore, safeErrorResponse } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = ['workflow', 'page', 'pageSize'] as const;

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
    const page = await requestAdminApi<AdminImportJobPage>(
      `/admin/imports/jobs${suffix}`,
      { accessToken, timeoutMs: 20_000 },
    );
    return jsonNoStore(page);
  } catch (error) {
    return safeErrorResponse(error);
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
