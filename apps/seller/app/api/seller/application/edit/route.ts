import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, RequestInputError } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { APPLICATION_ACCESS_COOKIE, clearApplicantSession } from '@/lib/server/applicant-session';

const MAX_REQUEST_BYTES = 36 * 1024 * 1024;

export async function PATCH(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
      throw new RequestInputError(415, 'Expected multipart application data.');
    }
    const length = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
      throw new RequestInputError(413, 'Application update is too large.');
    }
    const store = await cookies();
    const token = store.get(APPLICATION_ACCESS_COOKIE)?.value;
    if (!token) return jsonNoStore({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Verify your contact email again.' },
    }, 401);
    const formData = await request.formData();
    const result = await requestSellerApi<{
      referenceCode: string;
      status: string;
      version: number;
      emailReverificationRequired: boolean;
    }>('/seller/registration/access/application', {
      method: 'PATCH',
      formData,
      accessToken: token,
      timeoutMs: 30_000,
    });
    if (result.emailReverificationRequired) clearApplicantSession(store);
    return jsonNoStore(result);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
