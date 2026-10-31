import { cookies } from 'next/headers';
import type {
  CreateVehicleMakeInput,
  VehicleMakeRecord,
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

    if (status) query.set('status', status);

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const makes = await requestAdminApi<VehicleMakeRecord[]>(
      `/admin/vehicles/makes${suffix}`,
      { accessToken },
    );

    return jsonNoStore(makes);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJsonObject(
      request,
    )) as unknown as CreateVehicleMakeInput;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
      return unauthenticated();
    }

    const make = await requestAdminApi<VehicleMakeRecord>(
      '/admin/vehicles/makes',
      {
        method: 'POST',
        body,
        accessToken,
      },
    );

    return jsonNoStore(make, 201);
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
