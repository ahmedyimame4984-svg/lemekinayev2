import { redirect } from 'next/navigation';

export default function LegacyProductCompatibilityRedirect() {
  redirect('/admin/catalog/product-types');
}
