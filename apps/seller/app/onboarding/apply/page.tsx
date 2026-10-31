import type { Metadata } from 'next';
import { SellerRegistrationForm } from '@/components/registration/seller-registration-form';

export const metadata: Metadata = { title: 'Seller business verification' };

export default function SellerApplyPage() {
  return (
    
      <main className="min-h-screen bg-slate-50">
        <SellerRegistrationForm />
      </main>
    
  );
}
