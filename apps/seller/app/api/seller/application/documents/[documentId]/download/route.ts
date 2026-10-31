import { cookies } from 'next/headers';
import { requestSellerApiFile } from '@/lib/server/seller-api';
import { sellerSafeErrorResponse } from '@/lib/server/seller-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { APPLICATION_ACCESS_COOKIE } from '@/lib/server/applicant-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  try {
    const token = (await cookies()).get(APPLICATION_ACCESS_COOKIE)?.value;
    if (!token) return jsonNoStore({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Verify your contact email again.' },
    }, 401);
    const { documentId } = await context.params;
    if (!UUID.test(documentId)) return jsonNoStore({
      error: { code: 'INVALID_DOCUMENT', message: 'Invalid document.' },
    }, 400);
    const result = await requestSellerApiFile(
      `/seller/registration/access/application/documents/${documentId}/download`,
      token,
    );
    return new Response(result.body, {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Content-Type': result.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': result.headers.get('content-disposition') || 'attachment',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return sellerSafeErrorResponse(error);
  }
}
