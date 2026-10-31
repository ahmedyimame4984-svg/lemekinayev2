import type { Metadata } from 'next';
import { ApplicationEditForm } from '@/components/registration/application-edit-form';

export const metadata: Metadata = {
  title: 'Edit Seller application',
  robots: { index: false, follow: false },
};

export default function ApplicationEditPage() {
  return <ApplicationEditForm />;
}
