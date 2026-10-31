import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SellerStockWorkspace } from '@/components/seller-stock-workspace';

export const metadata: Metadata = { title: 'My Products' };

export default function SellerProductsPage() {
  return (
    
      <Suspense fallback={<p role="status" className="p-6 text-sm text-slate-600">Loading Products…</p>}>
      <SellerStockWorkspace />
    </Suspense>
    
  );
}
