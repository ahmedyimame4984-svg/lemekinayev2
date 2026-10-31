import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { requestAdminApi } from '@/lib/server/admin-api';
import { marketplaceManagementSafeErrorResponse } from '@/lib/server/marketplace-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; operation?: string[] }> },
) {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return jsonNoStore({ error: {
    code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.',
  } }, 401);
  try {
    const { id, operation = [] } = await context.params;
    if (!UUID.test(id) || (operation.length !== 0 &&
        !(operation.length === 2 && UUID.test(operation[0]!) && operation[1] === 'preview'))) {
      return jsonNoStore({ error: { code: 'INVALID_ASSET_ID', message: 'Invalid listing asset.' } }, 400);
    }
    const path = `/admin/listings/${id}/assets${operation.length ? '/' + operation.join('/') : ''}`;
    const data = await requestAdminApi<unknown>(path, { accessToken });
    return jsonNoStore(data);
  } catch (error) { return marketplaceManagementSafeErrorResponse(error); }
}
