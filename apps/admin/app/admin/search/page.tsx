import type { Metadata } from 'next';
import { GlobalCatalogSearch } from '@/components/global-catalog-search';

export const metadata: Metadata = {
  title: 'Global Catalog Search',
};

export default async function GlobalCatalogSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <GlobalCatalogSearch initialQuery={params.q ?? ''} />;
}
