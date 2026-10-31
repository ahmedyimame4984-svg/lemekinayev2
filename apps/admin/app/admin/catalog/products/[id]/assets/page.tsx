import { redirect } from 'next/navigation';

export default function LegacyProductAssetsRedirect() {
  redirect('/admin/catalog/product-types');
}
