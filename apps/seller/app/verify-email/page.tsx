import type { Metadata } from 'next';
import { SellerEmailVerification } from '@/components/registration/seller-email-verification';

export const metadata: Metadata = {
  title: 'Verify Seller email',
  robots: { index: false, follow: false },
};

export default function VerifySellerEmailPage() {
  return <SellerEmailVerification />;
}
