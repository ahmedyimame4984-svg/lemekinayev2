import type { Metadata } from 'next';
import { ApplicationStatusView } from '@/components/registration/application-status';

export const metadata: Metadata = {
  title: 'Seller application status',
  robots: { index: false, follow: false },
};

export default function ApplicationStatusPage() {
  return <ApplicationStatusView />;
}
