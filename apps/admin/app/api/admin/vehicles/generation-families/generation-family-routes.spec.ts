import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cookieGet: vi.fn(), requestAdminApi: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: mocks.cookieGet })) }));
vi.mock('@/lib/server/admin-api', () => ({
  AdminApiError: class extends Error { constructor(readonly status: number, readonly retryAfter: string | null, readonly apiCode?: string) { super('Upstream error'); } },
  requestAdminApi: mocks.requestAdminApi,
}));
import { GET as page } from './page/route';
import { POST as create } from './route';
import { PATCH as members } from './[id]/members/route';
import { AdminApiError } from '@/lib/server/admin-api';
const origin = process.env.ADMIN_APP_ORIGIN ?? 'http://admin.local';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); mocks.cookieGet.mockReturnValue({ value: 'synthetic-test-token' }); });

describe('Family BFF protection and filter contracts', () => {
  it('forwards cascading Make/Model filters and drops unsupported query parameters', async () => {
    mocks.requestAdminApi.mockResolvedValue({ items: [], total: 0 });
    expect((await page(new Request(`${origin}/api/admin/vehicles/generation-families/page?makeId=${id}&modelId=${id}&page=2&unsafe=1`))).status).toBe(200);
    expect(mocks.requestAdminApi).toHaveBeenCalledWith(`/admin/vehicles/generation-families/page?makeId=${id}&modelId=${id}&page=2`, expect.objectContaining({ accessToken: 'synthetic-test-token' }));
  });
  it('never sends an unauthenticated mutation upstream', async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await create(new Request(`${origin}/api/admin/vehicles/generation-families`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' }));
    expect(response.status).toBe(401);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
  it('rejects cross-origin membership writes before API access', async () => {
    const response = await members(new Request(`${origin}/api/admin/vehicles/generation-families/${id}/members`, { method: 'PATCH', headers: { origin: 'https://untrusted.invalid', 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, generationIds: [] }) }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(403);
    expect(mocks.requestAdminApi).not.toHaveBeenCalled();
  });
  it('shows a recoverable conflict message without exposing raw server errors', async () => {
    mocks.requestAdminApi.mockRejectedValue(new AdminApiError(409, null, 'GENERATION_FAMILY_VERSION_CONFLICT'));
    const response = await page(new Request(`${origin}/api/admin/vehicles/generation-families/page`));
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toMatch(/Reload the latest record/);
  });
});
