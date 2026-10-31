import type { Metadata } from 'next';
import { AdminAccountsManagement } from '@/components/admin-accounts-management';

export const metadata: Metadata = {
  title: 'Admin Accounts',
};

export default function AdminAccountsPage() {
  return <AdminAccountsManagement />;
}
