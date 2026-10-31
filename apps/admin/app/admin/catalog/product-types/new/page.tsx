import { redirect } from 'next/navigation';

export default async function NewProductTypePage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string;
    productFamilyId?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ create: '1' });

  if (params.categoryId) {
    query.set('categoryId', params.categoryId);
  }
  if (params.productFamilyId) {
    query.set('productFamilyId', params.productFamilyId);
  }

  redirect(`/admin/catalog/product-types?${query.toString()}`);
}
