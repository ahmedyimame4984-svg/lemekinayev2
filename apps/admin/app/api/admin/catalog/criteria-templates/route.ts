import { cookies } from 'next/headers';
import type {
  CreateCriteriaTemplateInput,
  CriteriaTemplateRecord,
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
    for (const key of ['productFamilyId', 'productTypeId', 'status']) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';

    const templates = await requestAdminApi<CriteriaTemplateRecord[]>(
      `/admin/catalog/criteria-templates${suffix}`,
      { accessToken },
    );
    return jsonNoStore(templates);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateCriteriaTemplateInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const template = await requestAdminApi<CriteriaTemplateRecord>(
      '/admin/catalog/criteria-templates',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );
    return jsonNoStore(template, 201);
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
