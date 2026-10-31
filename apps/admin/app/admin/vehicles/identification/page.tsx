import type { Metadata } from 'next';
import { VehicleIdentificationLookup } from '@/components/vehicle-identification-lookup';
import type { VehicleIdentificationMethod } from '@/lib/vehicle-identification-contracts';

export const metadata: Metadata = {
  title: 'VIN / Chassis Lookup',
};

type TypeSelection = 'AUTO' | VehicleIdentificationMethod;

function typeSelection(value?: string): TypeSelection {
  return value === 'VIN' ||
    value === 'CHASSIS' ||
    value === 'FRAME' ||
    value === 'OTHER'
    ? value
    : 'AUTO';
}

export default async function VehicleIdentificationPage({
  searchParams,
}: {
  searchParams: Promise<{
    identifier?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <VehicleIdentificationLookup
      initialIdentifier={params.identifier ?? ''}
      initialType={typeSelection(params.type)}
    />
  );
}
