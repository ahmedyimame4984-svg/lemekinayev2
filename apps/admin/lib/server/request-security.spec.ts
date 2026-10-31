import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('server-only', () => ({}));

let security: typeof import('./request-security');

beforeAll(async () => {
  security = await import('./request-security');
});
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ADMIN_APP_ORIGIN', 'http://localhost:3001');
});
afterEach(() => vi.unstubAllEnvs());

describe('BFF request security', () => {
  it('allows a matching origin', () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      headers: {
        origin: 'http://localhost:3001',
        'sec-fetch-site': 'same-origin',
      },
    });
    expect(() => security.assertSameOrigin(request)).not.toThrow();
  });

  it('rejects requests without origin evidence', () => {
    expect(() =>
      security.assertSameOrigin(
        new Request('http://localhost:3001/api/auth/login'),
      ),
    ).toThrow();
  });

  it('accepts same-origin fetch metadata when Origin is absent', () => {
    expect(() =>
      security.assertSameOrigin(
        new Request('http://localhost:3001/api/auth/session', {
          headers: { 'sec-fetch-site': 'same-origin' },
        }),
      ),
    ).not.toThrow();
  });

  it('uses the configured public origin behind a reverse proxy', () => {
    vi.stubEnv('ADMIN_APP_ORIGIN', 'https://admin.example.com');
    expect(() =>
      security.assertSameOrigin(
        new Request('http://internal:3001/api/auth/session', {
          headers: { origin: 'https://admin.example.com' },
        }),
      ),
    ).not.toThrow();
  });

  it('requires a configured origin in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_APP_ORIGIN', '');
    expect(() =>
      security.assertSameOrigin(new Request('http://localhost:3001')),
    ).toThrow('ADMIN_APP_ORIGIN');
  });

  it('rejects a mismatched origin', () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      headers: { origin: 'https://attacker.example' },
    });
    expect(() => security.assertSameOrigin(request)).toThrow(
      'Cross-site request rejected',
    );
  });

  it('rejects an explicitly cross-site request', () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(() => security.assertSameOrigin(request)).toThrow(
      'Cross-site request rejected',
    );
  });

  it('reads a JSON object', async () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    });
    await expect(security.readJsonObject(request)).resolves.toEqual({
      email: 'admin@example.com',
    });
  });

  it('rejects arrays and malformed JSON', async () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[]',
    });
    await expect(security.readJsonObject(request)).rejects.toThrow(
      'Request body must be valid JSON',
    );
  });

  it('rejects oversized bodies', async () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(200) }),
    });
    await expect(security.readJsonObject(request, 32)).rejects.toThrow(
      'Request is too large',
    );
  });

  it('rejects a simple cross-site form content type', async () => {
    const request = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    await expect(security.readJsonObject(request)).rejects.toMatchObject({
      status: 415,
    });
  });

  it('stops reading a chunked body after the limit is exceeded', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(40));
      },
      cancel,
    });
    const request = new Request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);
    await expect(security.readJsonObject(request, 32)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
