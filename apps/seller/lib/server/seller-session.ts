import 'server-only';

import type { SellerSession } from '../seller-contracts';

const production = process.env.NODE_ENV === 'production';

export const SELLER_ACCESS_COOKIE = production
  ? '__Host-lemekinaye_seller_access'
  : 'lemekinaye_seller_access';

function sellerCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'strict' as const,
    path: '/',
    expires: new Date(expiresAt),
  };
}

interface CookieWriter {
  set(
    name: string,
    value: string,
    options: ReturnType<typeof sellerCookieOptions>,
  ): unknown;
}

export function setSellerSession(
  cookieStore: CookieWriter,
  session: SellerSession,
): void {
  if (
    !session ||
    typeof session.accessToken !== 'string' ||
    !/^[A-Za-z0-9_-]{40,100}$/u.test(session.accessToken) ||
    !(Date.parse(session.accessTokenExpiresAt) > Date.now())
  ) {
    throw new Error('Seller API returned an invalid session');
  }

  cookieStore.set(
    SELLER_ACCESS_COOKIE,
    session.accessToken,
    sellerCookieOptions(session.accessTokenExpiresAt),
  );
}

export function clearSellerSession(cookieStore: CookieWriter): void {
  cookieStore.set(SELLER_ACCESS_COOKIE, '', {
    ...sellerCookieOptions(new Date(0).toISOString()),
  });
}
