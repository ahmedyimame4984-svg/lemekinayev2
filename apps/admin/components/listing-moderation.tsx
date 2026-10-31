'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type {
  SellerListingRecord,
  SellerListingStatus,
  SellerRecord,
} from '@/lib/marketplace-contracts';
import type { ProductRecord } from '@/lib/product-contracts';
import { ErrorAlert } from './error-alert';
import { AdminListingMedia } from './admin-listing-media';
import { useAdminPrincipal } from './admin-session';

type ListingStatusFilter = 'ALL' | SellerListingStatus;

const listingStatuses: SellerListingStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'ACTIVE',
  'REJECTED',
  'PAUSED',
  'SUSPENDED',
  'OUT_OF_STOCK',
  'INACTIVE',
  'ARCHIVED',
];

export function ListingModeration() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('listing.manage');

  const [sellers, setSellers] = useState<SellerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [listings, setListings] = useState<SellerListingRecord[]>([]);
  const [pendingListingIds, setPendingListingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [statusFilter, setStatusFilter] =
    useState<ListingStatusFilter>('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');

  const [mediaListingId, setMediaListingId] = useState('');
  const [refreshRevision, setRefreshRevision] = useState(0);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;
    async function load() {
      try {
        setLoading(true);
        setLoadError('');
        const [sellerResponse, productResponse, listingResponse, pendingResponse] =
          await Promise.all([
            fetch('/api/admin/sellers', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
            fetch('/api/admin/products', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
            fetch('/api/admin/listings', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
            fetch('/api/admin/listings/pending-revisions', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
          ]);

        if (!pendingResponse.ok) {
          throw new Error('Could not load pending Seller Listing revisions.');
        }
        if (!listingResponse.ok) {
          throw new Error('Could not load marketplace moderation data');
        }

        const listingData =
          (await listingResponse.json()) as SellerListingRecord[];
        const pendingData = (await pendingResponse.json()) as Array<{ listingId: string }>;
        const sellerData = sellerResponse.ok
          ? ((await sellerResponse.json()) as SellerRecord[])
          : [];
        const productData = productResponse.ok
          ? ((await productResponse.json()) as ProductRecord[])
          : [];

        if (!active) return;
        setSellers(sellerData);
        setProducts(productData);
        setListings(listingData);
        setPendingListingIds(new Set(pendingData.map(item => item.listingId)));
      } catch {
        if (active) {
          setLoadError(
            'Seller Listings could not be loaded. Check that the API and database are running.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [canManage, refreshRevision]);

  const sellerById = useMemo(
    () => new Map(sellers.map((seller) => [seller.id, seller])),
    [sellers],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const visibleListings = useMemo(
    () =>
      [...listings]
        .filter((listing) =>
          statusFilter === 'ALL' ? true : listing.status === statusFilter,
        )
        .filter((listing) =>
          sellerFilter === 'ALL' ? true : listing.sellerId === sellerFilter,
        )
        .filter((listing) =>
          productFilter === 'ALL' ? true : listing.productId === productFilter,
        )
        .sort(
          (a, b) =>
            a.updatedAt.localeCompare(b.updatedAt) * -1 ||
            a.id.localeCompare(b.id),
        ),
    [listings, productFilter, sellerFilter, statusFilter],
  );

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Marketplace operations</span>
        <h1>Listing moderation</h1>
        <p>
          Your administrator account does not have the listing.manage
          permission.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">Marketplace operations</span>
          <h1>Seller Listing moderation</h1>
          <p>
            Review Seller Listings without changing seller-owned Product data.
            Approval checks Seller verification, Article activation, required Product Type
            selling fields, Inventory and Seller-specific media before publication.
          </p>
        </div>
      </div>

      <nav className="catalog-tabs" aria-label="Marketplace operations">
        <a href="/admin/marketplace/sellers">Sellers</a>
        <a
          className="catalog-tabs__active"
          href="/admin/marketplace/listings"
        >
          Listing moderation
        </a>
      </nav>

      <div className="catalog-toolbar catalog-toolbar--filters">
        <button type="button" className="button button--quiet"
          disabled={loading} onClick={() => setRefreshRevision(value => value + 1)}>
          Refresh Listings
        </button>
        <div className="catalog-filter">
          <label htmlFor="listing-status-filter">Listing status</label>
          <select
            id="listing-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ListingStatusFilter)
            }
          >
            <option value="ALL">All statuses</option>
            {listingStatuses.map((status) => (
              <option value={status} key={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="listing-seller-filter">Seller</label>
          <select
            id="listing-seller-filter"
            value={sellerFilter}
            onChange={(event) => setSellerFilter(event.target.value)}
          >
            <option value="ALL">All Sellers</option>
            {[...sellers]
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
              .map((seller) => (
                <option value={seller.id} key={seller.id}>
                  {seller.displayName} · {seller.sellerCode}
                </option>
              ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="listing-product-filter">Product</label>
          <select
            id="listing-product-filter"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          >
            <option value="ALL">All Products</option>
            {[...products]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name}
                </option>
              ))}
          </select>
        </div>
      </div>


      {loading ? (
        <div className="catalog-state">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading Seller Listings…</p>
        </div>
      ) : null}

      {loadError ? <ErrorAlert message={loadError} /> : null}

      {!loading && !loadError && visibleListings.length === 0 ? (
        <div className="catalog-empty">
          <h2>No Seller Listings found</h2>
          <p>
            There are no Listings matching the current moderation filters.
          </p>
        </div>
      ) : null}

      {!loading && !loadError && visibleListings.length > 0 ? (
        <div className="product-type-list">
          {visibleListings.map((listing) => {
            const seller = sellerById.get(listing.sellerId);
            const product = productById.get(listing.productId);

            return (
              <div
                className="product-type-row product-master-row"
                key={listing.id}
              >
                <div className="product-type-row__identity">
                  <strong>{product?.name ?? 'Unknown Product'}</strong>
                  <span>{listing.sellerSku}</span>
                </div>

                <div className="product-type-row__category">
                  <small>Seller · Condition</small>
                  <span>
                    {seller?.displayName ?? shortId(listing.sellerId)}
                    {' · '}
                    {label(listing.condition)}
                  </span>
                </div>

                <span
                  className={`category-status category-status--${statusTone(
                    listing.status,
                  )}`}
                >
                  {pendingListingIds.has(listing.id)
                    ? 'Pending proposed changes'
                    : listing.status === 'DRAFT' && listing.reviewIntent
                      ? 'Waiting for Product Article approval'
                      : label(listing.status)}
                </span>

                <span className="product-type-row__sort">
                  {formatPrice(listing)}
                </span>

                <div className="product-type-row__actions">
                  <Link className="button button--primary"
                    href={`/admin/marketplace/listings/${encodeURIComponent(listing.id)}`}>
                    {pendingListingIds.has(listing.id) ? 'Review pending changes' : 'View full details & review'}
                  </Link>
                </div>

                <div className="mt-2">
                  <button type="button" className="button button--quiet"
                    aria-expanded={mediaListingId === listing.id}
                    onClick={() => setMediaListingId(current =>
                      current === listing.id ? '' : listing.id)}>
                    {mediaListingId === listing.id ? 'Hide Seller media' : 'Review Seller media'}
                  </button>
                  {mediaListingId === listing.id ? (
                    <AdminListingMedia listingId={listing.id}/>
                  ) : null}
                </div>
                <div className="product-master-row__values">
                  <span>
                    <small>On hand</small>
                    {listing.quantityOnHand}
                  </span>
                  <span>
                    <small>Reserved</small>
                    {listing.quantityReserved}
                  </span>
                  <span>
                    <small>Available</small>
                    {listing.quantityAvailable}
                  </span>
                  <span>
                    <small>Seller status</small>
                    {seller ? label(seller.status) : 'Unknown'}
                  </span>
                  {listing.rejectionReason ? (
                    <span>
                      <small>Rejection reason</small>
                      {listing.rejectionReason}
                    </span>
                  ) : null}
                </div>


              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function formatPrice(listing: SellerListingRecord): string {
  if (!listing.price) return 'No price';
  const price =
    listing.price.promotionalPrice ?? listing.price.sellingPrice;
  return `${listing.price.currency} ${formatNumber(price)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

function label(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function statusTone(status: SellerListingStatus): string {
  if (status === 'ACTIVE') return 'active';
  if (status === 'DRAFT' || status === 'SUBMITTED') return 'draft';
  return 'inactive';
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
