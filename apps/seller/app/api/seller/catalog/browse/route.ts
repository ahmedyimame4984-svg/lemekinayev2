import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { SELLER_ACCESS_COOKIE } from '@/lib/server/seller-session';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function GET(request: Request): Promise<Response> {
  try {
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to browse Articles.' } }, 401);
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length > 120) return jsonNoStore({ error: { code: 'QUERY_TOO_LONG', message: 'Search must be 120 characters or fewer.' } }, 400);
    const search = new URLSearchParams();
    if (q.length >= 2) search.set('q', q);
    return jsonNoStore(await requestSellerApi(`/seller/catalog/browse${search.size ? '?'+search.toString() : ''}`, { accessToken }));
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
