import { cookies } from 'next/headers';
import type {
  CreateSellerInput,
  SellerRecord,
} from '@/lib/marketplace-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { marketplaceManagementSafeErrorResponse } from '@/lib/server/marketplace-management-safe-response';
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
    for (const key of ['status', 'approvalStatus', 'verificationStatus']) {
      const value = url.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const sellers = await requestAdminApi<SellerRecord[]>(
      `/admin/sellers${suffix}`,
      { accessToken },
    );
    return jsonNoStore(sellers);
  } catch (error) {
    return marketplaceManagementSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(request)) as unknown as CreateSellerInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const seller = await requestAdminApi<SellerRecord>('/admin/sellers', {
      method: 'POST',
      body,
      accessToken,
    });
    return jsonNoStore(seller, 201);
  } catch (error) {
    return marketplaceManagementSafeErrorResponse(error);
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
