import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

export function auditSafeErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminApiError && error.status === 403) {
    return jsonNoStore(
      {
        error: {
          code: 'AUDIT_ACCESS_DENIED',
          message:
            'Your administrator account does not have permission to read Audit History.',
        },
      },
      403,
    );
  }

  if (error instanceof AdminApiError && error.status === 400) {
    return jsonNoStore(
      {
        error: {
          code: 'AUDIT_FILTER_INVALID',
          message: 'The Audit History filters are not valid.',
        },
      },
      400,
    );
  }

  return safeErrorResponse(error);
}
