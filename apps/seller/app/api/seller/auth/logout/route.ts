import { cookies } from 'next/headers';
import { SellerApiError, requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import {
  SELLER_ACCESS_COOKIE,
  clearSellerSession,
} from '@/lib/server/seller-session';
import { noContent } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(SELLER_ACCESS_COOKIE)?.value;
    if (accessToken) {
      try {
        await requestSellerApi<void>('/auth/logout', {
          method: 'POST',
          accessToken,
        });
      } catch (error) {
        if (!(error instanceof SellerApiError) || error.status !== 401) {
          throw error;
        }
      }
    }
    clearSellerSession(cookieStore);
    return noContent();
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
