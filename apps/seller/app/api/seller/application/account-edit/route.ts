import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, RequestInputError } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { SELLER_ACCESS_COOKIE } from '@/lib/server/seller-session';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function PATCH(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    if (!(request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      throw new RequestInputError(415, 'Application form data is required.');
    }
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > 36 * 1024 * 1024) throw new RequestInputError(413, 'Application update is too large.');
    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to edit your application.' } }, 401);
    return jsonNoStore(await requestSellerApi('/seller/registration/application', {
      method: 'PATCH', accessToken, formData: await request.formData(), timeoutMs: 30_000,
    }));
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
