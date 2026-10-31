import { cookies } from 'next/headers';
import type {
  CategoryRecord,
  CreateCategoryInput,
} from '@/lib/catalog-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return unauthenticated();
  }

  try {
    const categories = await requestAdminApi<CategoryRecord[]>(
      '/admin/catalog/categories',
      {
        accessToken,
      },
    );

    return jsonNoStore(categories);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);

    const body = (await readJsonObject(
      request,
    )) as unknown as CreateCategoryInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
      return unauthenticated();
    }

    const category = await requestAdminApi<CategoryRecord>(
      '/admin/catalog/categories',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(category, 201);
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
