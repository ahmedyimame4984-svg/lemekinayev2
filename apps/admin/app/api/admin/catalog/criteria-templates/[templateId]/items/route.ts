import { cookies } from 'next/headers';
import type {
  CreateCriteriaTemplateItemInput,
  CriteriaTemplateItemRecord,
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
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const { templateId } = await context.params;
    const items = await requestAdminApi<CriteriaTemplateItemRecord[]>(
      `/admin/catalog/criteria-templates/${templateId}/items`,
      { accessToken },
    );
    return jsonNoStore(items);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateCriteriaTemplateItemInput;
    const { templateId } = await context.params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const item = await requestAdminApi<CriteriaTemplateItemRecord>(
      `/admin/catalog/criteria-templates/${templateId}/items`,
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(item, 201);
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
