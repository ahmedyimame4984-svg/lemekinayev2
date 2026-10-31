import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore } from '@/lib/server/safe-response';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const unauthorized = () => jsonNoStore(
  { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } }, 401);

export async function GET(request: Request): Promise<Response> {
  try {
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    for (const key of ['makeId', 'modelId', 'status', 'search', 'page', 'pageSize']) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size ? `?${query.toString()}` : '';
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthorized();
    const result = await requestAdminApi<unknown>(
      `/admin/vehicles/generation-families/page${suffix}`,
      { accessToken },
    );
    return jsonNoStore(result);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}
