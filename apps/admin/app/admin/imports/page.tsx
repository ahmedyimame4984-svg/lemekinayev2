import type { Metadata } from 'next';
import { AdminImportJobsWorkspace } from '@/components/admin-import-jobs-workspace';

export const metadata: Metadata = {
  title: 'Imports & Jobs',
};

export default function AdminImportJobsPage() {
  return <AdminImportJobsWorkspace />;
}
