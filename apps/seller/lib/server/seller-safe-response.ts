import 'server-only';

import { NextResponse } from 'next/server';
import { SellerApiError } from './seller-api';
import { RequestInputError } from './request-security';
import { jsonNoStore } from './safe-response';

export function sellerSafeErrorResponse(error: unknown): NextResponse {
  if (error instanceof RequestInputError) {
    return jsonNoStore(
      { error: { code: 'INVALID_REQUEST', message: error.message } },
      error.status,
    );
  }

  if (error instanceof SellerApiError) {
    const status = [400, 401, 403, 404, 409, 422, 429, 502, 503, 504].includes(error.status)
      ? error.status
      : 503;
    return jsonNoStore(
      {
        error: {
          code:
            error.apiCode ??
            (status === 401
              ? 'AUTHENTICATION_REQUIRED'
              : status === 403
                ? 'ACCESS_DENIED'
                : 'REQUEST_FAILED'),
          message:
            error.apiMessage ??
            (status === 401
              ? 'Sign in to continue.'
              : status === 403
                ? 'This Seller account cannot perform that action.'
                : 'The request could not be completed.'),
          ...(sanitizeIssues(error.apiIssues).length > 0
            ? { issues: sanitizeIssues(error.apiIssues) }
            : {}),
        },
      },
      status,
    );
  }

  return jsonNoStore(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The Seller service is temporarily unavailable.',
      },
    },
    503,
  );
}


function sanitizeIssues(value: unknown[] | undefined): Array<{
  code: string;
  area?: string;
  attributeCode?: string;
  message: string;
}> {
  if (!value) return [];
  return value.flatMap((candidate) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return [];
    }
    const record = candidate as Record<string, unknown>;
    if (typeof record.code !== 'string' || typeof record.message !== 'string') {
      return [];
    }
    return [{
      code: record.code.slice(0, 120),
      ...(typeof record.area === 'string'
        ? { area: record.area.slice(0, 120) }
        : {}),
      ...(typeof record.attributeCode === 'string'
        ? { attributeCode: record.attributeCode.slice(0, 120) }
        : {}),
      message: record.message.slice(0, 500),
    }];
  }).slice(0, 50);
}
