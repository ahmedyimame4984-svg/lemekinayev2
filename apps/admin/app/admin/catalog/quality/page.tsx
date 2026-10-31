import type { Metadata } from 'next';
import { CatalogQualityWorkbench } from '@/components/catalog-quality-workbench';

export const metadata: Metadata = {
  title: 'Catalog Quality',
};

export default function CatalogQualityPage() {
  return <CatalogQualityWorkbench />;
}
