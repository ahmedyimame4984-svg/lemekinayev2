import { cookies } from 'next/headers';
import type {
  MasterDataProvenanceRecord,
  UpdateMasterDataProvenanceInput,
} from '@/lib/vehicle-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; provenanceId: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { id, provenanceId } = await context.params;
    const body = (await readJsonObject(
      request,
    )) as unknown as UpdateMasterDataProvenanceInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<MasterDataProvenanceRecord>(
      `/admin/vehicles/configurations/${id}/provenance/${provenanceId}`,
      { method: 'PATCH', body, accessToken },
    );
    return jsonNoStore(record);
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
