import { cookies } from 'next/headers';
import { requestAdminApi } from '@/lib/server/admin-api';
import { jsonNoStore } from '@/lib/server/safe-response';
import { ACCESS_COOKIE } from '@/lib/server/session-cookies';

type HealthStatus = {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
};

type ReadinessStatus = HealthStatus & {
  checks: {
    database: 'up';
  };
};

type AdminPlatformHealth = {
  api: 'UP' | 'DOWN';
  database: 'UP' | 'DOWN';
  service: string | null;
  version: string | null;
  checkedAt: string;
};

export async function GET(): Promise<Response> {
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

  const [healthResult, readinessResult] = await Promise.allSettled([
    requestAdminApi<HealthStatus>('/health', {
      accessToken,
      timeoutMs: 5_000,
    }),
    requestAdminApi<ReadinessStatus>('/health/ready', {
      accessToken,
      timeoutMs: 5_000,
    }),
  ]);

  const health =
    healthResult.status === 'fulfilled' ? healthResult.value : null;
  const readiness =
    readinessResult.status === 'fulfilled' ? readinessResult.value : null;

  return jsonNoStore({
    api: health ? 'UP' : 'DOWN',
    database: readiness?.checks.database === 'up' ? 'UP' : 'DOWN',
    service: health?.service ?? null,
    version: health?.version ?? null,
    checkedAt: new Date().toISOString(),
  } satisfies AdminPlatformHealth);
}
