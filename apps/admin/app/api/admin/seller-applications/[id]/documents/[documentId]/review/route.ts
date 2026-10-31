import { cookies } from 'next/headers';
import type { SellerApplicationDetail } from '@/lib/seller-application-review';
import { publicAdminApplicationDetail } from '@/lib/seller-application-review';
import { requestAdminApi } from '@/lib/server/admin-api';
import { assertSameOrigin, readJsonObject } from '@/lib/server/request-security';
import { safeErrorResponse, jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { id, documentId } = await context.params;
    if (!UUID.test(id) || !UUID.test(documentId)) {
      return jsonNoStore({ error: { code: 'INVALID_DOCUMENT', message: 'Invalid document.' } }, 400);
    }
    const body = await readJsonObject(request);
    if (!['VERIFIED','REJECTED'].includes(String(body.status)) ||
      typeof body.version !== 'number' || !Number.isSafeInteger(body.version) ||
      body.version < 1 ||
      (body.status === 'REJECTED' &&
        (typeof body.reason !== 'string' || body.reason.trim().length < 10))) {
      return jsonNoStore({ error: { code: 'INVALID_DECISION', message: 'Check document status and reason.' } }, 400);
    }
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) return jsonNoStore({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } }, 401);
    const result = await requestAdminApi<SellerApplicationDetail>(
      `/admin/seller-applications/${id}/documents/${documentId}/review`,
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(publicAdminApplicationDetail(result));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
