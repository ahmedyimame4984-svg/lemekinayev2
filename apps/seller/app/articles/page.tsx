import type { Metadata } from 'next';
import { SellerArticleWorkspace } from '@/components/seller-article-workspace';

export const metadata: Metadata = {
  title: 'Manufacturer Articles',
};

export default function SellerArticlesPage() {
  return (
    
      <SellerArticleWorkspace />
    
  );
}
