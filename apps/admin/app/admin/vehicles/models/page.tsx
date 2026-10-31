import type { Metadata } from 'next';
import { VehiclesManagement } from '@/components/vehicles-management';

export const metadata: Metadata = {
  title: 'Vehicle Models',
};

export default function VehicleModelsPage() {
  return <VehiclesManagement view="models" />;
}
