import type { Metadata } from 'next';
import { ManufacturerArticleInspector } from '@/components/manufacturer-article-inspector';

export const metadata: Metadata = {
  title: 'Manufacturer Article Inspector',
};

export default async function ManufacturerArticleInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManufacturerArticleInspector articleId={id} />;
}
