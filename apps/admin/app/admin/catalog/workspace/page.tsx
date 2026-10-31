import { redirect } from 'next/navigation';

export default async function CatalogWorkspaceRedirect({
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
  const query = new URLSearchParams();

  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.productFamilyId) {
    query.set('productFamilyId', params.productFamilyId);
  }
  if (params.productTypeId) query.set('productTypeId', params.productTypeId);
  if (params.create) query.set('create', params.create);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  redirect(`/admin/catalog/product-types${suffix}`);
}
