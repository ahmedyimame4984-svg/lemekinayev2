import type { Metadata } from 'next';
import { SellerAccountActivation } from '@/components/registration/seller-account-activation';

export const metadata: Metadata = {
  title: 'Activate Seller account',
  robots: { index: false, follow: false },
};

export default function ActivateSellerPage() {
  return <SellerAccountActivation />;
}
