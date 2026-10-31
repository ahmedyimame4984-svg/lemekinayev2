import { cookies } from 'next/headers';
import type { VehicleMasterResource } from '@/lib/vehicle-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import {
  assertSameOrigin,
  readJsonObject,
} from '@/lib/server/request-security';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';

const RESOURCES = new Set<VehicleMasterResource>([
  'derivatives',
  'generations',
  'trims',
  'engines',
  'transmissions',
  'body-types',
  'markets',
  'configurations',
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const { resource } = await context.params;
    if (!isResource(resource)) return notFound();

    const url = new URL(request.url);
    const suffix = url.search ? url.search : '';
    const records = await requestAdminApi<unknown[]>(
      `/admin/vehicles/${resource}${suffix}`,
      { accessToken },
    );
    return jsonNoStore(records);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { resource } = await context.params;
    if (!isResource(resource)) return notFound();

    const body = await readJsonObject(request);
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    if (!accessToken) return unauthenticated();

    const record = await requestAdminApi<unknown>(
      `/admin/vehicles/${resource}`,
      { method: 'POST', body, accessToken },
    );
    return jsonNoStore(record, 201);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}

function isResource(value: string): value is VehicleMasterResource {
  return RESOURCES.has(value as VehicleMasterResource);
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}

function notFound(): Response {
  return jsonNoStore(
    { error: { code: 'VEHICLE_RESOURCE_NOT_FOUND', message: 'Vehicle resource was not found.' } },
    404,
  );
}
