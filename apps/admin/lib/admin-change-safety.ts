import type { MasterDataStatus } from './catalog-contracts';

export function requiresAdminBulkLifecycleConfirmation(
  currentStatuses: MasterDataStatus[],
  nextStatus: MasterDataStatus,
): boolean {
  if (nextStatus === 'ARCHIVED' || nextStatus === 'INACTIVE') return true;

  return (
    nextStatus !== 'ACTIVE' &&
    currentStatuses.some((status) => status === 'ACTIVE')
  );
}

export function adminBulkLifecycleConfirmationMessage(input: {
  count: number;
  entityLabel: string;
  nextStatus: MasterDataStatus;
}): string {
  const label =
    input.count === 1
      ? input.entityLabel
      : input.entityLabel.endsWith('s')
        ? input.entityLabel
        : `${input.entityLabel}s`;

  return `Change ${input.count} ${label} to ${formatStatus(input.nextStatus)}? This lifecycle change can remove records from active operational use.`;
}

function formatStatus(status: MasterDataStatus): string {
  return status.toLowerCase().replaceAll('_', ' ');
}
