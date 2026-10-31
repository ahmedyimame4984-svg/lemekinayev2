import { cookies } from 'next/headers';
import type {
  ResolveVehicleIdentifierInput,
  VehicleIdentifierResolution,
} from '@/lib/vehicle-identification-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';

export async function POST(request: Request): Promise<Response> {
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

  try {
    const body = (await request.json()) as ResolveVehicleIdentifierInput;
    const result = await requestAdminApi<VehicleIdentifierResolution>(
      '/admin/vehicles/identifiers/resolve',
      {
        method: 'POST',
        body,
        accessToken,
        timeoutMs: 15_000,
      },
    );
    return jsonNoStore(result);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}
