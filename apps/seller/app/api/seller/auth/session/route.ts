import { cookies } from 'next/headers';
import type { SellerPrincipal } from '@/lib/seller-contracts';
import { SellerApiError, requestSellerApi } from '@/lib/server/seller-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import {
  SELLER_ACCESS_COOKIE,
  clearSellerSession,
} from '@/lib/server/seller-session';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    await readJsonObject(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    try {
      const principal = await requestSellerApi<SellerPrincipal>('/auth/me', {
        accessToken,
      });
      if (
        principal.accountType !== 'SELLER' ||
        principal.status !== 'ACTIVE' ||
        typeof principal.userId !== 'string' ||
        typeof principal.sessionId !== 'string'
      ) {
        clearSellerSession(cookieStore);
        return unauthenticated();
      }
      return jsonNoStore(principal);
    } catch (error) {
      if (error instanceof SellerApiError && [401, 403].includes(error.status)) {
        clearSellerSession(cookieStore);
        return unauthenticated();
      }
      throw error;
    }
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}
