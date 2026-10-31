import type { Metadata } from 'next';
import { VehiclesManagement } from '@/components/vehicles-management';

export const metadata: Metadata = {
  title: 'Vehicle Makes',
};

export default function VehicleMakesPage() {
  return <VehiclesManagement view="makes" />;
}
