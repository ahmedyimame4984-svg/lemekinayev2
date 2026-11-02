import type { Metadata } from 'next';
import { ProductTypesManagement } from '@/components/product-types-management';

export const metadata: Metadata = {
  title: 'Product Types',
};

export default async function ProductTypesPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string;
    productFamilyId?: string;
    productTypeId?: string;
    create?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <ProductTypesManagement
      initialCategoryId={params.categoryId ?? ''}
      initialProductFamilyId={params.productFamilyId ?? ''}
      initialProductTypeId={params.productTypeId ?? ''}
      startCreate={false}
    />
  );
}
