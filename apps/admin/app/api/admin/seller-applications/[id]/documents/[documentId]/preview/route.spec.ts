import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookies } from 'next/headers';
import { requestAdminApiFile } from '@/lib/server/admin-api';
import { GET } from './route';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/server/admin-api', () => ({ requestAdminApiFile: vi.fn() }));
vi.mock('@/lib/server/session-cookies', () => ({ ACCESS_COOKIE: 'access' }));
vi.mock('@/lib/server/safe-response', () => ({
  jsonNoStore: (data: unknown, status = 200) =>
    Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }),
  safeErrorResponse: () => Response.json({ error: 'unavailable' }, { status: 503 }),
}));

const applicationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const documentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const context = { params: Promise.resolve({ id: applicationId, documentId }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: 'admin-access-token' }),
  } as never);
});

describe('Admin private document preview', () => {
  it('requires the Admin session and never fetches a file for anonymous users', async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(401);
    expect(requestAdminApiFile).not.toHaveBeenCalled();
  });

  it('rejects invalid document identifiers before requesting private storage', async () => {
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: applicationId, documentId: '../other-file' }),
    });
    expect(response.status).toBe(400);
    expect(requestAdminApiFile).not.toHaveBeenCalled();
  });

  it('streams only an authenticated PDF inline with privacy headers', async () => {
    vi.mocked(requestAdminApiFile).mockResolvedValue(
      new Response(new Uint8Array([37, 80, 68, 70]), {
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );
    const response = await GET(new Request('http://localhost'), context);
    expect(requestAdminApiFile).toHaveBeenCalledWith(
      `/admin/seller-applications/${applicationId}/documents/${documentId}/download`,
      'admin-access-token',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects unsupported formats even if the upstream service sends them', async () => {
    vi.mocked(requestAdminApiFile).mockResolvedValue(
      new Response('<script>unsafe</script>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(415);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
