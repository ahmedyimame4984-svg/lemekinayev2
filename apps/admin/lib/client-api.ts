import type { ApiErrorPayload } from './auth-contracts';

let localAuthQueue: Promise<unknown> = Promise.resolve();

// Serialize token-changing requests across tabs. No tokens enter browser storage.
export function withAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('lemekinaye-admin-session', operation);
  }
  const pending = localAuthQueue.then(operation, operation);
  localAuthQueue = pending.catch(() => undefined);
  return pending;
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

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const send = () =>
    fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const response = [
    '/api/auth/mfa/verify',
    '/api/auth/session',
    '/api/auth/logout',
  ].includes(path)
    ? await withAuthLock(send)
    : await send();

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }

    console.error(
      `[Client API Error] POST ${path} - Status ${response.status}${payload?.error?.code ? ` [${payload.error.code}]` : ''}${payload?.error?.message ? `: ${payload.error.message}` : ''}`,
    );

    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload?.error?.retryAfterSeconds,
    );
  }

  console.log(`[Client API Success] POST ${path} - Status ${response.status}`);

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }

    console.error(
      `[Client API Error] PATCH ${path} - Status ${response.status}${payload?.error?.code ? ` [${payload.error.code}]` : ''}${payload?.error?.message ? `: ${payload.error.message}` : ''}`,
    );

    throw new ClientApiError(
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload?.error?.retryAfterSeconds,
    );
  }

  console.log(`[Client API Success] PATCH ${path} - Status ${response.status}`);

  return (await response.json()) as T;
}
