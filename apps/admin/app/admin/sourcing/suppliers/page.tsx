import type { Metadata } from 'next';
import { SupplierMasterManagement } from '@/components/supplier-master-management';

export const metadata: Metadata = { title: 'Supplier Master' };

export default function SupplierMasterPage() {
  return <SupplierMasterManagement />;
}
