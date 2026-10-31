import { cookies } from 'next/headers';
import type { AdminSession } from '@/lib/auth-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore, safeErrorResponse } from '@/lib/server/safe-response';
import { setSessionCookies } from '@/lib/server/session-cookies';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const session = await requestAdminApi<AdminSession>(
      '/admin/auth/mfa/verify',
      {
        method: 'POST',
        body,
      },
    );
    setSessionCookies(await cookies(), session);
    return jsonNoStore({ sessionExpiresAt: session.sessionExpiresAt });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
