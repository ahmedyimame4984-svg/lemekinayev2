import 'server-only';

import { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { RequestInputError } from './request-security';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: noStoreHeaders });
}

export function jsonNoStore<T>(value: T, status = 200): NextResponse<T> {
  return NextResponse.json(value, { status, headers: noStoreHeaders });
}

export function safeErrorResponse(error: unknown): NextResponse {
  if (error instanceof RequestInputError) {
    return jsonNoStore(
      { error: { code: 'INVALID_REQUEST', message: error.message } },
      error.status,
    );
  }

  if (error instanceof AdminApiError) {
    const retryAfterSeconds = parseRetryAfter(error.retryAfter);
    const response = errorForStatus(error.status, retryAfterSeconds);
    if (error.retryAfter) {
      response.headers.set('Retry-After', error.retryAfter);
    }
    return response;
  }

  return jsonNoStore(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message:
          'The Admin service is temporarily unavailable. Try again shortly.',
      },
    },
    503,
  );
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1_000));
}

function errorForStatus(
  status: number,
  retryAfterSeconds?: number,
): NextResponse {
  if (status === 400) {
    return jsonNoStore(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Check the information and try again.',
        },
      },
      400,
    );
  }

  if (status === 401) {
    return jsonNoStore(
      {
        error: {
          code: 'AUTHENTICATION_REJECTED',
          message:
            'We could not verify those details. Check them and try again.',
        },
      },
      401,
    );
  }

  if (status === 403) {
    return jsonNoStore(
      {
        error: {
          code: 'ACCESS_DENIED',
          message: 'This account does not have access to the Admin Portal.',
        },
      },
      403,
    );
  }

  if (status === 409) {
    return jsonNoStore(
      {
        error: {
          code: 'REQUEST_CONFLICT',
          message:
            'This request is no longer valid. Start again with a new token.',
        },
      },
      409,
    );
  }

  if (status === 429) {
    return jsonNoStore(
      {
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many attempts. Wait before trying again.',
          ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        },
      },
      429,
    );
  }

  return jsonNoStore(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message:
          'The Admin service is temporarily unavailable. Try again shortly.',
      },
    },
    503,
  );
}
