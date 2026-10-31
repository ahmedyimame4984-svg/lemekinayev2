import type { Metadata } from 'next';
import { SellersManagement } from '@/components/sellers-management';
import { SellerApplicationReview } from '@/components/seller-application-review';

export const metadata: Metadata = {
  title: 'Sellers',
};

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  return tab === 'applications' ? <SellerApplicationReview /> : <SellersManagement />;
}
