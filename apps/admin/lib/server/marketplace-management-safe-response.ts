import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

const marketplaceMessages: Record<string, string> = {
  SELLER_NOT_FOUND: 'The Seller profile no longer exists. Reload the page.',
  SELLER_DUPLICATE:
    'This Seller user or Seller code is already linked to a Seller profile.',
  SELLER_ACCOUNT_ALREADY_EXISTS:
    'This phone, email, or Seller code is already assigned to an account that cannot be provisioned again.',
  SELLER_INVITATION_NOT_ALLOWED:
    'Only approved, verified Sellers awaiting account setup can receive an invitation.',
  SELLER_INVITATION_EMAIL_REQUIRED:
    'This Seller has no registered email. Add an email through the approved identity process before inviting.',
  SELLER_INVITATION_IN_PROGRESS:
    'An existing invitation is currently being delivered. Wait before issuing a new link.',
  SELLER_INVITATION_EMAIL_MISMATCH:
    'The Seller email differs from the approved application. Reverify the identity before inviting.',
  SELLER_INVITATION_TOO_FREQUENT:
    'An invitation was recently issued. Wait two minutes before resending.',
  SELLER_INVITATION_EMAIL_UNAVAILABLE:
    'Email delivery is not configured. Contact your system administrator.',
  SELLER_INVITATION_DELIVERY_FAILED:
    'Email delivery failed. Wait two minutes before trying again.',
  SELLER_CREDENTIAL_REQUIRED:
    'The Seller must complete credential activation before the account can become Active.',
  SELLER_VERSION_CONFLICT:
    'This Seller profile changed since you opened it. Reload and try again.',
  SELLER_ACCOUNT_TYPE_REQUIRED:
    'The selected account must be a SELLER account before a Seller profile can be created.',
  SELLER_VERIFICATION_REQUIRED:
    'Verify the Seller before approving the Seller profile.',
  SELLER_APPROVAL_REQUIRED:
    'A Seller must be verified and approved before becoming Active.',
  SELLER_LISTING_NOT_FOUND:
    'The Seller Listing no longer exists. Reload the moderation queue.',
  SELLER_LISTING_VERSION_CONFLICT:
    'This Seller Listing changed since you opened it. Reload and try again.',
  LISTING_APPROVE_STATE_INVALID:
    'Only submitted Seller Listings can be approved.',
  LISTING_REJECT_STATE_INVALID:
    'Only submitted Seller Listings can be rejected.',
  LISTING_SELLER_NOT_OPERATIONAL:
    'The Seller must be verified, approved, and Active before the Listing can be approved.',
  LISTING_PRODUCT_NOT_ACTIVE:
    'The linked Product Master must be Active before the Listing can be approved.',
  LISTING_PRICE_REQUIRED:
    'The Listing must have a valid Seller price before approval.',
  LISTING_INVENTORY_REQUIRED:
    'The Listing must have Seller inventory before approval.',
};

export function marketplaceManagementSafeErrorResponse(
  error: unknown,
): NextResponse {
  if (error instanceof AdminApiError) {
    const domainMessage = error.apiCode
      ? marketplaceMessages[error.apiCode]
      : undefined;

    if (domainMessage) {
      return jsonNoStore(
        {
          error: {
            code: error.apiCode,
            message: domainMessage,
          },
        },
        error.status,
      );
    }

    if (error.status === 403) {
      return jsonNoStore(
        {
          error: {
            code: 'MARKETPLACE_ACCESS_DENIED',
            message:
              'Your administrator account does not have permission to manage Sellers or Listings.',
          },
        },
        403,
      );
    }

    if (error.status === 404) {
      return jsonNoStore(
        {
          error: {
            code: 'MARKETPLACE_RECORD_NOT_FOUND',
            message: 'The marketplace record no longer exists. Reload the page.',
          },
        },
        404,
      );
    }

    if (error.status === 409) {
      return jsonNoStore(
        {
          error: {
            code: 'MARKETPLACE_CONFLICT',
            message:
              'The marketplace record changed or no longer permits this action. Reload and try again.',
          },
        },
        409,
      );
    }
  }

  return safeErrorResponse(error);
}
