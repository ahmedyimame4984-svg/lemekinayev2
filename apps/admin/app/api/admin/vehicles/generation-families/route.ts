import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const unauthorized = () => jsonNoStore(
  { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } }, 401);

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthorized();
    const body = await readJsonObject(request);
    const result = await requestAdminApi<unknown>(
      '/admin/vehicles/generation-families',
      { accessToken, method: 'POST', body },
    );
    return jsonNoStore(result, 201);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}
