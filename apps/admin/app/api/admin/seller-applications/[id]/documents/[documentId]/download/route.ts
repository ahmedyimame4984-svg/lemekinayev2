import { cookies } from 'next/headers';
import { requestAdminApiFile } from '@/lib/server/admin-api';
import { safeErrorResponse, jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
): Promise<Response> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
  try {
    const { id, documentId } = await context.params;
    if (!UUID.test(id) || !UUID.test(documentId)) {
      return jsonNoStore({ error: { code: 'INVALID_DOCUMENT', message: 'Invalid document.' } }, 400);
    }
    const upstream = await requestAdminApiFile(
      `/admin/seller-applications/${id}/documents/${documentId}/download`,
      accessToken,
    );
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': upstream.headers.get('content-disposition') || 'attachment',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    return new Response(upstream.body, { headers });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
