import type { Metadata } from 'next';
import { ListingModeration } from '@/components/listing-moderation';

export const metadata: Metadata = { title: 'Seller Listing review' };

export default function SellerListingReviewPage() {
  return <ListingModeration />;
}
