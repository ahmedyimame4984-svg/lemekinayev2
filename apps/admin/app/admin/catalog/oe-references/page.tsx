import type { Metadata } from 'next';
import { OeReferenceReview } from '@/components/oe-reference-review';

export const metadata: Metadata = {
  title: 'OE & Cross-reference Review',
};

export default async function OeReferenceReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <OeReferenceReview
      initialSearch={params.search ?? ''}
      initialView={params.view === 'REFERENCES' ? 'REFERENCES' : 'COLLISIONS'}
    />
  );
}
