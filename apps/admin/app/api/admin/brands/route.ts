import { cookies } from 'next/headers';
import type {
  BrandRecord,
  CreateBrandInput,
} from '@/lib/product-identity-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    const brands = await requestAdminApi<BrandRecord[]>(
      `/admin/brands${suffix}`,
      { accessToken },
    );
    return jsonNoStore(brands);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(request)) as unknown as CreateBrandInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const brand = await requestAdminApi<BrandRecord>('/admin/brands', {
      method: 'POST',
      body,
      accessToken,
    });
    return jsonNoStore(brand, 201);
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
