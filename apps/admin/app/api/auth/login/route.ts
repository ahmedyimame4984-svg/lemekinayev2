import type { AdminLoginChallenge } from '@/lib/auth-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore, safeErrorResponse } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const challenge = await requestAdminApi<AdminLoginChallenge>(
      '/admin/auth/login',
      {
        method: 'POST',
        body,
      },
    );
    return jsonNoStore(challenge);
  } catch (error) {
    return safeErrorResponse(error);
  }
}
