import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { assertSameOrigin } from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

type Context = { params: Promise<{ action: string }> };
const actions = new Set(['status', 'snapshot', 'incremental', 'reconcile']);

async function proxy(action: string, method: 'GET' | 'POST', body?: unknown): Promise<Response> {
  if (!actions.has(action) || (method === 'GET' && action !== 'status') ||
      (method === 'POST' && action === 'status')) {
    return jsonNoStore({ error: { code: 'INVALID_ACTION', message: 'Unsupported synchronization operation' } }, 404);
  }
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } }, 401);
    }
    const response = await requestAdminApi<unknown>(`/admin/reference-sync/${action}`, {
      method, accessToken, ...(body === undefined ? {} : { body }),
      // A full snapshot can take considerably longer than an ordinary request.
      timeoutMs: method === 'POST' ? 120_000 : 10_000,
    });
    return jsonNoStore(response);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { action } = await context.params;
  return proxy(action, 'GET');
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
  }
  const { action } = await context.params;
  // Only the snapshot endpoint accepts input; prevent forwarding arbitrary payloads.
  if (action === 'snapshot') {
    let data: unknown;
    try { data = await request.json(); } catch { data = {}; }
    const forceFull = Boolean(data && typeof data === 'object' && 'forceFull' in data &&
      (data as {forceFull?: unknown}).forceFull === true);
    return proxy(action, 'POST', { forceFull });
  }
  return proxy(action, 'POST');
}
