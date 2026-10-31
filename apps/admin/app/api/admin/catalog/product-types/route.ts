import { cookies } from 'next/headers';
import type {
  CreateProductTypeInput,
  ProductTypeRecord,
} from '@/lib/catalog-contracts';
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

  if (!accessToken) {
    return unauthenticated();
  }

  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();
    const status = url.searchParams.get('status');
    const categoryId = url.searchParams.get('categoryId');
    const productFamilyId = url.searchParams.get('productFamilyId');

    if (status) query.set('status', status);
    if (categoryId) query.set('categoryId', categoryId);
    if (productFamilyId) query.set('productFamilyId', productFamilyId);

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const productTypes = await requestAdminApi<ProductTypeRecord[]>(
      `/admin/catalog/product-types${suffix}`,
      { accessToken },
    );

    return jsonNoStore(productTypes);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateProductTypeInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
      return unauthenticated();
    }

    const productType = await requestAdminApi<ProductTypeRecord>(
      '/admin/catalog/product-types',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(productType, 201);
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
