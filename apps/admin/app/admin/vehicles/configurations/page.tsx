import type { Metadata } from 'next';
import { VehicleBuilder } from '@/components/vehicle-builder';

export const metadata: Metadata = {
  title: 'Configured Vehicles Library',
};

export default async function VehicleConfigurationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    modelId?: string;
    generationId?: string;
    trimId?: string;
    search?: string;
    configurationId?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <VehicleBuilder
      initialModelId={params.modelId ?? ''}
      initialGenerationId={params.generationId ?? ''}
      initialTrimId={params.trimId ?? ''}
      initialLibrarySearch={params.search ?? ''}
      initialLibraryConfigurationId={params.configurationId ?? ''}
    />
  );
}
