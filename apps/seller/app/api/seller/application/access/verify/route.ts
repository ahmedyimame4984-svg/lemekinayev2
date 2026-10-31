import { cookies } from 'next/headers';
import { requestSellerApi } from '@/lib/server/seller-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { setApplicantSession } from '@/lib/server/applicant-session';
import { parseApplicationAccessInput } from '@/lib/application-access';

interface VerifyResult {
  accessToken: string;
  expiresInSeconds: number;
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const identity = parseApplicationAccessInput(body);
    if (typeof body.code !== 'string' || !/^\d{6}$/u.test(body.code)) {
      return jsonNoStore({
        error: { code: 'INVALID_VERIFICATION_CODE', message: 'Enter your six-digit code.' },
      }, 400);
    }
    const result = await requestSellerApi<VerifyResult>('/seller/registration/access/verify', {
      method: 'POST',
      body: { ...identity, code: body.code },
    });
    setApplicantSession(await cookies(), result.accessToken, result.expiresInSeconds);
    return jsonNoStore({ verified: true });
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
