import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { noContent, safeErrorResponse } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    await requestAdminApi<void>('/admin/auth/activate/verify', {
      method: 'POST',
      body,
    });
    return noContent();
  } catch (error) {
    return safeErrorResponse(error);
  }
}
