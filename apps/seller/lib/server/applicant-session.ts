import 'server-only';

const production = process.env.NODE_ENV === 'production';

export const APPLICATION_ACCESS_COOKIE = production
  ? '__Host-lemekinaye_application_access'
  : 'lemekinaye_application_access';

interface CookieWriter {
  set(name: string, value: string, options: {
    httpOnly: true;
    secure: boolean;
    sameSite: 'strict';
    path: '/';
    maxAge: number;
  }): unknown;
}

export function setApplicantSession(
  cookies: CookieWriter,
  token: string,
  expiresInSeconds: number,
): void {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token) ||
      !Number.isSafeInteger(expiresInSeconds) ||
      expiresInSeconds < 1 || expiresInSeconds > 1800) {
    throw new Error('Invalid applicant session received');
  }
  cookies.set(APPLICATION_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    path: '/',
    maxAge: expiresInSeconds,
  });
}

export function clearApplicantSession(cookies: CookieWriter): void {
  cookies.set(APPLICATION_ACCESS_COOKIE, '', {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
