import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const input = await readJsonObject(request);
    if (typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(input.token)) {
      return jsonNoStore({ error: { code: 'INVALID_VERIFICATION', message: 'The verification link is invalid.' } }, 400);
    }
    await requestSellerApi<void>('/seller/auth/verify-email', {
      method: 'POST',
      body: { token: input.token },
    });
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
