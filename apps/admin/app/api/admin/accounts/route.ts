import { cookies } from 'next/headers';
import type { AdminAccountRecord } from '@/lib/admin-account-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { adminAccountSafeErrorResponse } from '@/lib/server/admin-account-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const accounts = await requestAdminApi<AdminAccountRecord[]>(
      '/admin/accounts',
      { accessToken },
    );
    return jsonNoStore(accounts);
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
