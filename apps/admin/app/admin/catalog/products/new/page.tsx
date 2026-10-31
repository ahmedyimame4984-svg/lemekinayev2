import { redirect } from 'next/navigation';

export default function LegacyNewProductRedirect() {
  redirect('/admin/catalog/product-types');
}
