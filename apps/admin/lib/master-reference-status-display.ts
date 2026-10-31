import type { MasterReferenceStatus } from './reference-data-contracts';

type CountDisplay = {
  available: boolean;
  baselineMet: boolean;
  badge: string;
  value: string;
  description: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * The Admin and API may temporarily be at different revisions locally.
 * Reject an invalid status envelope rather than allowing an overview crash.
 * Individual count keys are intentionally checked separately so missing
 * counts can be labelled unavailable instead of mistaken for zero records.
 */
export function isMasterReferenceStatusPayload(
  value: unknown,
): value is MasterReferenceStatus {
  if (!isRecord(value) || !isRecord(value.counts) || !isRecord(value.blockers)) {
    return false;
  }

  const vehicleState = value.vehicleLibraryState;
  const blockers = value.blockers;
  return (
    typeof value.attributeLibraryReady === 'boolean' &&
    typeof value.replacementInProgress === 'boolean' &&
    (vehicleState === 'EMPTY' ||
      vehicleState === 'MASTERS_ONLY' ||
      vehicleState === 'CONFIGURATIONS_PRESENT') &&
    ['products', 'sellerListings', 'vehicleProfiles', 'vehicleCompatibilities'].every(
      (key) => isNonNegativeInteger(blockers[key]),
    )
  );
}

export function masterReferenceCountDisplay(value: unknown): CountDisplay {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.actual) ||
    !(value.expected === null || isNonNegativeInteger(value.expected))
  ) {
    return {
      available: false,
      baselineMet: false,
      badge: 'Unavailable',
      value: '—',
      description: 'The API did not return a valid count.',
    };
  }

  if (value.expected === null) {
    return {
      available: true,
      baselineMet: false,
      badge: 'Admin-managed',
      value: String(value.actual),
      description: 'Current records',
    };
  }

  const baselineMet = value.actual >= value.expected;
  return {
    available: true,
    baselineMet,
    badge: baselineMet ? 'Baseline count met' : 'Below baseline',
    value: `${value.actual} / ${value.expected}`,
    description: 'Actual / baseline count',
  };
}
