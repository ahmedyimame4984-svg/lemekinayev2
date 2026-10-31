import { cookies } from 'next/headers';
import type {
  AdminAccountRecord,
  UpdateAdminAccountStatusInput,
} from '@/lib/admin-account-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { adminAccountSafeErrorResponse } from '@/lib/server/admin-account-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(request)) as unknown as UpdateAdminAccountStatusInput;
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const account = await requestAdminApi<AdminAccountRecord>(
      `/admin/accounts/${id}/status`,
      { method: 'PATCH', body, accessToken },
    );
    return jsonNoStore(account);
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
