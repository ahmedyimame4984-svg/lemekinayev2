import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

const preferenceMessages: Record<string, string> = {
  ADMIN_SAVED_VIEW_NAME_CONFLICT:
    'A saved view with this name already exists in this workspace.',
  ADMIN_SAVED_VIEW_VERSION_CONFLICT:
    'This saved view changed since you loaded it. Reload the views and try again.',
  ADMIN_SAVED_VIEW_NOT_FOUND:
    'The saved view no longer exists. Reload the saved views.',
  ADMIN_SAVED_VIEW_STATE_TOO_LARGE:
    'This view contains too much state to save. Reduce the filters and try again.',
  ADMIN_SAVED_VIEW_NAME_REQUIRED: 'Enter a name for the saved view.',
  ADMIN_SAVED_VIEW_UPDATE_EMPTY:
    'Change the saved view name or settings before updating it.',
};

export function adminPreferencesSafeErrorResponse(
  error: unknown,
): NextResponse {
  if (error instanceof AdminApiError) {
    const message = error.apiCode
      ? preferenceMessages[error.apiCode]
      : undefined;

    if (message) {
      return jsonNoStore(
        {
          error: {
            code: error.apiCode,
            message,
          },
        },
        error.status,
      );
    }

    if (error.status === 400) {
      return jsonNoStore(
        {
          error: {
            code: 'ADMIN_PREFERENCES_INVALID_REQUEST',
            message: 'Check the saved-view fields and try again.',
          },
        },
        400,
      );
    }

    if (error.status === 403) {
      return jsonNoStore(
        {
          error: {
            code: 'ADMIN_PREFERENCES_ACCESS_DENIED',
            message:
              'Your administrator account cannot manage saved workspace views.',
          },
        },
        403,
      );
    }

    if (error.status === 404) {
      return jsonNoStore(
        {
          error: {
            code: 'ADMIN_SAVED_VIEW_NOT_FOUND',
            message: 'The saved view no longer exists. Reload the saved views.',
          },
        },
        404,
      );
    }

    if (error.status === 409) {
      return jsonNoStore(
        {
          error: {
            code: 'ADMIN_PREFERENCES_CONFLICT',
            message:
              'The saved view changed or conflicts with another view. Reload and try again.',
          },
        },
        409,
      );
    }
  }

  return safeErrorResponse(error);
}
