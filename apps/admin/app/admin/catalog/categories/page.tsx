import type { Metadata } from 'next';
import { CategoriesManagement } from '@/components/categories-management';

export const metadata: Metadata = {
  title: 'Categories',
};

export default function CategoriesPage() {
  return <CategoriesManagement />;
}
