import 'server-only';

export class SellerApiError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null,
    readonly apiCode?: string,
    readonly apiMessage?: string,
    readonly apiIssues?: unknown[],
  ) {
    super(`Seller API request failed with status ${status}`);
    this.name = 'SellerApiError';
  }
}

function getApiBaseUrl(): string {
  const configured = process.env.SELLER_API_BASE_URL?.trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('SELLER_API_BASE_URL is required in production');
  }

  const value = configured || 'http://127.0.0.1:5000/api/v1';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SELLER_API_BASE_URL must use http or https');
  }
  return url.toString().replace(/\/$/u, '');
}

export async function requestSellerApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    formData?: FormData;
    accessToken?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined && !options.formData) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);

  let baseUrl: string;
  try {
    baseUrl = getApiBaseUrl();
  } catch {
    throw new SellerApiError(
      503, null, 'SELLER_API_CONFIGURATION_ERROR',
      'The Seller API connection is not configured. Contact the administrator.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.formData ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
  } catch (error) {
    // Do not automatically retry a write: the API might have committed it.
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new SellerApiError(
        504, null, 'SELLER_API_TIMEOUT',
        'The Save request timed out. Check Inventory before retrying; the operation may have completed.',
      );
    }
    throw new SellerApiError(
      503, null, 'SELLER_API_CONNECTION_FAILED',
      'The Seller Portal cannot reach the API service. Check the API connection.',
    );
  }

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
      // Reduce upstream errors to safe Seller responses at the BFF boundary.
    }
    throw new SellerApiError(
      response.status,
      response.headers.get('retry-after'),
      apiCode,
      apiMessage,
      apiIssues,
    );
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new SellerApiError(
      502, null, 'SELLER_API_INVALID_RESPONSE',
      options.method === undefined || options.method === 'GET'
        ? 'The API returned an invalid response. Reload the page and try again.'
        : 'The API returned an invalid response. Check Inventory before retrying the Save.',
    );
  }
}

/** Fetches private application documents from the server without exposing storage keys. */
export async function requestSellerApiFile(
  path: string,
  accessToken: string,
): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new SellerApiError(response.status, response.headers.get('retry-after'));
  }
  return response;
}
