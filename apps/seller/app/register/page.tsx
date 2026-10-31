import type { Metadata } from 'next';
import { SellerAccountRegistrationForm } from '@/components/registration/seller-account-registration-form';
import { SellerAuthShell } from '@/components/seller-auth-shell';

export const metadata: Metadata = {
  title: 'Seller registration',
  description: 'Create your Lemekinaye Seller account and verify your email.',
};

export default function SellerRegisterPage() {
  return <SellerAuthShell eyebrow="Get started" title="Create your Seller account" description="Create your account in minutes. Verify your email, explore the portal and complete business verification when you're ready.">
    <SellerAccountRegistrationForm />
  </SellerAuthShell>;
}
