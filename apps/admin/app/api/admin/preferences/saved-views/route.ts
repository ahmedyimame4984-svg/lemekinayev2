import { cookies } from 'next/headers';
import type {
  AdminSavedViewRecord,
  CreateAdminSavedViewInput,
} from '@/lib/admin-saved-view-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { adminPreferencesSafeErrorResponse } from '@/lib/server/admin-preferences-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const source = new URL(request.url).searchParams;
    const scope = source.get('scope') ?? '';
    const views = await requestAdminApi<AdminSavedViewRecord[]>(
      `/admin/preferences/saved-views?scope=${encodeURIComponent(scope)}`,
      { accessToken },
    );
    return jsonNoStore(views);
  } catch (error) {
    return adminPreferencesSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateAdminSavedViewInput;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const view = await requestAdminApi<AdminSavedViewRecord>(
      '/admin/preferences/saved-views',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );
    return jsonNoStore(view, 201);
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
