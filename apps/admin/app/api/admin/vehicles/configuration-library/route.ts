import { cookies } from 'next/headers';
import type { VehicleConfigurationLibraryPage } from '@/lib/vehicle-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';
import { vehicleSafeErrorResponse } from '@/lib/server/vehicle-safe-response';

const QUERY_KEYS = [
  'search',
  'configurationId',
  'makeId',
  'modelId',
  'generationId',
  'trimId',
  'status',
  'page',
  'pageSize',
  'sortBy',
  'sortDirection',
] as const;

export async function GET(request: Request): Promise<Response> {
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
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();

    for (const key of QUERY_KEYS) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const page = await requestAdminApi<VehicleConfigurationLibraryPage>(
      `/admin/vehicles/configurations/library${suffix}`,
      { accessToken },
    );

    return jsonNoStore(page);
  } catch (error) {
    return vehicleSafeErrorResponse(error);
  }
}
