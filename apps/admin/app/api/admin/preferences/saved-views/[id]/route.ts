import { cookies } from 'next/headers';
import type {
  AdminSavedViewRecord,
  UpdateAdminSavedViewInput,
} from '@/lib/admin-saved-view-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { adminPreferencesSafeErrorResponse } from '@/lib/server/admin-preferences-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as UpdateAdminSavedViewInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const { id } = await context.params;
    const view = await requestAdminApi<AdminSavedViewRecord>(
      `/admin/preferences/saved-views/${id}`,
      {
        method: 'PATCH',
        body,
        accessToken,
      },
    );
    return jsonNoStore(view);
  } catch (error) {
    return adminPreferencesSafeErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const { id } = await context.params;
    const version = new URL(request.url).searchParams.get('version') ?? '';
    await requestAdminApi<void>(
      `/admin/preferences/saved-views/${id}?version=${encodeURIComponent(version)}`,
      {
        method: 'DELETE',
        accessToken,
      },
    );
    return new Response(null, {
      status: 204,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return adminPreferencesSafeErrorResponse(error);
  }
}

function unauthenticated(): Response {
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
