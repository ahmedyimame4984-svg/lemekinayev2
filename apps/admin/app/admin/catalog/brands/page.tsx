import type { Metadata } from 'next';
import { BrandsManagement } from '@/components/brands-management';

export const metadata: Metadata = {
  title: 'Brand Master',
};

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  return <BrandsManagement initialSearch={params.search ?? ''} />;
}
