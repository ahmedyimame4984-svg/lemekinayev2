import 'server-only';

import type { AdminSession } from '../auth-contracts';

const production = process.env.NODE_ENV === 'production';

export const ACCESS_COOKIE = production
  ? '__Host-lemekinaye_admin_access'
  : 'lemekinaye_admin_access';
export const REFRESH_COOKIE = production
  ? '__Host-lemekinaye_admin_refresh'
  : 'lemekinaye_admin_refresh';

export function cookieOptions(expiresAt: string) {
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
    options: ReturnType<typeof cookieOptions>,
  ): unknown;
}

export function assertAdminSession(value: AdminSession): void {
  if (
    !value ||
    typeof value.accessToken !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    typeof value.accessTokenExpiresAt !== 'string' ||
    typeof value.sessionExpiresAt !== 'string' ||
    !/^[A-Za-z0-9_-]{40,100}$/u.test(value.accessToken) ||
    !/^[A-Za-z0-9_-]{40,100}$/u.test(value.refreshToken) ||
    !(Date.parse(value.accessTokenExpiresAt) > Date.now()) ||
    !(
      Date.parse(value.sessionExpiresAt) >=
      Date.parse(value.accessTokenExpiresAt)
    )
  ) {
    throw new Error('Admin API returned an invalid session');
  }
}

export function setSessionCookies(
  cookieStore: CookieWriter,
  session: AdminSession,
): void {
  assertAdminSession(session);
  cookieStore.set(
    ACCESS_COOKIE,
    session.accessToken,
    cookieOptions(session.accessTokenExpiresAt),
  );
  cookieStore.set(
    REFRESH_COOKIE,
    session.refreshToken,
    cookieOptions(session.sessionExpiresAt),
  );
}

export function clearSessionCookies(cookieStore: CookieWriter): void {
  cookieStore.set(ACCESS_COOKIE, '', {
    ...cookieOptions(new Date(0).toISOString()),
  });
  cookieStore.set(REFRESH_COOKIE, '', {
    ...cookieOptions(new Date(0).toISOString()),
  });
}
