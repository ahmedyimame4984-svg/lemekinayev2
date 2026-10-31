import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const input = await readJsonObject(request);
    if (
      typeof input.activationToken !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/u.test(input.activationToken) ||
      typeof input.password !== 'string' ||
      input.password.length < 12 ||
      input.password.length > 128
    ) {
      return jsonNoStore({
        error: { code: 'INVALID_ACTIVATION', message: 'The invitation or password is invalid.' },
      }, 400);
    }
    await requestSellerApi<void>('/seller/auth/activate', {
      method: 'POST',
      body: {
        activationToken: input.activationToken,
        password: input.password,
      },
    });
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    });
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
