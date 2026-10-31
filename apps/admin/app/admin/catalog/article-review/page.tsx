import type { Metadata } from 'next';
import { ManufacturerArticleReview } from '@/components/manufacturer-article-review';

export const metadata: Metadata = {
  title: 'Manufacturer Article Review',
};

export default async function ManufacturerArticleReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ articleId?: string }>;
}) {
  const params = await searchParams;
  return <ManufacturerArticleReview initialSearch={params.articleId ?? ''} />;
}
