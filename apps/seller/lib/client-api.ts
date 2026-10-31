interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  };
}

export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ClientApiError';
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try { payload = (await response.json()) as ApiErrorPayload; } catch { payload = undefined; }
    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload?.error?.retryAfterSeconds,
    );
  }
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }

    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload?.error?.retryAfterSeconds,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }
    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload?.error?.retryAfterSeconds,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function postFormData<T>(path: string, body: FormData): Promise<T> {
  return sendFormData<T>(path, body, 'POST');
}

export async function patchFormData<T>(path: string, body: FormData): Promise<T> {
  return sendFormData<T>(path, body, 'PATCH');
}

async function sendFormData<T>(
  path: string,
  body: FormData,
  method: 'POST' | 'PATCH',
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    body,
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }

    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload?.error?.retryAfterSeconds,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
