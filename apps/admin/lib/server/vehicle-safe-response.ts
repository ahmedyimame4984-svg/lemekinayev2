import 'server-only';

import type { NextResponse } from 'next/server';
import { AdminApiError } from './admin-api';
import { jsonNoStore, safeErrorResponse } from './safe-response';

const vehicleLifecycleMessages: Record<string, string> = {
  GENERATION_FAMILY_INVALID_MEMBERS: 'Every selected Generation must exist and belong to this Family’s Model.',
  GENERATION_FAMILY_ALREADY_ASSIGNED: 'A selected Generation belongs to another Family. Reload the assignments.',
  GENERATION_FAMILY_MEMBER_LOCKED: 'Archived or superseded Generations cannot have their Family assignment changed.',
  GENERATION_FAMILY_VERSION_CONFLICT: 'This Family changed since you opened it. Reload the latest record before saving.',
  GENERATION_FAMILY_LOCKED: 'Only Draft Families can be edited or have assignments and evidence changed.',
  GENERATION_FAMILY_DUPLICATE: 'A Family with this name already exists for the selected Model.',
  GENERATION_FAMILY_ALREADY_EXISTS: 'A Family with this internal code already exists for the Model. Review existing Families.',
  GENERATION_FAMILY_NOT_READY: 'Activation requires an active assigned Generation and independently verified source evidence.',
  GENERATION_FAMILY_MODEL_NOT_ACTIVE: 'Activate the parent Model before activating this Family.',
  GENERATION_FAMILY_SELF_REVIEW_BLOCKED: 'An administrator who did not submit the evidence or last edit this Family must review it.',
  GENERATION_FAMILY_END_STATUS_INVALID: 'Ended production requires an end year. Current or unknown production must have no end year.',
  GENERATION_FAMILY_YEAR_RANGE_INVALID: 'The production end year cannot precede the start year.',
  GENERATION_FAMILY_EVIDENCE_REFERENCE_REQUIRED: 'Enter a documentary reference or source URL for the evidence.',
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
};

export function vehicleSafeErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminApiError) {
    const lifecycleMessage = error.apiCode
      ? vehicleLifecycleMessages[error.apiCode]
      : undefined;
    if (lifecycleMessage) {
      return jsonNoStore(
        { error: { code: error.apiCode, message: lifecycleMessage } },
        error.status,
      );
    }

    if (error.status === 403) {
      return jsonNoStore(
        {
          error: {
            code: 'VEHICLE_ACCESS_DENIED',
            message:
              'Your administrator account does not have permission to manage vehicle data.',
          },
        },
        403,
      );
    }

    if (error.status === 404) {
      return jsonNoStore(
        {
          error: {
            code: 'VEHICLE_NOT_FOUND',
            message: 'The vehicle record no longer exists. Reload the page.',
          },
        },
        404,
      );
    }

    if (error.status === 409) {
      return jsonNoStore(
        {
          error: {
            code: 'VEHICLE_CONFLICT',
            message:
              'The vehicle change conflicts with current data. Reload the latest vehicle data and try again.',
          },
        },
        409,
      );
    }
  }

  return safeErrorResponse(error);
}
