import type { Metadata } from 'next';
import { GenerationFamilyManagement } from '@/components/generation-family-management';

export const metadata: Metadata = { title: 'Generation Families' };

export default function GenerationFamiliesPage() {
  return <GenerationFamilyManagement />;
}
