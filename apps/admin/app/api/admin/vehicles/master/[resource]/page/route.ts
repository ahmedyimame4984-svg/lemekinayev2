import { cookies } from 'next/headers';
import type {
  VehicleEnginePage,
  VehicleGenerationPage,
  VehicleModelDerivativePage,
  VehicleNamedMasterPage,
  VehicleTransmissionPage,
  VehicleTrimPage,
} from '@/lib/vehicle-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';

type PagedMasterResource =
  | 'derivatives'
  | 'generations'
  | 'trims'
  | 'engines'
  | 'transmissions'
  | 'body-types'
  | 'markets';

const RESOURCES = new Set<PagedMasterResource>([
  'derivatives',
  'generations',
  'trims',
  'engines',
  'transmissions',
  'body-types',
  'markets',
]);

type PageResponse =
  | VehicleModelDerivativePage
  | VehicleGenerationPage
  | VehicleTrimPage
  | VehicleEnginePage
  | VehicleTransmissionPage
  | VehicleNamedMasterPage;

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

    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    for (const key of [
      'search',
      'status',
      'modelId',
      'derivativeId',
      'generationId',
      'page',
      'pageSize',
    ] as const) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const page = await requestAdminApi<PageResponse>(
      `/admin/vehicles/${resource}/page${suffix}`,
      { accessToken },
    );
    return jsonNoStore(page);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}

function isResource(value: string): value is PagedMasterResource {
  return RESOURCES.has(value as PagedMasterResource);
}

function unauthenticated(): Response {
  return jsonNoStore(
    { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
    401,
  );
}

function notFound(): Response {
  return jsonNoStore(
    {
      error: {
        code: 'VEHICLE_RESOURCE_NOT_FOUND',
        message: 'Vehicle resource was not found.',
      },
    },
    404,
  );
}
