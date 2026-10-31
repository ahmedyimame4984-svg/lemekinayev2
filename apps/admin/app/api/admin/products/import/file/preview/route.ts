import { cookies } from 'next/headers';
import type {
  ProfessionalCatalogArticleImportPreview,
  ProfessionalCatalogArticleImportRequest,
} from '@/lib/product-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const MAX_IMPORT_REQUEST_BYTES = 8_500_000;

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
      MAX_IMPORT_REQUEST_BYTES,
    )) as unknown as ProfessionalCatalogArticleImportRequest;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const result =
      await requestAdminApi<ProfessionalCatalogArticleImportPreview>(
        '/admin/products/import/file/preview',
        {
          method: 'POST',
          body,
          accessToken,
          timeoutMs: 45_000,
        },
      );
    return jsonNoStore(result, 200);
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
