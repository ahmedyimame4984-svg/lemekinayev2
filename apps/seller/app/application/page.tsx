import type { Metadata } from 'next';
import { ApplicationAccessForm } from '@/components/registration/application-access-form';

export const metadata: Metadata = {
  title: 'Track Seller application',
  description: 'Securely request access to your Lemekinaye Seller application.',
};

export default function ApplicationAccessPage() {
  return <ApplicationAccessForm />;
}
