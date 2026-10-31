import { cookies } from 'next/headers';
import { publicAdminApplicationDetail, type SellerApplicationDetail } from '@/lib/seller-application-review';
import { requestAdminApi } from '@/lib/server/admin-api';
import { safeErrorResponse, jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return jsonNoStore(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
      401,
    );
  }
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return jsonNoStore(
        { error: { code: 'INVALID_APPLICATION', message: 'Invalid application reference.' } },
        400,
      );
    }
    // Never return storage paths or direct document URLs.
    const application = await requestAdminApi<SellerApplicationDetail>(
      `/admin/seller-applications/${id}`,
      { accessToken },
    );
    return jsonNoStore(publicAdminApplicationDetail(application));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
