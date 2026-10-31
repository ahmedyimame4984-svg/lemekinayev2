import { cookies } from 'next/headers';
import type { SellerSession } from '@/lib/seller-contracts';
import { requestSellerApi } from '@/lib/server/seller-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { setSellerSession } from '@/lib/server/seller-session';
import { jsonNoStore } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request, 4_096);
    const session = await requestSellerApi<SellerSession>(
      '/seller/auth/login',
      { method: 'POST', body },
    );
    const cookieStore = await cookies();
    setSellerSession(cookieStore, {
      accessToken: session.accessToken,
      accessTokenExpiresAt: String(session.accessTokenExpiresAt),
    });
    return jsonNoStore({ accessTokenExpiresAt: session.accessTokenExpiresAt });
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
