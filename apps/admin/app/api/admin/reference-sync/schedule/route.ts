import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { assertSameOrigin } from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

async function sessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function GET(): Promise<Response> {
  try {
    const accessToken = await sessionToken();
    if (!accessToken) return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED' } }, 401);
    return jsonNoStore(await requestAdminApi('/admin/reference-sync/schedule', { accessToken }));
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' ||
        !('enabled' in body) || typeof body.enabled !== 'boolean' ||
        !('intervalMinutes' in body) || typeof body.intervalMinutes !== 'number' ||
        !Number.isInteger(body.intervalMinutes) ||
        body.intervalMinutes < 1 || body.intervalMinutes > 1440) {
      return jsonNoStore({ error: { code: 'INVALID_SCHEDULE', message: 'Choose 1 to 1440 minutes.' } }, 400);
    }
    const accessToken = await sessionToken();
    if (!accessToken) return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED' } }, 401);
    return jsonNoStore(await requestAdminApi('/admin/reference-sync/schedule', {
      method: 'PUT', accessToken, body: { enabled: body.enabled, intervalMinutes: body.intervalMinutes },
    }));
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
