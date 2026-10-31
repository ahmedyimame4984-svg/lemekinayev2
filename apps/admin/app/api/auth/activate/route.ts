import type { AdminActivationChallenge } from '@/lib/auth-contracts';
import QRCode from 'qrcode';
import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore, safeErrorResponse } from '@/lib/server/safe-response';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const challenge = await requestAdminApi<AdminActivationChallenge>(
      '/admin/auth/activate',
      { method: 'POST', body },
    );
    // Generate locally: the authenticator secret never goes to a QR service.
    const qrCodeDataUrl = await QRCode.toDataURL(challenge.otpauthUri, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return jsonNoStore({ ...challenge, qrCodeDataUrl });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
