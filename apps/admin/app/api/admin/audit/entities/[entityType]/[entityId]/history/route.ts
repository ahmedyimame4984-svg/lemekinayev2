import { cookies } from 'next/headers';
import type { AuditEntityHistory } from '@/lib/audit-contracts';
import { requestAdminApi } from '@/lib/server/admin-api';
import { auditSafeErrorResponse } from '@/lib/server/audit-safe-response';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

const QUERY_KEYS = ['includeRelated', 'limit'] as const;

export async function GET(
  request: Request,
  context: {
    params: Promise<{ entityType: string; entityId: string }>;
  },
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const { entityType, entityId } = await context.params;
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();

    for (const key of QUERY_KEYS) {
      const value = source.get(key);
      if (value) query.set(key, value);
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const history = await requestAdminApi<AuditEntityHistory>(
      `/admin/audit/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/history${suffix}`,
      { accessToken },
    );

    return jsonNoStore(history);
  } catch (error) {
    return auditSafeErrorResponse(error);
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
