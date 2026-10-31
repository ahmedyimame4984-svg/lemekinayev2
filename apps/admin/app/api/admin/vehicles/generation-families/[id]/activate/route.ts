import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unauthorized = () => jsonNoStore(
  { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } }, 401);
const invalidId = () => jsonNoStore(
  { error: { code: 'GENERATION_FAMILY_INVALID_ID', message: 'Invalid record reference.' } }, 400);

export async function POST(request: Request, context: { params: Promise<{ id: string }> },): Promise<Response> {
  try {
    assertSameOrigin(request);
        const { id } = await context.params;
    if (!UUID.test(id)) return invalidId();
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthorized();
    const body = await readJsonObject(request);
    const result = await requestAdminApi<unknown>(
      `/admin/vehicles/generation-families/${id}/activate`,
      { accessToken, method: 'POST', body },
    );
    return jsonNoStore(result);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}
