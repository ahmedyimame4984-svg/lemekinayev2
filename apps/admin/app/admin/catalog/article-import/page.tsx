import type { Metadata } from 'next';
import { ProfessionalArticleImport } from '@/components/professional-article-import';

export const metadata: Metadata = {
  title: 'Professional Article Import',
};

export default function ProfessionalArticleImportPage() {
  return <ProfessionalArticleImport />;
}
