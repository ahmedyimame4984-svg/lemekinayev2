import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientApiError, postJson, withAuthLock } from './client-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Admin client API', () => {
  it('serializes session mutations with the same cross-tab lock', async () => {
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) =>
      callback(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    await withAuthLock(async () => 'completed');
    expect(request).toHaveBeenCalledWith(
      'lemekinaye-admin-session',
      expect.any(Function),
    );
  });

  it('serializes requests within a tab when Web Locks is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const gate = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const order: string[] = [];
    const first = withAuthLock(async () => {
      started.resolve();
      await gate.promise;
      order.push('first');
    });
    await started.promise;
    const second = withAuthLock(async () => {
      order.push('second');
    });
    expect(order).toEqual([]);
    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });
  it('returns a JSON response and uses same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ challengeToken: 'token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      postJson('/api/auth/login', { email: 'admin@example.com' }),
    ).resolves.toEqual({
      challengeToken: 'token',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
  });

  it('handles no-content responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(postJson('/api/auth/logout', {})).resolves.toBeUndefined();
  });

  it('exposes only the BFF safe error payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'AUTHENTICATION_REJECTED',
              message: 'We could not verify those details.',
              retryAfterSeconds: 30,
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(postJson('/api/auth/login', {})).rejects.toEqual(
      expect.objectContaining({
        name: 'ClientApiError',
        code: 'AUTHENTICATION_REJECTED',
        status: 401,
        retryAfterSeconds: 30,
      }),
    );
  });

  it('uses a generic message for non-JSON errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('proxy failure', { status: 502 })),
    );
    await expect(postJson('/api/auth/login', {})).rejects.toEqual(
      expect.objectContaining({
        message: 'The request could not be completed.',
      }),
    );
  });

  it('throws the typed client error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 400 })),
    );
    try {
      await postJson('/api/auth/login', {});
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ClientApiError);
    }
  });
});
