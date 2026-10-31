import { cookies } from 'next/headers';
import type {
  CreateExternalStandardMappingInput,
  ExternalStandardMappingRecord,
} from '@/lib/catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const records = await requestAdminApi<ExternalStandardMappingRecord[]>(
      `/admin/catalog/product-types/${id}/external-mappings`,
      { accessToken },
    );
    return jsonNoStore(records);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateExternalStandardMappingInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<ExternalStandardMappingRecord>(
      `/admin/catalog/product-types/${id}/external-mappings`,
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
