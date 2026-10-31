import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { APPLICATION_ACCESS_COOKIE } from '@/lib/server/applicant-session';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const email = body.contactEmail;
    if (typeof email !== 'string' || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())) {
      return jsonNoStore({
        error: { code: 'INVALID_EMAIL', message: 'Enter a valid new contact email.' },
      }, 400);
    }
    const token = (await cookies()).get(APPLICATION_ACCESS_COOKIE)?.value;
    if (!token) return jsonNoStore({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Verify your original contact email.' },
    }, 401);
    const result = await requestSellerApi<unknown>(
      '/seller/registration/access/application/contact-email/request',
      { method: 'POST', accessToken: token, body: { contactEmail: email.trim().toLowerCase() } },
    );
    return jsonNoStore(result, 202);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
