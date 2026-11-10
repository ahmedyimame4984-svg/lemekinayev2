'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getJson } from '@/lib/client-api';
import type { SellerListingArticleDetails, SellerListingRow } from '@/lib/seller-stock-contracts';
import { SellerListingEditor } from '@/components/seller-listing-editor';
import { SellerListingMedia } from '@/components/seller-listing-media';

function ListingField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1 rounded-lg border border-slate-200 p-3">
      <dt className="text-xs font-semibold text-slate-600">{label}</dt>
      <dd className="break-words text-sm text-slate-900">
        {value === null || value === undefined || value === '' ? 'Not provided' : value}
      </dd>
    </div>
  );
}

function fitmentLabel(item: SellerListingArticleDetails['compatibilities'][number]): string {
  const configured = item.vehicleConfiguration;
  if (!configured) return item.vehicleConfigurationId ?? 'Unknown configuration';
  return [
    configured.make.name, configured.model.name, configured.generation?.name,
    configured.trim?.name, configured.engine?.name, configured.transmission?.code,
    configured.bodyType?.name, configured.market?.name, configured.modelYear,
  ].filter(Boolean).join(' · ') || configured.code || configured.identityCode;
}

export default function SellerListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<SellerListingRow | null>(null);
  const [article, setArticle] = useState<SellerListingArticleDetails | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    const base = `/api/seller/listings/${encodeURIComponent(id)}`;
    const [current, details, review] = await Promise.all([
      getJson<SellerListingRow>(base),
      getJson<SellerListingArticleDetails>(`${base}/article-details`),
      getJson<{ revision: { id: string } | null }>(`${base}/pending-edit`),
    ]);
    setListing(current);
    setArticle(details);
    setPending(Boolean(review.revision));
  }, [id]);

  useEffect(() => {
    let active = true;
    const base = `/api/seller/listings/${encodeURIComponent(id)}`;
    setLoading(true);
    setError('');
    void Promise.all([
      getJson<SellerListingRow>(base),
      getJson<SellerListingArticleDetails>(`${base}/article-details`),
      getJson<{ revision: { id: string } | null }>(`${base}/pending-edit`),
    ]).then(([current, details, review]) => {
      if (!active) return;
      setListing(current); setArticle(details); setPending(Boolean(review.revision));
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load Listing.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (loading || !listing || new URLSearchParams(window.location.search).get('manage') !== 'images') return;
    document.getElementById('seller-listing-images')?.scrollIntoView({ block: 'start' });
  }, [loading, listing]);

  const editable = listing && ['DRAFT','REJECTED','ACTIVE','OUT_OF_STOCK','PAUSED'].includes(listing.status);
  const identifiers = article?.partNumbers ?? [];
  const attributes = article?.attributeValues ?? [];
  const fitments = article?.compatibilities ?? [];
  const commercial = listing?.commercialDetails;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <Link href="/products?tab=listing"
        className="text-sm font-medium text-[#a71920] underline focus-visible:outline-2">
        Back to My Listings
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Listing workspace</h1>
          <p className="mt-1 text-sm text-slate-600">
            Product specifications, selling details, packaging and photos in one place.
          </p>
        </div>
        {listing ? <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
          {listing.status === 'DRAFT' && listing.reviewIntent ? 'Waiting for Article approval' : listing.status}
        </span> : null}
      </header>
      <nav aria-label="Listing sections" className="flex flex-wrap gap-2 text-sm">
        {[
          { href: '#listing-product', label: 'Product' },
          { href: '#listing-specifications', label: 'Specifications & fitment' },
          { href: '#listing-selling', label: 'Selling, packaging & photos' },
        ].map(item => <a key={item.href} href={item.href}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 hover:border-slate-400 focus-visible:outline-2">
          {item.label}
        </a>)}
      </nav>

      {loading ? <p role="status">Loading Listing…</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {pending ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Your proposed changes are awaiting Admin approval. The previously approved Listing remains visible to buyers.
      </p> : null}
      {!loading && listing && article ? (
        <>
          <section id="listing-product" aria-label="Linked product identity"
            className="scroll-mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{listing.sellerTitle || article.name || listing.sellerSku}</h2>
              <span className="text-xs font-medium text-slate-600">
                {article.status === 'ACTIVE' ? 'Linked approved Article' : 'Article verification pending'}
              </span>
            </div>
            {article.status === 'DRAFT' ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Product verification is pending. Your Listing will not become public until Article and Listing approvals finish.
                {article.articleSource === 'SELLER_SUBMISSION' && listing.sellerId &&
                  article.sourceSellerId === listing.sellerId ? (
                  <Link href={article.catalogReviewSubmittedAt ? '/products?tab=listing'
                    : `/products?tab=listing&draftProductId=${encodeURIComponent(article.id)}`}
                    className="ml-2 font-semibold underline">Review Article details</Link>
                ) : null}
              </p>
            ) : null}
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ListingField label="Seller SKU" value={listing.sellerSku}/>
              <ListingField label="Product Type" value={article.productType?.name}/>
              <ListingField label="Brand" value={article.brand?.name}/>
              <ListingField label="Condition" value={listing.condition}/>
              <ListingField label="Selling price" value={listing.price
                ? `${listing.price.sellingPrice} ${listing.price.currency}` : null}/>
              {listing.price?.promotionalPrice != null ?
                <ListingField label="Customer offer price" value={`${listing.price.promotionalPrice} ${listing.price.currency}`}/> : null}
              <ListingField label="Available stock" value={listing.quantityAvailable}/>
              <ListingField label="Stock on hand" value={listing.quantityOnHand}/>
              <ListingField label="Warranty" value={listing.warrantyInformation}/>
              {identifiers.map((item, index) => <ListingField key={`${item.type}-${index}`}
                label={item.type === 'MANUFACTURER' ? 'Manufacturer part number' :
                  item.type === 'OE' ? 'OE reference' :
                  item.type === 'CROSS_REFERENCE' ? 'Cross reference' : item.type}
                value={item.partNumber}/>)}
              {article.articleIdentifiers.map((item,index) =>
                <ListingField key={`identifier-${item.type}-${index}`} label={item.type} value={item.value}/>)}
              {commercial?.packageLengthCm != null && commercial?.packageWidthCm != null &&
                commercial?.packageHeightCm != null ? <ListingField label="Packed dimensions (cm)"
                  value={`${commercial.packageLengthCm} × ${commercial.packageWidthCm} × ${commercial.packageHeightCm}`}/> : null}
              {commercial?.packageWeightKg != null ? <ListingField label="Gross package weight (kg)"
                value={commercial.packageWeightKg}/> : null}
              {commercial?.transportMethods?.length ? <ListingField label="Suitable delivery methods for ONE unit"
                value={commercial.transportMethods.join(', ')}/> : null}
            </dl>
            <p className="text-xs text-slate-600">
              Technical Article identity is shared reference information. The Seller Listing controls its own commercial terms.
            </p>
          </section>

          <section id="listing-specifications" aria-label="Technical details and compatible vehicles"
            className="scroll-mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Technical specifications &amp; vehicle compatibility</h2>
            {attributes.length ? <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {attributes.map(row => {
                const value = row.valueString ?? row.valueNumeric ?? row.valueBoolean ??
                  row.valueReferenceId ?? row.valueJson;
                return <ListingField key={row.attribute.code} label={row.attribute.name}
                  value={`${typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'Not provided')}${row.unit ? ` ${row.unit}` : ''}`}/>;
              })}
            </dl> : <p className="text-sm text-slate-600">No additional technical attributes recorded.</p>}
            <h3 className="text-base font-semibold">Compatible vehicles ({fitments.length})</h3>
            {fitments.length ? <ul className="space-y-2">
              {fitments.map((row,index) => <li key={`${row.vehicleConfigurationId}-${index}`}
                className="rounded-lg border border-slate-200 p-3 text-sm">
                <span className="font-medium">{fitmentLabel(row)}</span>
                <span className="ml-2 text-slate-600">({row.fitmentType}, {row.verificationStatus})</span>
              </li>)}
            </ul> : <p className="text-sm text-slate-600">No configured-vehicle fitments recorded.</p>}
          </section>

          <section id="listing-selling" aria-label="Listing editing, photos and submission" className="scroll-mt-6 space-y-3">
            {editable ? (
              <SellerListingEditor key={`${listing.id}-${listing.version}`}
                inline listing={listing} article={article}
                onDone={async () => {
                  await reload();
                  setNotice('Listing saved. Price-only changes are immediate; other live changes need Admin review.');
                }}
                onClose={() => {}}/>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Listing photos &amp; documents</h2>
                <SellerListingMedia listingId={listing.id} readOnly/>
              </>
            )}
          </section>
          <p className="text-xs text-slate-600">
            Stock movements are recorded in Inventory to preserve audit history.
            Transport options are seller estimates for one selling unit, not confirmed carrier bookings.
          </p>
        </>
      ) : null}
    </main>
  );
}
