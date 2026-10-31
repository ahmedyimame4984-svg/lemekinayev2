import { cookies } from 'next/headers';
import type {
  CreateVehicleModelInput,
  VehicleModelRecord,
} from '@/lib/vehicle-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore } from '@/lib/server/safe-response';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return unauthenticated();
  }

  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();
    const status = url.searchParams.get('status');
    const makeId = url.searchParams.get('makeId');

    if (status) query.set('status', status);
    if (makeId) query.set('makeId', makeId);

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const models = await requestAdminApi<VehicleModelRecord[]>(
      `/admin/vehicles/models${suffix}`,
      { accessToken },
    );

    return jsonNoStore(models);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateVehicleModelInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
      return unauthenticated();
    }

    const model = await requestAdminApi<VehicleModelRecord>(
      '/admin/vehicles/models',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(model, 201);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
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
