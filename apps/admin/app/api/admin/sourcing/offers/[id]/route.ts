import { cookies } from 'next/headers';
import type {
  SupplierOfferRecord,
  UpdateSupplierOfferInput,
} from '@/lib/sourcing-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { sourcingManagementSafeErrorResponse } from '@/lib/server/sourcing-management-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body =
      (await readJsonObject(request)) as unknown as UpdateSupplierOfferInput;
    const { id } = await context.params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<SupplierOfferRecord>(
      `/admin/sourcing/offers/${id}`,
      { method: 'PATCH', body, accessToken },
    );

    return jsonNoStore(record);
  } catch (error) {
    return sourcingManagementSafeErrorResponse(error);
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
