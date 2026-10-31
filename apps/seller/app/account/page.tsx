import type { Metadata } from 'next';
import { SellerAccountOverview } from '@/components/seller-account-overview';

export const metadata: Metadata = { title: 'Seller Account' };

export default function SellerAccountPage() {
  return <SellerAccountOverview />;
}
