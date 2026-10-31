import type { Metadata } from 'next';
import { SellerLoginForm } from '@/components/seller-login-form';
import { SellerAuthShell } from '@/components/seller-auth-shell';

export const metadata: Metadata = {
  title: 'Seller sign in',
  description: 'Secure Seller catalog access for Lemekinaye.',
};

export default function SellerLoginPage() {
  return (
    <SellerAuthShell eyebrow="Welcome back" title="Sign in to your workspace" description="Access your Seller dashboard, business application and automotive parts catalog.">
      <SellerLoginForm />
    </SellerAuthShell>
  );
}
