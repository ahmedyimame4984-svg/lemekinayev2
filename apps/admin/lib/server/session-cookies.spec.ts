import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Production Admin cookies', () => {
  it('enforces host-only Secure, HttpOnly, SameSite cookies in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { ACCESS_COOKIE, REFRESH_COOKIE, setSessionCookies } =
      await import('./session-cookies');
    const set = vi.fn();
    const expires = new Date(Date.now() + 60_000).toISOString();
    setSessionCookies(
      { set },
      {
        accessToken: 'a'.repeat(43),
        refreshToken: 'r'.repeat(43),
        accessTokenExpiresAt: expires,
        sessionExpiresAt: expires,
      },
    );
    expect(ACCESS_COOKIE).toMatch(/^__Host-/);
    expect(REFRESH_COOKIE).toMatch(/^__Host-/);
    const options = set.mock.calls[0][2];
    expect(options).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      expires: new Date(expires),
    });
    expect(options).not.toHaveProperty('domain');
  });

  it('rejects already expired sessions', async () => {
    const { assertAdminSession } = await import('./session-cookies');
    expect(() =>
      assertAdminSession({
        accessToken: 'a'.repeat(43),
        refreshToken: 'r'.repeat(43),
        accessTokenExpiresAt: new Date(0).toISOString(),
        sessionExpiresAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
