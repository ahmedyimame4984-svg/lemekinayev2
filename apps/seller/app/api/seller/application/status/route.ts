import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { APPLICATION_ACCESS_COOKIE } from '@/lib/server/applicant-session';

export async function GET(): Promise<Response> {
  try {
    const token = (await cookies()).get(APPLICATION_ACCESS_COOKIE)?.value;
    if (!token) {
      return jsonNoStore(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Verify your contact email to continue.' } },
        401,
      );
    }
    const application = await requestSellerApi<unknown>('/seller/registration/access/application', {
      accessToken: token,
    });
    return jsonNoStore(application);
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
