import type { Metadata } from 'next';
import { CanonicalVehicleMakesModels } from '@/components/canonical-vehicle-makes-models';

export const metadata: Metadata = { title: 'Synchronized Vehicle Models' };

export default function Page() {
  return <CanonicalVehicleMakesModels view="models" />;
}
