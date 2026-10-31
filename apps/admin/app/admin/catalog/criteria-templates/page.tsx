import type { Metadata } from 'next';
import { CriteriaTemplateManagement } from '@/components/criteria-template-management';

export const metadata: Metadata = {
  title: 'Criteria Templates',
};

export default function CriteriaTemplatesPage() {
  return <CriteriaTemplateManagement />;
}
