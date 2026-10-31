import { cookies } from 'next/headers';
import type {
  DeleteMasterDataRecordResponse,
  MasterDataLifecycleState,
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
  context: { params: Promise<{ entityType: string; id: string }> },
): Promise<Response> {
  try {
    const { entityType, id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) return unauthenticated();

    const state = await requestAdminApi<MasterDataLifecycleState>(
      `/admin/catalog/lifecycle/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`,
      { accessToken },
    );
    return jsonNoStore(state);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ entityType: string; id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const { entityType, id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) return unauthenticated();

    const state = await requestAdminApi<MasterDataLifecycleState>(
      `/admin/catalog/lifecycle/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body,
        accessToken,
      },
    );
    return jsonNoStore(state);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}


export async function DELETE(
  request: Request,
  context: { params: Promise<{ entityType: string; id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const { entityType, id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) return unauthenticated();

    const result = await requestAdminApi<DeleteMasterDataRecordResponse>(
      `/admin/catalog/lifecycle/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        body,
        accessToken,
      },
    );
    return jsonNoStore(result);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in to continue.',
      },
    },
    401,
  );
}
