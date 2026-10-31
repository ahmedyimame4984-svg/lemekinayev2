import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { SELLER_ACCESS_COOKIE } from '@/lib/server/seller-session';

export async function GET(): Promise<Response> {
  try {
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } }, 401);
    }
    const result = await requestSellerApi('/seller/registration/status', { accessToken });
    return jsonNoStore(result);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
