import 'server-only';

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null,
    readonly apiCode?: string,
    readonly apiMessage?: string,
    readonly apiIssues?: unknown[],
  ) {
    super(`Admin API request failed with status ${status}`);
    this.name = 'AdminApiError';
  }
}

function getApiBaseUrl(): string {
  const configured = process.env.ADMIN_API_BASE_URL?.trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_API_BASE_URL is required in production');
  }

  const value = configured || 'http://127.0.0.1:3000/api/v1';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('ADMIN_API_BASE_URL must use http or https');
  }

  return url.toString().replace(/\/$/u, '');
}

export async function requestAdminApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    accessToken?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });

  if (!response.ok) {
    let apiCode: string | undefined;
    let apiMessage: string | undefined;
    let apiIssues: unknown[] | undefined;

    try {
      const payload = (await response.json()) as {
        code?: unknown;
        message?: unknown;
        issues?: unknown;
        error?: { code?: unknown; message?: unknown; issues?: unknown };
      };
      const source =
        payload.error && typeof payload.error === 'object'
          ? payload.error
          : payload;

      if (typeof source.code === 'string') apiCode = source.code;
      if (typeof source.message === 'string') apiMessage = source.message;
      const issues =
        'issues' in source && Array.isArray(source.issues)
          ? source.issues
          : Array.isArray(payload.issues)
            ? payload.issues
            : undefined;
      if (issues) apiIssues = issues;
    } catch {
      // Upstream errors are intentionally reduced to safe Admin responses below.
    }

    throw new AdminApiError(
      response.status,
      response.headers.get('retry-after'),
      apiCode,
      apiMessage,
      apiIssues,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** For permission-checked private document downloads; never cache or redirect. */
export async function requestAdminApiFile(
  path: string,
  accessToken: string,
): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new AdminApiError(response.status, response.headers.get('retry-after'));
  }
  return response;
}
