import { cookies } from 'next/headers';
import type {
  AttributeDefinitionRecord,
  CreateAttributeDefinitionInput,
} from '@/lib/catalog-attribute-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!accessToken) return unauthenticated();

  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();

    for (const key of [
      'groupId',
      'status',
      'dataType',
      'scope',
      'valueSource',
    ]) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const attributes = await requestAdminApi<AttributeDefinitionRecord[]>(
      `/admin/catalog/attributes${suffix}`,
      { accessToken },
    );

    return jsonNoStore(attributes);
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


export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateAttributeDefinitionInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const attribute = await requestAdminApi<AttributeDefinitionRecord>(
      '/admin/catalog/attributes',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(attribute, 201);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}
