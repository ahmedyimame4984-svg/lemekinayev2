import 'server-only';

import { cookies } from 'next/headers';
import { requestSellerApi } from './seller-api';
import { assertSameOrigin, readJsonObject, RequestInputError } from './request-security';
import { sellerSafeErrorResponse } from './seller-safe-response';
import { jsonNoStore } from './safe-response';
import { SELLER_ACCESS_COOKIE } from './seller-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validSellerUuid(value: string): string {
  if (!UUID.test(value)) throw new RequestInputError(400, 'Invalid record ID');
  return value;
}

/**
 * Seller-only Next.js BFF. No browser access token or arbitrary upstream path.
 * Every caller passes a fixed API path assembled only from validated UUIDs.
 */
export async function sellerWorkspaceRequest(
  request: Request,
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  created = false,
  timeoutMs?: number,
): Promise<Response> {
  try {
    if (method !== 'GET') assertSameOrigin(request);
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return jsonNoStore({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' },
      }, 401);
    }
    const body = method === 'GET' ? undefined : await readJsonObject(request, 20_000);
    const result = await requestSellerApi(path, {
      method,
      accessToken,
      ...(body === undefined ? {} : { body }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    return jsonNoStore(result, created ? 201 : 200);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
