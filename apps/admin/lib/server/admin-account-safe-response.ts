import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

export function adminAccountSafeErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminApiError) {
    if (error.status === 403) {
      return jsonNoStore(
        {
          error: {
            code: 'ADMIN_ACCOUNT_ACCESS_DENIED',
            message:
              'Your administrator account does not have permission to manage Admin accounts.',
          },
        },
        403,
      );
    }

    if (error.status === 409) {
      return jsonNoStore(
        {
          error: {
            code: 'ADMIN_ACCOUNT_CONFLICT',
            message:
              'That Admin account cannot be changed in its current state.',
          },
        },
        409,
      );
    }
  }

  return safeErrorResponse(error);
}
