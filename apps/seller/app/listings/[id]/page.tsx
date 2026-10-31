'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getJson, patchJson, postJson } from '@/lib/client-api';
import type { SellerListingArticleDetails, SellerListingRow } from '@/lib/seller-stock-contracts';
import { SellerListingEditor } from '@/components/seller-listing-editor';
import { SellerListingMedia, type ProposedMediaSelection } from '@/components/seller-listing-media';

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
  const [panel, setPanel] = useState<'details' | 'listing' | 'images'>('details');
  const [imagesPending, setImagesPending] = useState(false);
  const [imageSelection, setImageSelection] = useState<ProposedMediaSelection | null>(null);
  const [imagesSaving, setImagesSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    const endpoint = `/api/seller/listings/${encodeURIComponent(id)}`;
    const [current, specifications, pendingRevision] = await Promise.all([
      getJson<SellerListingRow>(endpoint),
      getJson<SellerListingArticleDetails>(`${endpoint}/article-details`),
      getJson<{ revision: { id: string } | null }>(`${endpoint}/pending-edit`),
    ]);
    setListing(current);
    setArticle(specifications);
    setPending(Boolean(pendingRevision.revision));
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    // Ignore results of a stale route after navigation to another Listing.
    const endpoint = `/api/seller/listings/${encodeURIComponent(id)}`;
    void Promise.all([
      getJson<SellerListingRow>(endpoint),
      getJson<SellerListingArticleDetails>(`${endpoint}/article-details`),
      getJson<{ revision: { id: string } | null }>(`${endpoint}/pending-edit`),
    ]).then(([current, specifications, revision]) => {
      if (!active) return;
      setListing(current); setArticle(specifications); setPending(Boolean(revision.revision));
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load Listing details.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('manage') === 'images') {
      setPanel('images');
    }
  }, [id]);

  const editable = listing && ['DRAFT', 'REJECTED', 'ACTIVE', 'OUT_OF_STOCK', 'PAUSED'].includes(listing.status);
  const imagesEditable = editable && !pending;
  async function submitForReview() {
    if (!listing || submitting || imagesPending) return;
    if (listing.status !== 'DRAFT' && listing.status !== 'REJECTED') return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await postJson<SellerListingRow>(
        `/api/seller/listings/${encodeURIComponent(listing.id)}/finish`, {},
      );
      await reload();
      setPanel('details');
      setNotice(result.status === 'SUBMITTED'
        ? 'Product submitted for Admin review. It is not public until approved.'
        : result.reviewIntent
          ? 'Product saved. Catalog verification is pending; Listing review will begin when all requirements are met.'
          : 'Product remains a Draft. Complete any missing information and submit again.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit this product. Check required fields and images.');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveImageRevision() {
    if (!listing || !imageSelection?.changed || imagesPending || imagesSaving) return;
    setImagesSaving(true);
    setError('');
    try {
      await patchJson(`/api/seller/listings/${encodeURIComponent(listing.id)}/edit`, {
        version: listing.version,
        mediaAssetIds: imageSelection.assetIds,
        primaryMediaId: imageSelection.primaryId,
      });
      await reload();
      setPanel('details');
      setImageSelection(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit images for review.');
    } finally {
      setImagesSaving(false);
    }
  }
  const identifiers = article?.partNumbers ?? [];
  const attributes = article?.attributeValues ?? [];
  const fitments = article?.compatibilities ?? [];

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <Link href="/products?tab=listing" className="text-sm font-medium text-[#a71920] underline focus-visible:outline-2">
        Back to My Products
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Listing details</h1>
          <p className="mt-1 text-sm text-slate-600">Your SKU, product specifications and selling information in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? <button type="button"
            disabled={panel === 'images' && imagesPending}
            onClick={() => setPanel(current => current === 'listing' ? 'details' : 'listing')}
            className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
            {panel === 'listing' ? 'Close editor' : 'Edit Listing'}
          </button> : null}
          {editable ? <button type="button"
            disabled={!imagesEditable || imagesSaving || (panel === 'images' && imagesPending)}
            onClick={() => { setImagesPending(false); setPanel(current => current === 'images' ? 'details' : 'images'); }}
            aria-expanded={panel === 'images'}
            aria-controls="seller-listing-image-manager"
            className="rounded-lg border border-[#a71920] px-4 py-2.5 text-sm font-semibold text-[#a71920] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:cursor-not-allowed disabled:opacity-50">
            {panel === 'images' ? 'Close Images' : 'Update Images'}
          </button> : null}
        </div>
      </div>
      {loading ? <p role="status">Loading Listing…</p> : null}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p> : null}
      {editable && pending ? <p role="status" className="text-sm text-amber-800">
        Admin must decide on the current revision before you can submit additional image changes.
      </p> : null}
      {pending && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Changes are awaiting Admin review. Your approved Listing remains live with its current details.
      </p>}
      {!loading && listing && article ? (
        panel === 'listing' ? <SellerListingEditor listing={listing} article={article}
          onDone={reload} onClose={() => setPanel('details')} /> :
        panel === 'images' && imagesEditable ? (
          <section id="seller-listing-image-manager" className="space-y-3">
            <h2 className="text-lg font-semibold">
              {['DRAFT', 'REJECTED'].includes(listing.status) ? 'Step 3 · Add product images' : 'Update Listing images'}
            </h2>
            <p className="text-sm text-slate-600">
              Add or remove images, choose a primary photo and arrange the order.
              Uploaded images are saved and verified separately from Listing text changes.
            </p>
            <SellerListingMedia listingId={listing.id}
              reviewMode={!['DRAFT', 'REJECTED'].includes(listing.status)}
              readOnly={imagesSaving}
              onPendingChange={setImagesPending}
              onSelectionChange={setImageSelection}/>
            {['DRAFT', 'REJECTED'].includes(listing.status) ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold">Step 4 · Review and submit</h3>
                <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <div><dt className="font-semibold">Product</dt><dd>{article.name}</dd></div>
                  <div><dt className="font-semibold">Product Type and brand</dt>
                    <dd>{article.productType?.name ?? 'Not specified'} · {article.brand?.name ?? 'Not specified'}</dd>
                  </div>
                  <div><dt className="font-semibold">Seller SKU</dt><dd>{listing.sellerSku}</dd></div>
                  <div><dt className="font-semibold">Selling price</dt>
                    <dd>{listing.price
                      ? `${listing.price.sellingPrice} ${listing.price.currency}` : 'Price required'}</dd>
                  </div>
                  <div><dt className="font-semibold">Stock on hand</dt>
                    <dd>{listing.quantityOnHand}</dd>
                  </div>
                  <div><dt className="font-semibold">Vehicle compatibility</dt>
                    <dd>{fitments.length} configured fitment{fitments.length === 1 ? '' : 's'}</dd>
                  </div>
                </dl>
                {fitments.length > 0 ? <ul className="space-y-1 text-xs text-slate-700">
                  {fitments.slice(0, 3).map((fitment, index) => (
                    <li key={`${fitment.vehicleConfigurationId}-${index}`}>{fitmentLabel(fitment)}</li>
                  ))}
                  {fitments.length > 3 ? <li>And {fitments.length - 3} more compatible vehicles</li> : null}
                </ul> : null}
                <p className="text-sm text-slate-600">
                  Product identity, compatibility, stock, price and media are checked before submission.
                  If product verification is still needed, this Listing remains private until eligible for Admin review.
                </p>
                <button type="button" disabled={submitting || imagesPending || imagesSaving}
                  className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                  onClick={() => void submitForReview()}>
                  {submitting ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            ) : null}
            {['ACTIVE', 'PAUSED', 'OUT_OF_STOCK'].includes(listing.status) ? (
              <button type="button"
                className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 disabled:opacity-50"
                disabled={!imageSelection?.changed || imagesPending || imagesSaving}
                onClick={() => void saveImageRevision()}>
                {imagesSaving ? 'Submitting…' : 'Submit Images for Admin Review'}
              </button>
            ) : null}
            {imagesPending ? <p role="status" className="text-sm text-amber-800">
              Upload or remove selected files before closing image management.
            </p> : null}
          </section>
        ) : (
          <>
            <section aria-label="Listing product and selling details" className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{listing.sellerTitle || article.name || listing.sellerSku}</h2>
                <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold">{listing.status}</span>
              </div>
              {article.status === 'DRAFT' ? (
                <p className="text-sm text-amber-800">
                  {article.catalogReviewSubmittedAt
                    ? 'Product information is awaiting catalog verification.'
                    : 'Product information may need correction before publication.'}
                  {article.articleSource === 'SELLER_SUBMISSION' && listing.sellerId &&
                    article.sourceSellerId === listing.sellerId ? (
                    <Link className="ml-2 font-semibold underline focus-visible:outline-2"
                      href={article.catalogReviewSubmittedAt
                        ? '/products?tab=listing'
                        : `/products?tab=listing&draftProductId=${encodeURIComponent(article.id)}`}>
                      {article.catalogReviewSubmittedAt ? 'View verification status' : 'Correct product information'}
                    </Link>
                  ) : null}
                </p>
              ) : null}
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ListingField label="Seller SKU" value={listing.sellerSku}/>
                <ListingField label="Product Type" value={article.productType?.name}/>
                <ListingField label="Brand" value={article.brand?.name}/>
                {identifiers.map((number, index) => (
                  <ListingField key={`${number.type}-${index}`}
                    label={number.type === 'MANUFACTURER' ? 'Manufacturer part number' :
                      number.type === 'OE' ? 'OE reference' :
                      number.type === 'CROSS_REFERENCE' ? 'Cross reference' : number.type}
                    value={number.partNumber}/>
                ))}
                {article.articleIdentifiers.map((number, index) => (
                  <ListingField key={`identifier-${number.type}-${index}`}
                    label={number.type} value={number.value}/>
                ))}
                <ListingField label="Condition" value={listing.condition}/>
                <ListingField label="Price" value={listing.price ? `${listing.price.sellingPrice} ${listing.price.currency}` : null}/>
                <ListingField label="Available stock" value={listing.quantityAvailable}/>
                <ListingField label="Total stock" value={listing.quantityOnHand}/>
                <ListingField label="Description" value={listing.sellerDescription}/>
                <ListingField label="Warranty" value={listing.warrantyInformation}/>
                <ListingField label="Delivery" value={listing.deliveryInformation}/>
              </dl>
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Technical attributes</h3>
                {attributes.length ? <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {attributes.map(row => {
                    const value = row.valueString ?? row.valueNumeric ?? row.valueBoolean ?? row.valueReferenceId ?? row.valueJson;
                    return <ListingField key={row.attribute.code} label={row.attribute.name}
                      value={`${typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'Not provided')}${row.unit ? ` ${row.unit}` : ''}`}/>;
                  })}
                </dl> : <p className="text-sm text-slate-600">No additional technical attributes recorded.</p>}
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Compatible vehicles</h3>
                {fitments.length ? <ul className="space-y-2">
                  {fitments.map((row, index) => (
                    <li key={`${row.vehicleConfigurationId}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <span className="font-medium">{fitmentLabel(row)}</span>
                      <span className="ml-2 text-slate-600">({row.fitmentType}, {row.verificationStatus})</span>
                    </li>
                  ))}
                </ul> : <p className="text-sm text-slate-600">No configured-vehicle fitments recorded.</p>}
              </div>
            </section>
            <SellerListingMedia listingId={listing.id} readOnly/>
            <p className="text-xs text-slate-600">
              Stock adjustments are recorded in Inventory to preserve the movement and reservation history.
            </p>
          </>
        )
      ) : null}
    </main>
  );
}
