import { cookies } from 'next/headers';
import type {
  AttributeAllowedValueRecord,
  CreateAttributeAllowedValueInput,
} from '@/lib/catalog-attribute-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const query = new URLSearchParams();
    const status = url.searchParams.get('status');
    if (status) query.set('status', status);

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const values = await requestAdminApi<AttributeAllowedValueRecord[]>(
      `/admin/catalog/attributes/${id}/values${suffix}`,
      { accessToken },
    );

    return jsonNoStore(values);
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
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateAttributeAllowedValueInput;
    const { id } = await context.params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const value = await requestAdminApi<AttributeAllowedValueRecord>(
      `/admin/catalog/attributes/${id}/values`,
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(value, 201);
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
