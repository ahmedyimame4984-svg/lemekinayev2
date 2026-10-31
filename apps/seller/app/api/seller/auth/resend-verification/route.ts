import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const input = await readJsonObject(request);
    if (
      typeof input.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input.email) ||
      input.email.length > 254
    ) {
      return jsonNoStore({ error: { code: 'INVALID_EMAIL', message: 'Provide a valid email address.' } }, 400);
    }
    const result = await requestSellerApi<{ message: string }>('/seller/auth/resend-verification', {
      method: 'POST',
      body: { email: input.email },
    });
    return jsonNoStore(result, 202);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
