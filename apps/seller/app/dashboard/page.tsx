import type { Metadata } from 'next';
import { SellerOnboardingDashboard } from '@/components/seller-onboarding-dashboard';

export const metadata: Metadata = { title: 'Seller dashboard' };

export default function SellerDashboardPage() {
  return <SellerOnboardingDashboard />;
}
