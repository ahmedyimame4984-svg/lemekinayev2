/** Reviewable fitment queue; the API remains authoritative for configured-vehicle validity. */
export interface PendingExactFitment {
  vehicleConfigurationId: string;
  vehicleLabel: string;
  position: string;
  notes: string;
}

export const MAX_QUEUED_FITMENTS = 20;

export function enqueueExactFitment(
  current: readonly PendingExactFitment[],
  next: PendingExactFitment,
): PendingExactFitment[] {
  if (!next.vehicleConfigurationId || current.some(item => item.vehicleConfigurationId === next.vehicleConfigurationId)) {
    return [...current];
  }
  if (current.length >= MAX_QUEUED_FITMENTS) {
    return [...current];
  }
  return [...current, next];
}

export function pendingAfterFailure(
  queue: readonly PendingExactFitment[],
  successfulCount: number,
): PendingExactFitment[] {
  return queue.slice(Math.max(0, successfulCount));
}
