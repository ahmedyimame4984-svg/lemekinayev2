import { BadRequestException, ConflictException } from '@nestjs/common';
import { MasterDataStatus } from '@prisma/client';

const governedTargets = new Set<MasterDataStatus>([
  MasterDataStatus.DEPRECATED,
  MasterDataStatus.SUPERSEDED,
  MasterDataStatus.INACTIVE,
  MasterDataStatus.ARCHIVED,
]);

export function assertMasterCreateStatusAllowed(
  status: MasterDataStatus,
): void {
  if (
    status === MasterDataStatus.DRAFT ||
    status === MasterDataStatus.ACTIVE
  ) {
    return;
  }

  throw new BadRequestException({
    code: 'MASTER_DATA_CREATE_STATUS_INVALID',
    message:
      'Core master data can only be created as DRAFT or ACTIVE. Use the governed lifecycle workflow after creation.',
  });
}

export function assertMasterRecordEditable(
  currentStatus: MasterDataStatus,
): void {
  if (
    currentStatus === MasterDataStatus.SUPERSEDED ||
    currentStatus === MasterDataStatus.ARCHIVED
  ) {
    throw new ConflictException({
      code: 'MASTER_DATA_LIFECYCLE_RECORD_LOCKED',
      message:
        'SUPERSEDED and ARCHIVED master records are immutable. Create or edit the active replacement instead.',
    });
  }
}

export function assertDirectMasterStatusChange(
  currentStatus: MasterDataStatus,
  requestedStatus: MasterDataStatus | undefined,
): void {
  if (!requestedStatus || requestedStatus === currentStatus) return;

  if (governedTargets.has(requestedStatus)) {
    throw new ConflictException({
      code: 'MASTER_DATA_LIFECYCLE_ENDPOINT_REQUIRED',
      message:
        'Deprecation, supersession, legacy inactivation and archiving must use the governed master-data lifecycle endpoint.',
    });
  }

  if (requestedStatus === MasterDataStatus.DRAFT) {
    throw new ConflictException({
      code: 'MASTER_DATA_LIFECYCLE_TRANSITION_INVALID',
      message:
        'Master data cannot return to DRAFT after leaving it. Use DEPRECATED for records that should no longer be selected.',
    });
  }

  if (requestedStatus === MasterDataStatus.ACTIVE) {
    if (
      currentStatus === MasterDataStatus.DRAFT ||
      currentStatus === MasterDataStatus.DEPRECATED ||
      currentStatus === MasterDataStatus.INACTIVE
    ) {
      return;
    }

    throw new ConflictException({
      code: 'MASTER_DATA_REACTIVATION_NOT_ALLOWED',
      message:
        'Only DRAFT, DEPRECATED or legacy INACTIVE records can enter ACTIVE through the entity-specific activation workflow.',
    });
  }
}
