import { redirect } from 'next/navigation';

export default function LegacyProductIdentityRedirect() {
  redirect('/admin/catalog/product-types');
}
