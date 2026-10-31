import { cookies } from 'next/headers';
import { getSellerDocumentPreviewMimeType } from '@/lib/seller-document-preview';
import { requestAdminApiFile } from '@/lib/server/admin-api';
import { safeErrorResponse, jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
): Promise<Response> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return jsonNoStore(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
      401,
    );
  }

  try {
    const { id, documentId } = await context.params;
    if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(documentId)) {
      return jsonNoStore(
        { error: { code: 'INVALID_DOCUMENT', message: 'Invalid document.' } },
        400,
      );
    }

    // The existing API enforces seller.manage and application/document ownership.
    // No private storage path or permanent document URL is exposed.
    const upstream = await requestAdminApiFile(
      `/admin/seller-applications/${id}/documents/${documentId}/download`,
      accessToken,
    );
    const mimeType = getSellerDocumentPreviewMimeType(
      upstream.headers.get('content-type'),
    );
    if (!mimeType) {
      await upstream.body?.cancel();
      return jsonNoStore(
        { error: { code: 'DOCUMENT_PREVIEW_UNAVAILABLE', message: 'This file cannot be previewed.' } },
        415,
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
