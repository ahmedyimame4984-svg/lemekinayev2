type CatalogSection =
  | 'quality'
  | 'article-review'
  | 'oe-references'
  | 'article-relations'
  | 'product-types'
  | 'categories'
  | 'part-groups'
  | 'attributes'
  | 'workspace'
  | 'products'
  | 'imports'
  | 'brands'
  | 'structure'
  | 'advanced';

const items: Array<{
  key:
    | 'quality'
    | 'article-review'
    | 'oe-references'
    | 'article-relations'
    | 'product-types'
    | 'categories'
    | 'part-groups'
    | 'attributes'
    | 'brands'
    | 'imports'
    | 'advanced';
  label: string;
  href: string;
}> = [
  {
    key: 'quality',
    label: 'Catalog Quality',
    href: '/admin/catalog/quality',
  },
  {
    key: 'article-review',
    label: 'Article Review',
    href: '/admin/catalog/article-review',
  },
  {
    key: 'oe-references',
    label: 'OE & References',
    href: '/admin/catalog/oe-references',
  },
  {
    key: 'article-relations',
    label: 'Relations',
    href: '/admin/catalog/article-relations',
  },
  {
    key: 'product-types',
    label: 'Product Types',
    href: '/admin/catalog/product-types',
  },
  {
    key: 'categories',
    label: 'Categories',
    href: '/admin/catalog/categories',
  },
  {
    key: 'part-groups',
    label: 'Part Groups',
    href: '/admin/catalog/part-groups',
  },
  {
    key: 'attributes',
    label: 'Attribute Library',
    href: '/admin/catalog/attributes',
  },
  {
    key: 'brands',
    label: 'Brand Master',
    href: '/admin/catalog/brands',
  },
  {
    key: 'imports',
    label: 'Imports & Jobs',
    href: '/admin/imports',
  },
  {
    key: 'advanced',
    label: 'Criteria Templates',
    href: '/admin/catalog/criteria-templates',
  },
];

export function normalizeCatalogSection(active: CatalogSection) {
  if (active === 'workspace' || active === 'products') return 'product-types';
  if (active === 'structure') return 'part-groups';
  return active;
}

export function CatalogPrimaryNav({
  active,
}: {
  active: CatalogSection;
}) {
  const normalizedActive = normalizeCatalogSection(active);

  return (
    <nav className="catalog-primary-nav" aria-label="Product catalog">
      {items.map((item) => (
        <a
          className={
            item.key === normalizedActive
              ? 'catalog-primary-nav__active'
              : undefined
          }
          href={item.href}
          key={item.key}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
