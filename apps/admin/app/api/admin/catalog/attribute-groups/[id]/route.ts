import { cookies } from 'next/headers';
import type {
  AttributeGroupRecord,
  UpdateAttributeGroupInput,
} from '@/lib/catalog-attribute-contracts';
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
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = (await readJsonObject(
      request,
    )) as unknown as UpdateAttributeGroupInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const group = await requestAdminApi<AttributeGroupRecord>(
      `/admin/catalog/attribute-groups/${id}`,
      {
        method: 'PATCH',
        body,
        accessToken,
      },
    );
    return jsonNoStore(group);
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
