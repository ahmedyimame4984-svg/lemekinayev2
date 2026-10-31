import type { Metadata } from 'next';
import { ListingReviewDetail } from '@/components/listing-review-detail';

export const metadata: Metadata = { title: 'Review Seller Listing' };

export default async function ListingReviewPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingReviewDetail listingId={id} />;
}
