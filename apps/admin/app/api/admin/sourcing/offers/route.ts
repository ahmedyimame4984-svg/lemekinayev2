import { cookies } from 'next/headers';
import type {
  CreateSupplierOfferInput,
  SupplierOfferRecord,
} from '@/lib/sourcing-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { sourcingManagementSafeErrorResponse } from '@/lib/server/sourcing-management-safe-response';
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
    const query = new URLSearchParams();
    for (const key of ['supplierId', 'productId', 'status', 'currency']) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';

    const records = await requestAdminApi<SupplierOfferRecord[]>(
      `/admin/sourcing/offers${suffix}`,
      { accessToken },
    );
    return jsonNoStore(records);
  } catch (error) {
    return sourcingManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body =
      (await readJsonObject(request)) as unknown as CreateSupplierOfferInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<SupplierOfferRecord>(
      '/admin/sourcing/offers',
      { method: 'POST', body, accessToken },
    );

    return jsonNoStore(record, 201);
  } catch (error) {
    return sourcingManagementSafeErrorResponse(error);
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
