import type { Metadata } from 'next';
import { CanonicalVehicleLibrary } from '@/components/canonical-vehicle-library';

export const metadata: Metadata = { title: 'Synced Vehicle Library' };

export default async function VehicleConfigurationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    configurationId?: string;
    modelId?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <CanonicalVehicleLibrary
      initialSearch={params.search ?? ''}
      initialConfigurationId={params.configurationId ?? ''}
      initialModelId={params.modelId ?? ''}
    />
  );
}
