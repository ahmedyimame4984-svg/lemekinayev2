import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

const sourcingMessages: Record<string, string> = {
  MASTER_DATA_PERMANENT_DELETE_BLOCKED:
    'Permanent deletion is blocked. Refresh the deletion check to review the current dependencies.',
  MASTER_DATA_HAS_ACTIVE_DEPENDENCIES:
    'Resolve active dependent records before archiving this master record.',
  MASTER_DATA_LIFECYCLE_VERSION_CONFLICT:
    'This master record changed since you opened it. Reload and try again.',
  MASTER_DATA_RESTORE_STATUS_INVALID:
    'Only an archived master record can be restored.',
  MASTER_DATA_DEPENDENCY_CONFLICT:
    'A dependency changed while this action was running. Refresh the record and try again.',
  SUPPLIER_NOT_FOUND: 'The Supplier no longer exists. Reload sourcing.',
  SUPPLIER_ALREADY_EXISTS:
    'A Supplier already uses this canonical code.',
  SUPPLIER_VERSION_CONFLICT:
    'This Supplier changed since you opened it. Reload and try again.',
  SUPPLIER_HAS_ACTIVE_OFFERS:
    'Pause or deactivate Active Supplier Offers before changing this Supplier lifecycle.',
  SUPPLIER_OFFER_NOT_FOUND:
    'The Supplier Offer no longer exists. Reload sourcing.',
  SUPPLIER_OFFER_VERSION_CONFLICT:
    'This Supplier Offer changed since you opened it. Reload and try again.',
  SUPPLIER_OFFER_SUPPLIER_NOT_ACTIVE:
    'Activate the Supplier before activating this sourcing offer.',
  SUPPLIER_OFFER_ARTICLE_NOT_ACTIVE:
    'Activate the Manufacturer Article before activating this sourcing offer.',
  MANUFACTURER_ARTICLE_NOT_FOUND:
    'The Manufacturer Article no longer exists. Reload the Article Master.',
  SUPPLIER_OFFER_LEAD_TIME_INVALID:
    'Minimum lead time cannot be greater than maximum lead time.',
  SUPPLIER_OFFER_VALIDITY_INVALID:
    'Offer valid-from date cannot be after valid-to date.',
  SUPPLIER_OFFER_ALREADY_EXPIRED:
    'An Active Supplier Offer cannot already be expired.',
};

export function sourcingManagementSafeErrorResponse(
  error: unknown,
): NextResponse {
  if (error instanceof AdminApiError) {
    const domainMessage = error.apiCode
      ? sourcingMessages[error.apiCode]
      : undefined;

    if (domainMessage) {
      return jsonNoStore(
        { error: { code: error.apiCode, message: domainMessage } },
        error.status,
      );
    }

    if (error.status === 400) {
      return jsonNoStore(
        {
          error: {
            code: 'SOURCING_INVALID_REQUEST',
            message:
              'Check the Supplier Offer values and commercial terms, then try again.',
          },
        },
        400,
      );
    }

    if (error.status === 403) {
      return jsonNoStore(
        {
          error: {
            code: 'SOURCING_ACCESS_DENIED',
            message:
              'Your administrator account does not have permission to manage sourcing.',
          },
        },
        403,
      );
    }

    if (error.status === 404) {
      return jsonNoStore(
        {
          error: {
            code: 'SOURCING_RECORD_NOT_FOUND',
            message: 'The sourcing record no longer exists. Reload the page.',
          },
        },
        404,
      );
    }

    if (error.status === 409) {
      return jsonNoStore(
        {
          error: {
            code: 'SOURCING_CONFLICT',
            message:
              'The sourcing record changed or no longer permits this action. Reload and try again.',
          },
        },
        409,
      );
    }
  }

  return safeErrorResponse(error);
}
