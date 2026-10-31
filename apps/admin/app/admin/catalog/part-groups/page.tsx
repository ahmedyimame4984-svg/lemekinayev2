import type { Metadata } from 'next';
import { PartGroupsManagement } from '@/components/part-groups-management';

export const metadata: Metadata = {
  title: 'Part Groups',
};

export default async function PartGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string | string[] }>;
}) {
  const params = await searchParams;
  const categoryId = Array.isArray(params.categoryId)
    ? (params.categoryId[0] ?? '')
    : (params.categoryId ?? '');

  return <PartGroupsManagement initialCategoryId={categoryId} />;
}
