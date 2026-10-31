import { cookies } from 'next/headers';
import type {
  CriteriaTemplateApplyInput,
  CriteriaTemplateApplyResult,
} from '@/lib/catalog-attribute-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string; templateId: string }>;
  },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CriteriaTemplateApplyInput;
    const { id, templateId } = await context.params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const result = await requestAdminApi<CriteriaTemplateApplyResult>(
      `/admin/catalog/product-types/${id}/criteria-templates/${templateId}/apply`,
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(result, 201);
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
