import Link from 'next/link';

interface SellerManagementTabsProps {
  activeTab: 'sellers' | 'applications' | 'listings';
}

export function SellerManagementTabs({ activeTab }: SellerManagementTabsProps) {
  return (
    <nav className="catalog-tabs" aria-label="Seller management sections">
      <Link
        href="/admin/marketplace/sellers"
        className={activeTab === 'sellers' ? 'catalog-tabs__active' : undefined}
        aria-current={activeTab === 'sellers' ? 'page' : undefined}
      >
        Sellers
      </Link>
      <Link
        href="/admin/marketplace/sellers?tab=applications"
        className={activeTab === 'applications' ? 'catalog-tabs__active' : undefined}
        aria-current={activeTab === 'applications' ? 'page' : undefined}
      >
        Open Applications
      </Link>
      <Link
        href="/admin/marketplace/listings"
        className={activeTab === 'listings' ? 'catalog-tabs__active' : undefined}
        aria-current={activeTab === 'listings' ? 'page' : undefined}
      >
        Listing Reviews
      </Link>
    </nav>
  );
}
