import type { Metadata } from 'next';
import { VehicleMasterConfigurationManagement } from '@/components/vehicle-master-configuration-management';

export const metadata: Metadata = {
  title: 'Advanced Vehicle Master Libraries',
};

export default function AdvancedVehicleMasterLibrariesPage() {
  return <VehicleMasterConfigurationManagement />;
}
