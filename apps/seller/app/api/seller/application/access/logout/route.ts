import { cookies } from 'next/headers';
import { APPLICATION_ACCESS_COOKIE, clearApplicantSession } from '@/lib/server/applicant-session';
import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const store = await cookies();
    const token = store.get(APPLICATION_ACCESS_COOKIE)?.value;
    if (token) {
      await requestSellerApi<void>('/seller/registration/access/logout', {
        method: 'POST',
        accessToken: token,
      });
    }
    clearApplicantSession(store);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
