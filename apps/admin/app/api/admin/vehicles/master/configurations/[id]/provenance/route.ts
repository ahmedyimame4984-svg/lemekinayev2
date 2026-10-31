import { cookies } from 'next/headers';
import type {
  CreateMasterDataProvenanceInput,
  MasterDataProvenanceRecord,
} from '@/lib/vehicle-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const records = await requestAdminApi<MasterDataProvenanceRecord[]>(
      `/admin/vehicles/configurations/${id}/provenance`,
      { accessToken },
    );
    return jsonNoStore(records);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
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
    )) as unknown as CreateMasterDataProvenanceInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<MasterDataProvenanceRecord>(
      `/admin/vehicles/configurations/${id}/provenance`,
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(record, 201);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}
