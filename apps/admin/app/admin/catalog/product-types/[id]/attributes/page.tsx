import { redirect } from 'next/navigation';

export default async function ProductTypeAttributesRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/catalog/product-types?productTypeId=${id}`);
}
