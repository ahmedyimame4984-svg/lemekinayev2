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
      input.email.length > 254 ||
      typeof input.password !== 'string' ||
      input.password.length < 12 ||
      input.password.length > 128 ||
      !/\S/u.test(input.password)
    ) {
      return jsonNoStore({
        error: { code: 'INVALID_REGISTRATION', message: 'Enter a valid email and a password of 12–128 characters.' },
      }, 400);
    }
    const result = await requestSellerApi<{ message: string }>('/seller/auth/register', {
      method: 'POST',
      body: { email: input.email, password: input.password },
    });
    return jsonNoStore(result, 202);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
