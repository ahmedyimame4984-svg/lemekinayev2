import { cookies } from 'next/headers';
import type {
  AdminProvisioningRecord,
  ProvisionAdminInput,
} from '@/lib/admin-account-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { adminAccountSafeErrorResponse } from '@/lib/server/admin-account-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as ProvisionAdminInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
      return jsonNoStore(
        {
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Sign in to continue.',
          },
        },
        401,
      );
    }

    const provisioned = await requestAdminApi<AdminProvisioningRecord>(
      '/admin/accounts/provision',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(provisioned, 201);
  } catch (error) {
    return adminAccountSafeErrorResponse(error);
  }
}
