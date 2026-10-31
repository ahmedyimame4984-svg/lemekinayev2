import { cookies } from 'next/headers';
import type {
  CreateUnitOfMeasureInput,
  UnitOfMeasureRecord,
} from '@/lib/catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();
  try {
    const status = new URL(request.url).searchParams.get('status');
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    const records = await requestAdminApi<UnitOfMeasureRecord[]>(
      `/admin/catalog/units-of-measure${suffix}`,
      { accessToken },
    );
    return jsonNoStore(records);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(request)) as unknown as CreateUnitOfMeasureInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();
    const record = await requestAdminApi<UnitOfMeasureRecord>(
      '/admin/catalog/units-of-measure',
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(record, 201);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}
