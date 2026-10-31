import type { Metadata } from 'next';
import { AuditHistoryManagement } from '@/components/audit-history-management';

export const metadata: Metadata = {
  title: 'Audit History',
};

export default async function AuditHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    entityId?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <AuditHistoryManagement
      initialEntityType={params.entityType ?? ''}
      initialEntityId={params.entityId ?? ''}
    />
  );
}
