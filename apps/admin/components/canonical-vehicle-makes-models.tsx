'use client';

import { VehiclesManagement } from './vehicles-management';

/** Keep the familiar library presentation without canonical authoring operations. */
export function CanonicalVehicleMakesModels({
  view,
}: {
  view: 'makes' | 'models';
}) {
  return <VehiclesManagement view={view} />;
}
