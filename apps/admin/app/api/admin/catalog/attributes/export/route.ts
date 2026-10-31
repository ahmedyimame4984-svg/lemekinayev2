import { cookies } from 'next/headers';
import type { AttributeCsvExportResponse } from '@/lib/catalog-attribute-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { catalogManagementSafeErrorResponse } from '@/lib/server/catalog-management-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = [
  'search',
  'groupId',
  'ungrouped',
  'status',
  'dataType',
  'scope',
  'valueSource',
  'sortBy',
  'sortDirection',
] as const;

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    for (const key of QUERY_KEYS) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const result = await requestAdminApi<AttributeCsvExportResponse>(
      `/admin/catalog/attributes/export${suffix}`,
      { accessToken, timeoutMs: 20_000 },
    );
    const filename = /^[A-Za-z0-9._-]+$/u.test(result.filename)
      ? result.filename
      : 'lemekinaye-attributes.csv';

    return new Response(result.csv, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    return catalogManagementSafeErrorResponse(error);
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
