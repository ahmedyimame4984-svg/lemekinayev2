'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';
import type { ReviewArticle, ReviewListingDetail, ReviewVehicle } from '@/lib/listing-review-contracts';
import { AdminListingMedia } from './admin-listing-media';
import { AdminProposedListingMedia } from './admin-proposed-listing-media';
import { useAdminPrincipal } from './admin-session';

const fieldClass = 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const actionClass = 'rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';
const primaryAction = `${actionClass} bg-[#a71920] text-white focus-visible:outline-[#a71920]`;
const secondaryAction = `${actionClass} border border-slate-300 bg-white text-slate-800 focus-visible:outline-[#a71920]`;

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? 'Not recorded' : time.toLocaleString();
}

function Details({ values }: { values: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className={fieldClass}>
          <dt className={labelClass}>{label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-900">{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function vehicleLabel(vehicle: ReviewVehicle | null): string {
  if (!vehicle) return 'Vehicle configuration unavailable';
  return [
    vehicle.make?.name, vehicle.model?.name, vehicle.generation?.name,
    vehicle.modelYear, vehicle.trim?.name, vehicle.engine?.name,
    vehicle.transmission?.code, vehicle.bodyType?.name, vehicle.market?.name,
  ].filter(value => value !== null && value !== undefined && value !== '').join(' · ');
}

function ArticleReview({ article, heading }: {
  article: ReviewArticle | null; heading: string;
}) {
  if (!article) {
    return <section className={panelClass}><h2 className="text-lg font-semibold">{heading}</h2>
      <p role="alert" className="text-sm text-amber-800">Product Article details are unavailable. Do not approve until they load.</p>
    </section>;
  }

  return (
    <section className={panelClass} aria-label={heading}>
      <h2 className="text-lg font-semibold text-slate-950">{heading}</h2>
      <Details values={[
        ['Article', article.name], ['Article status', article.status],
        ['Product Type', article.productType?.name], ['Brand', article.brand?.name],
        ['Schema version', article.schemaVersionId], ['Article ID', article.id],
        ['Article source', article.articleSource], ['Article version', article.version],
        ['Published date', formatDate(article.publishedAt)],
        ['Short description', article.shortDescription], ['Description', article.description],
        ['Manufacturer notes', article.manufacturerNotes],
        ['Pack quantity', article.packQuantity], ['Unit of measure', article.unitOfMeasure?.code],
        ['Source reference', article.sourceReference],
        ['Images required', article.imageRequirement],
        ['Minimum images', article.minimumImageCount],
        ['Maximum images', article.maximumImageCount],
        ['Documents required', article.documentRequirement],
        ['Minimum documents', article.minimumDocumentCount],
      ]}/>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Part numbers and cross-references</h3>
          {article.partNumbers.length
            ? <ul className="space-y-1">{article.partNumbers.map((item, index) =>
              <li key={`${item.type}-${index}`} className={fieldClass}>
                <span className={labelClass}>{item.type}</span>
                <p className="break-all text-sm">{item.partNumber}</p>
                {item.issuerBrandId ? <p className="text-xs text-slate-600">Issuer brand: {item.issuerBrandId}</p> : null}
              </li>)}</ul>
            : <p className="text-sm text-slate-600">No part numbers recorded.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Article identifiers</h3>
          {article.articleIdentifiers.length
            ? <ul className="space-y-1">{article.articleIdentifiers.map((item, index) =>
              <li key={`${item.type}-${index}`} className={fieldClass}>
                <span className={labelClass}>{item.type}</span>
                <p className="break-all text-sm">{item.value}</p>
              </li>)}</ul>
            : <p className="text-sm text-slate-600">No additional identifiers recorded.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Technical attributes ({article.attributeValues.length})</h3>
        {article.attributeValues.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-100"><tr>
                <th scope="col" className="px-3 py-2">Attribute</th>
                <th scope="col" className="px-3 py-2">Value</th>
                <th scope="col" className="px-3 py-2">Unit</th>
              </tr></thead>
              <tbody>{article.attributeValues.map(row => (
                <tr key={row.attribute.code} className="border-t border-slate-200">
                  <th scope="row" className="px-3 py-2 font-medium">
                    {row.attribute.name} <span className="block text-xs text-slate-500">{row.attribute.code}</span>
                  </th>
                  <td className="break-words px-3 py-2">
                    {show(row.valueString ?? row.valueNumeric ?? row.valueBoolean ??
                      row.valueReferenceId ?? row.valueJson)}
                  </td>
                  <td className="px-3 py-2">{show(row.unit)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-600">No assigned values recorded.</p>}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Compatible configured vehicles ({article.compatibilities.length})</h3>
        {article.compatibilities.length ? (
          <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100"><tr>
                <th scope="col" className="px-3 py-2">Configured vehicle</th>
                <th scope="col" className="px-3 py-2">Fitment</th>
                <th scope="col" className="px-3 py-2">Verification</th>
                <th scope="col" className="px-3 py-2">Fitment details</th>
                <th scope="col" className="px-3 py-2">Reference ID</th>
              </tr></thead>
              <tbody>{article.compatibilities.map((fitment, index) => (
                <tr key={`${fitment.vehicleConfigurationId}-${index}`} className="border-t border-slate-200">
                  <td className="px-3 py-2">{vehicleLabel(fitment.vehicleConfiguration)}</td>
                  <td className="px-3 py-2">{fitment.fitmentType} · {fitment.status}</td>
                  <td className="px-3 py-2">{fitment.verificationStatus}</td>
                  <td className="px-3 py-2 text-xs">
                    {[
                      fitment.yearFrom || fitment.yearTo ? `Years ${fitment.yearFrom ?? '…'}–${fitment.yearTo ?? '…'}` : null,
                      fitment.steeringSide, fitment.driveType, fitment.position,
                      fitment.notes, fitment.conditions ? show(fitment.conditions) : null,
                      `Source: ${fitment.source}`,
                    ].filter(Boolean).join(' · ')}
                  </td>
                  <td className="break-all px-3 py-2 text-xs">{show(fitment.vehicleConfigurationId)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-600">No configured-vehicle fitments recorded.</p>}
      </div>
    </section>
  );
}

export function ListingReviewDetail({ listingId }: { listingId: string }) {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('listing.manage');
  const [detail, setDetail] = useState<ReviewListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState('');
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/admin/listings/${encodeURIComponent(listingId)}/review`,
      { credentials: 'same-origin', cache: 'no-store' },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as
        { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message ?? 'Could not load Listing review details.');
    }
    return response.json() as Promise<ReviewListingDetail>;
  }, [listingId]);

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError('');
    void load().then(result => { if (active) setDetail(result); })
      .catch(cause => { if (active) { setDetail(null); setError(cause instanceof Error ? cause.message : 'Review unavailable.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManage, load, refresh]);

  async function decide(action: 'approve' | 'reject') {
    if (!detail || working) return;
    const { listing, pendingRevision } = detail;
    if (action === 'reject' && (reason.trim().length < 3 || reason.trim().length > 1000)) {
      setError('Enter a rejection reason between 3 and 1000 characters.');
      return;
    }
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const suffix = pendingRevision
        ? `/${listing.id}/revisions/${pendingRevision.id}/${action}`
        : `/${listing.id}/${action}`;
      await postJson(`/api/admin/listings${suffix}`, action === 'reject'
        ? { ...(pendingRevision ? {} : { version: listing.version }), reason: reason.trim() }
        : pendingRevision ? {} : { version: listing.version });
      setNotice(action === 'approve'
        ? 'Review approved. The Listing publication state has been updated.'
        : 'Review rejected. The Seller can correct the rejected changes.');
      setReason('');
      setRefresh(value => value + 1);
    } catch (cause) {
      setError(cause instanceof ClientApiError || cause instanceof Error
        ? cause.message : 'Could not complete this review.');
    } finally {
      setWorking(false);
    }
  }

  if (!canManage) return <section className="catalog-page">
    <h1>Seller Listing review</h1><p>listing.manage permission is required.</p>
  </section>;

  const listing = detail?.listing;
  const revision = detail?.pendingRevision;
  const canReview = !!listing && (revision !== null && revision !== undefined ||
    listing.status === 'SUBMITTED');
  const reviewedArticle = revision?.proposedProductId
    ? detail?.proposedArticle : detail?.article;
  const proposedMedia = revision?.proposedMedia ?? null;
  const currentMedia = detail?.proposedMediaAssets ?? [];
  const imageCount = proposedMedia
    ? currentMedia.filter(asset => asset.type === 'IMAGE').length
    : (detail?.mediaSummary.verifiedImageCount ?? 0);
  const documentCount = proposedMedia
    ? currentMedia.filter(asset => asset.type === 'DOCUMENT').length
    : (detail?.mediaSummary.verifiedDocumentCount ?? 0);
  const imageMinimum = reviewedArticle?.imageRequirement === 'REQUIRED'
    ? Math.max(1, reviewedArticle.minimumImageCount) : 0;
  const documentMinimum = reviewedArticle?.documentRequirement === 'REQUIRED'
    ? Math.max(1, reviewedArticle.minimumDocumentCount) : 0;
  const mediaReady = !!reviewedArticle &&
    imageCount >= imageMinimum &&
    imageCount <= reviewedArticle.maximumImageCount &&
    documentCount >= documentMinimum &&
    (imageCount === 0 || (proposedMedia
      ? currentMedia.some(asset => asset.type === 'IMAGE' && asset.id === proposedMedia.primaryId)
      : !!detail?.mediaSummary.hasPrimaryImage)) &&
    (!proposedMedia || proposedMedia.assetIds.length === currentMedia.length) &&
    !(reviewedArticle.imageRequirement === 'NOT_APPLICABLE' && imageCount > 0) &&
    !(reviewedArticle.documentRequirement === 'NOT_APPLICABLE' && documentCount > 0);
  const sellerReady = detail?.seller?.status === 'ACTIVE' &&
    detail.seller.approvalStatus === 'APPROVED' &&
    detail.seller.verificationStatus === 'VERIFIED';
  const canApprove = canReview && reviewedArticle?.status === 'ACTIVE' &&
    mediaReady && sellerReady;

  return (
    <main className="catalog-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/marketplace/listings"
            className="text-sm font-semibold text-[#a71920] underline focus-visible:outline-2">
            Back to Listing moderation
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Full Seller Listing review</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review the complete current Listing and any proposed changes before publication.
          </p>
        </div>
        <button type="button" className={secondaryAction} disabled={loading || working}
          onClick={() => setRefresh(value => value + 1)}>Refresh review</button>
      </div>

      {loading ? <p role="status">Loading complete Listing details…</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-green-300 p-3 text-sm text-green-800">{notice}</p> : null}

      {detail && listing ? (
        <>
          <section className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Listing · {listing.sellerSku}</h2>
              <span className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold">{listing.status}</span>
            </div>
            <Details values={[
              ['Seller SKU', listing.sellerSku], ['Listing title', listing.sellerTitle],
              ['Seller description', listing.sellerDescription], ['Condition', listing.condition],
              ['Warranty', listing.warrantyInformation], ['Delivery', listing.deliveryInformation],
              ['Commercial terms', listing.commercialTerms], ['Listing version', listing.version],
              ['Quantity on hand', listing.quantityOnHand], ['Reserved', listing.quantityReserved],
              ['Available', listing.quantityAvailable],
              ['Price', listing.price ? `${listing.price.currency} ${listing.price.sellingPrice}` : null],
              ['Promotional price', listing.price?.promotionalPrice],
              ['Minimum order quantity', listing.price?.minOrderQuantity],
              ['Created', formatDate(listing.createdAt)], ['Last updated', formatDate(listing.updatedAt)],
              ['Approved', formatDate(listing.approvedAt)], ['Rejection reason', listing.rejectionReason],
            ]}/>
          </section>

          <section className={panelClass}>
            <h2 className="text-lg font-semibold">Seller verification & ownership</h2>
            <Details values={[
              ['Business name', detail.seller?.businessName],
              ['Display name', detail.seller?.displayName],
              ['Seller code', detail.seller?.sellerCode],
              ['Seller status', detail.seller?.status],
              ['Seller approval', detail.seller?.approvalStatus],
              ['Seller verification', detail.seller?.verificationStatus],
            ]}/>
          </section>

          <section className={panelClass}>
            <h2 className="text-lg font-semibold">Inventory allocations and fulfillment</h2>
            {detail.inventoryLocations.length ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[670px] text-left text-sm">
                  <thead className="bg-slate-100"><tr>
                    <th scope="col" className="px-3 py-2">Location</th>
                    <th scope="col" className="px-3 py-2">On hand</th>
                    <th scope="col" className="px-3 py-2">Reserved</th>
                    <th scope="col" className="px-3 py-2">Safety stock</th>
                    <th scope="col" className="px-3 py-2">Availability</th>
                    <th scope="col" className="px-3 py-2">Online fulfillment</th>
                  </tr></thead>
                  <tbody>{detail.inventoryLocations.map(item => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <th scope="row" className="px-3 py-2 font-medium">
                        {item.location.name} <span className="block text-xs text-slate-500">
                          {item.location.code} · {show(item.location.addressText)}
                        </span>
                      </th>
                      <td className="px-3 py-2">{item.quantityOnHand}</td>
                      <td className="px-3 py-2">{item.quantityReserved}</td>
                      <td className="px-3 py-2">{item.safetyStock}</td>
                      <td className="px-3 py-2">{item.availabilityStatus}</td>
                      <td className="px-3 py-2">{item.location.onlineFulfillmentEnabled ? 'Enabled' : 'Disabled'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-amber-800">No Inventory allocations are attached to this Listing.</p>}
          </section>

          <ArticleReview article={detail.article} heading="Current Product Article · identifiers, attributes and vehicle fitments"/>

          {revision ? (
            <section className={panelClass}>
              <h2 className="text-lg font-semibold">Pending proposed changes</h2>
              <p className="text-sm text-amber-800" role="status">
                Review the proposed values against the currently published Listing. The live version remains unchanged until approval.
              </p>
              <Details values={[
                ['Revision ID', revision.id],
                ['Source version', revision.sourceVersion],
                ['Submitted', formatDate(revision.createdAt)],
                ['Proposed Article ID', revision.proposedProductId],
              ]}/>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[480px] text-sm text-left">
                  <thead className="bg-slate-100"><tr>
                    <th scope="col" className="px-3 py-2">Field</th>
                    <th scope="col" className="px-3 py-2">Published</th>
                    <th scope="col" className="px-3 py-2">Proposed</th>
                  </tr></thead>
                  <tbody>{Object.entries(revision.changes && typeof revision.changes === 'object' &&
                    !Array.isArray(revision.changes) ? revision.changes : {}).map(([field, proposed]) => (
                    <tr className="border-t border-slate-200" key={field}>
                      <th scope="row" className="px-3 py-2">{field}</th>
                      <td className="px-3 py-2">{show((listing as unknown as Record<string, unknown>)[field])}</td>
                      <td className="px-3 py-2 font-medium">{show(proposed)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          ) : null}
          {detail.proposedArticle
            ? <ArticleReview article={detail.proposedArticle}
                heading="Proposed Product Article · review complete technical identity"/>
            : null}

          <section className={panelClass}>
            <h2 className="text-lg font-semibold">Images and documents</h2>
            <p className="text-sm text-slate-600">
              Review Seller-specific verified media, image order and the primary image.
              Images belong to the Listing, not its shared Product Article.
            </p>
            <Details values={[
              ['Verified image count', imageCount],
              ['Minimum images', imageMinimum],
              ['Maximum images', reviewedArticle?.maximumImageCount],
              ['Verified documents', documentCount],
              ['Required documents', documentMinimum],
              ['Primary image selected', detail.mediaSummary.hasPrimaryImage],
            ]}/>
            {!mediaReady ? <p role="alert" className="text-sm text-amber-800">
              The proposed Article's media policy is not satisfied. Publication must wait until the Seller corrects the media.
            </p> : null}
            <AdminListingMedia listingId={listing.id}/>
            {revision?.proposedMedia ? <AdminProposedListingMedia
              listingId={listing.id} revisionId={revision.id}
              assetIds={revision.proposedMedia.assetIds}
              assets={detail.proposedMediaAssets}
              primaryId={revision.proposedMedia.primaryId}/> : null}
          </section>

          {canReview ? (
            <section className={panelClass} aria-label="Listing publication decision">
              <h2 className="text-lg font-semibold">Admin publication decision</h2>
              {!canApprove ? <p role="alert" className="text-sm text-amber-800">
                The Article, Seller verification, or verified images are not ready for publication.
                Resolve the missing requirements first. The API performs final stock and concurrency checks.
              </p> : null}
              <label htmlFor="listing-review-reason" className="block text-sm font-medium">
                Rejection reason (required only when rejecting)
              </label>
              <textarea id="listing-review-reason" value={reason}
                onChange={event => setReason(event.target.value)}
                minLength={3} maxLength={1000} rows={3}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus-visible:outline-2 focus-visible:outline-[#a71920]"
                placeholder="Explain exactly what the Seller needs to correct."/>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={primaryAction} disabled={working || !canApprove}
                  onClick={() => void decide('approve')}>
                  {working ? 'Working…' : revision ? 'Approve Changes' : 'Approve & Publish'}
                </button>
                <button type="button" className={secondaryAction}
                  disabled={working || reason.trim().length < 3 || reason.trim().length > 1000}
                  onClick={() => void decide('reject')}>Reject with reason</button>
              </div>
            </section>
          ) : <p className="text-sm text-slate-600">
            No pending approval for this Listing. You can still inspect its full details.
          </p>}
        </>
      ) : !loading && !error ? <p role="status">Listing details are unavailable.</p> : null}
    </main>
  );
}
