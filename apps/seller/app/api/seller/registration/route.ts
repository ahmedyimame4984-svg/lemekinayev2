import { cookies } from 'next/headers';
import { SELLER_ACCESS_COOKIE } from '@/lib/server/seller-session';
import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, RequestInputError } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

const MAX_REQUEST_BYTES = 36 * 1024 * 1024;

interface SellerRegistrationResponse {
  referenceCode: string;
  submittedAt: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);

    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('multipart/form-data')) {
      throw new RequestInputError(415, 'Use a multipart/form-data request body');
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      throw new RequestInputError(413, 'Registration submission is too large');
    }

    const accessToken = (await cookies()).get(SELLER_ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return jsonNoStore({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in before submitting your business application.' },
      }, 401);
    }

    const formData = await request.formData();
    const result = await requestSellerApi<SellerRegistrationResponse>(
      '/seller/registration',
      {
        method: 'POST',
        formData,
        accessToken,
        timeoutMs: 30_000,
      },
    );

    return jsonNoStore(result, 201);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
