import type { Metadata } from 'next';
import { AttributeMasterManagement } from '@/components/attribute-master-management';

export const metadata: Metadata = {
  title: 'Attributes',
};

export default function AttributesPage() {
  return <AttributeMasterManagement />;
}
