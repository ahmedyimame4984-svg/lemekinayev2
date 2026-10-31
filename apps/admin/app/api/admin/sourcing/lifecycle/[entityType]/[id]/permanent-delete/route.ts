import { cookies } from 'next/headers';
import type { DeleteMasterDataRecordResponse } from '@/lib/catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { sourcingManagementSafeErrorResponse } from '@/lib/server/sourcing-management-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(
  request: Request,
  context: { params: Promise<{ entityType: string; id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const { entityType, id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
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

    const result = await requestAdminApi<DeleteMasterDataRecordResponse>(
      `/admin/sourcing/lifecycle/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}/permanent-delete`,
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(result);
  } catch (error) {
    return sourcingManagementSafeErrorResponse(error);
  }
}
