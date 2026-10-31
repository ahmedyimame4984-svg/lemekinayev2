import { cookies } from 'next/headers';
import type {
  ExternalStandardMappingRecord,
  UpdateExternalStandardMappingInput,
} from '@/lib/catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; mappingId: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { id, mappingId } = await context.params;
    const body = (await readJsonObject(
      request,
    )) as unknown as UpdateExternalStandardMappingInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<ExternalStandardMappingRecord>(
      `/admin/catalog/product-types/${id}/external-mappings/${mappingId}`,
      { method: 'PATCH', body, accessToken },
    );
    return jsonNoStore(record);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; mappingId: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { id, mappingId } = await context.params;
    const body = await readJsonObject(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<ExternalStandardMappingRecord>(
      `/admin/catalog/product-types/${id}/external-mappings/${mappingId}`,
      { method: 'DELETE', body, accessToken },
    );
    return jsonNoStore(record);
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
