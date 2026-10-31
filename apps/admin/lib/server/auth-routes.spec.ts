import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminPrincipal, AdminSession } from '../auth-contracts';

const jar = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn((name: string) =>
      values.has(name) ? { value: values.get(name) } : undefined,
    ),
    set: vi.fn((name: string, value: string, _options: unknown) => {
      values.set(name, value);
    }),
  };
});
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => jar }));

import { POST as login } from '../../app/api/auth/login/route';
import { POST as mfa } from '../../app/api/auth/mfa/verify/route';
import { POST as currentSession } from '../../app/api/auth/session/route';
import { POST as logout } from '../../app/api/auth/logout/route';
import { POST as activate } from '../../app/api/auth/activate/route';
import { POST as verifyActivation } from '../../app/api/auth/activate/verify/route';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './session-cookies';

const principal: AdminPrincipal = {
  userId: 'test-admin',
  sessionId: 'test-session',
  accountType: 'ADMIN',
  status: 'ACTIVE',
  roles: ['platform-admin'],
  permissions: ['admin.portal.access'],
};
const fetchMock = vi.fn<typeof fetch>();
const session = (): AdminSession => ({
  accessToken: 'a'.repeat(43),
  refreshToken: 'r'.repeat(43),
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  sessionExpiresAt: new Date(Date.now() + 600_000).toISOString(),
});
const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
function request(
  path: string,
  body: unknown = {},
  origin = 'http://localhost:3001',
) {
  return new Request(`http://localhost:3001/api/auth/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { origin, 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  jar.values.clear();
  jar.get.mockClear();
  jar.set.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('ADMIN_API_BASE_URL', 'http://127.0.0.1:3000/api/v1');
  vi.stubEnv('ADMIN_APP_ORIGIN', 'http://localhost:3001');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Admin authentication route contracts', () => {
  it('does not issue session cookies after password-only login', async () => {
    fetchMock.mockResolvedValue(
      json({
        challengeToken: 'c'.repeat(43),
        expiresAt: new Date().toISOString(),
      }),
    );
    const response = await login(
      request('login', {
        email: 'admin@example.com',
        password: 'test passphrase',
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(jar.set).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/admin/auth/login',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        redirect: 'error',
      }),
    );
  });

  it('puts tokens only in HttpOnly cookies after successful MFA', async () => {
    const issued = session();
    fetchMock.mockResolvedValue(json(issued));
    const response = await mfa(
      request('mfa/verify', { challengeToken: 'c'.repeat(43), code: '123456' }),
    );
    expect(await response.json()).toEqual({
      sessionExpiresAt: issued.sessionExpiresAt,
    });
    expect(jar.set).toHaveBeenCalledWith(
      ACCESS_COOKIE,
      issued.accessToken,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
    expect(jar.set).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      issued.refreshToken,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects malformed upstream session payloads without writing cookies', async () => {
    fetchMock.mockResolvedValue(json({ ...session(), accessToken: 'bad' }));
    expect((await mfa(request('mfa/verify'))).status).toBe(503);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('returns safe errors without leaking upstream exceptions', async () => {
    fetchMock.mockResolvedValue(
      json({ message: 'private-database-password' }, 500),
    );
    const response = await login(request('login'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-database-password');
  });

  it('preserves upstream rate-limit guidance', async () => {
    fetchMock.mockResolvedValue(json({}, 429, { 'retry-after': '30' }));
    const response = await login(request('login'));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(await response.json()).toMatchObject({
      error: { retryAfterSeconds: 30 },
    });
  });

  it.each([login, mfa, currentSession, logout, activate, verifyActivation])(
    'rejects cross-origin auth mutation before contacting API',
    async (handler) => {
      expect(
        (await handler(request('login', {}, 'https://attacker.example')))
          .status,
      ).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(jar.set).not.toHaveBeenCalled();
    },
  );

  it('returns enrollment data without issuing a session', async () => {
    const enrollment = {
      challengeToken: 'c'.repeat(43),
      secret: 'TESTONLY',
      otpauthUri: 'otpauth://totp/test',
      expiresAt: new Date().toISOString(),
    };
    fetchMock.mockResolvedValue(json(enrollment));
    const response = await activate(request('activate'));
    expect(await response.json()).toEqual({
      ...enrollment,
      qrCodeDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
    });
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('completes activation without logging the user in', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect((await verifyActivation(request('activate/verify'))).status).toBe(
      204,
    );
    expect(jar.set).not.toHaveBeenCalled();
  });
});

describe('Admin session lifecycle', () => {
  it('checks access against the Admin-only API', async () => {
    jar.values.set(ACCESS_COOKIE, 'a'.repeat(43));
    fetchMock.mockResolvedValue(json(principal));
    const response = await currentSession(request('session'));
    expect(await response.json()).toEqual(principal);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/admin/me');
    expect(new Headers(options?.headers).get('authorization')).toBe(
      `Bearer ${'a'.repeat(43)}`,
    );
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('renews expired access, rotates both cookies, and verifies the renewed identity', async () => {
    jar.values.set(ACCESS_COOKIE, 'old-access');
    jar.values.set(REFRESH_COOKIE, 'old-refresh');
    const issued = session();
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json(issued))
      .mockResolvedValueOnce(json(principal));
    const response = await currentSession(request('session'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(principal);
    expect(fetchMock.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ refreshToken: 'old-refresh' }),
    );
    expect(jar.values.get(ACCESS_COOKIE)).toBe(issued.accessToken);
    expect(jar.values.get(REFRESH_COOKIE)).toBe(issued.refreshToken);
  });

  it('can renew after the browser expires the access cookie', async () => {
    jar.values.set(REFRESH_COOKIE, 'old-refresh');
    fetchMock
      .mockResolvedValueOnce(json(session()))
      .mockResolvedValueOnce(json(principal));
    expect((await currentSession(request('session'))).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain('/admin/auth/refresh');
  });

  it('clears rejected refresh cookies and requires login', async () => {
    jar.values.set(REFRESH_COOKIE, 'revoked');
    fetchMock.mockResolvedValue(json({}, 401));
    expect((await currentSession(request('session'))).status).toBe(401);
    expect(jar.set).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      '',
      expect.objectContaining({ expires: new Date(0) }),
    );
  });

  it('does not discard a session during an API outage', async () => {
    jar.values.set(ACCESS_COOKIE, 'existing');
    jar.values.set(REFRESH_COOKIE, 'existing-refresh');
    fetchMock.mockRejectedValue(new Error('network outage'));
    expect((await currentSession(request('session'))).status).toBe(503);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it('rejects non-Admin or unprivileged identities', async () => {
    jar.values.set(ACCESS_COOKIE, 'existing');
    fetchMock.mockResolvedValue(json({ ...principal, permissions: [] }));
    expect((await currentSession(request('session'))).status).toBe(401);
    expect(jar.values.get(ACCESS_COOKIE)).toBe('');
  });

  it('requires login when both cookies are absent', async () => {
    expect((await currentSession(request('session'))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes the server session before clearing cookies on logout', async () => {
    jar.values.set(REFRESH_COOKIE, 'current-refresh');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect((await logout(request('logout'))).status).toBe(204);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ refreshToken: 'current-refresh' }),
    );
    expect(jar.values.get(REFRESH_COOKIE)).toBe('');
  });

  it('keeps cookies on a failed logout so revocation can be retried', async () => {
    jar.values.set(REFRESH_COOKIE, 'current-refresh');
    fetchMock.mockRejectedValue(new Error('offline'));
    expect((await logout(request('logout'))).status).toBe(503);
    expect(jar.set).not.toHaveBeenCalled();
  });
});
