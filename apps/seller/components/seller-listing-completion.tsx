'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getJson, postJson } from '@/lib/client-api';
import type { SellerListingArticleDetails, SellerListingRow } from '@/lib/seller-stock-contracts';
import { listingMediaIssues, type ListingMediaReadiness } from '@/lib/seller-listing-readiness';
import { SellerListingMedia } from './seller-listing-media';
import { SellerListingEditor } from './seller-listing-editor';

/**
 * Final stage of the same-page creation flow. The Article/Inventory/Listing
 * Draft is already committed before any R2 upload starts. Uploads are
 * independent, verified operations; failed files can be retried without
 * losing the private Draft. The authenticated API decides publication.
 */
export function SellerListingCompletion({
  listingId, onSubmitted, onSaveDraft, onBlockingChange,
}: {
  listingId: string;
  onSubmitted: (result: SellerListingRow) => Promise<void> | void;
  onSaveDraft: () => Promise<void> | void;
  onBlockingChange?: (blocking: boolean) => void;
}) {
  const [listing, setListing] = useState<SellerListingRow | null>(null);
  const [article, setArticle] = useState<SellerListingArticleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [media, setMedia] = useState<ListingMediaReadiness | null>(null);
  const [mediaPending, setMediaPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const issues = listingMediaIssues(media);
  useEffect(() => {
    onBlockingChange?.(mediaPending || submitting || editOpen);
  }, [mediaPending, submitting, editOpen, onBlockingChange]);
  useEffect(() => {
    if (!mediaPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [mediaPending]);

  useEffect(() => {
    let active = true;
    const path = `/api/seller/listings/${encodeURIComponent(listingId)}`;
    void Promise.all([
      getJson<SellerListingRow>(path),
      getJson<SellerListingArticleDetails>(`${path}/article-details`),
    ]).then(([saved, details]) => {
      if (!active) return;
      setListing(saved);
      setArticle(details);
    }).catch(cause => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load the saved Draft. Refresh to retry.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId]);

  async function submit() {
    if (submitting || submitted || mediaPending || editOpen) return;
    setError('');
    setNotice('');
    if (issues.length) {
      setError(issues.join(' '));
      document.getElementById('seller-listing-media')?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      });
      return;
    }
    setSubmitting(true);
    let outcome: SellerListingRow;
    try {
      outcome = await postJson<SellerListingRow>(
        `/api/seller/listings/${encodeURIComponent(listingId)}/finish`, {},
      );
      // A pending Seller Article may leave Listing in DRAFT with reviewIntent.
      if (outcome.status !== 'SUBMITTED' && !outcome.reviewIntent) {
        setError('The Listing remains a Draft. Complete the required product information and try again.');
        return;
      }
      setSubmitted(true);
      setNotice(outcome.status === 'SUBMITTED'
        ? 'Your Listing has been submitted for Admin review.'
        : 'Your Listing is saved. Article verification is pending; Listing review will follow automatically.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Listing could not be submitted. Your private Draft remains saved.');
      return;
    } finally {
      setSubmitting(false);
    }
    try {
      await onSubmitted(outcome);
    } catch {
      setError('Submission was recorded, but the Listing list could not refresh. Reload My Listings.');
    }
  }

  return (
    <section aria-label="Complete product Listing" className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Private Draft saved</p>
        <h3 className="mt-1 text-lg font-semibold text-emerald-950">Finish your Listing here</h3>
        <p className="mt-1 text-sm text-emerald-900">
          Product information, selling terms and Inventory are saved. Add the required photos
          and documents below; you do not need to open another screen.
        </p>
      </div>
      {loadError ? <p role="alert" className="text-sm text-red-800">
        {loadError} <Link className="underline" href={`/listings/${encodeURIComponent(listingId)}`}>Open saved Draft</Link>
      </p> : null}
      <section aria-label="Listing preview" className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Preview your Listing</h3>
        {loading ? <p role="status" className="mt-2 text-sm text-slate-600">Loading saved Listing summary…</p> : (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-medium text-slate-600">Product</dt>
              <dd className="font-semibold">{listing?.sellerTitle || article?.name || 'Saved product'}</dd></div>
            <div><dt className="font-medium text-slate-600">SKU</dt><dd>{listing?.sellerSku ?? '—'}</dd></div>
            <div><dt className="font-medium text-slate-600">Product Type / brand</dt>
              <dd>{article?.productType?.name ?? '—'} · {article?.brand?.name ?? '—'}</dd></div>
            <div><dt className="font-medium text-slate-600">Selling price</dt>
              <dd>{listing?.price ? `${listing.price.sellingPrice} ${listing.price.currency}` : 'Not provided'}
                {listing?.price?.promotionalPrice != null
                  ? <span className="ml-2 font-semibold text-emerald-800">
                    Offer: {listing.price.promotionalPrice} {listing.price.currency}
                  </span> : null}
              </dd></div>
            <div><dt className="font-medium text-slate-600">Stock on hand</dt>
              <dd>{listing?.quantityOnHand ?? '—'}</dd></div>
            <div><dt className="font-medium text-slate-600">Compatible vehicles</dt>
              <dd>{article?.compatibilities.length ?? '—'} configurations</dd></div>
          </dl>
        )}
        <p className="mt-3 text-xs text-slate-600">
          Product identity and technical specifications come from the linked Article.
          Changes to this Listing do not edit shared reference data.
        </p>
      </section>
      <section aria-label="Edit saved Listing details" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Product, selling &amp; packaging details</h3>
            <p className="text-sm text-slate-600">
              Need to correct a detail? Update the same saved Draft here before uploading or submitting.
            </p>
          </div>
          <button type="button" disabled={submitted || submitting || loading || !listing || !article || mediaPending}
            aria-expanded={editOpen} aria-controls="seller-listing-inline-editor"
            onClick={() => setEditOpen(value => !value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {editOpen ? 'Close details editor' : 'Edit saved details'}
          </button>
        </div>
        {editOpen && listing && article ? (
          <div id="seller-listing-inline-editor">
            <SellerListingEditor key={`${listing.id}-${listing.version}`}
              listing={listing} article={article} inline showMedia={false}
              onClose={() => setEditOpen(false)}
              onDone={async () => {
                const base = `/api/seller/listings/${encodeURIComponent(listingId)}`;
                const [saved, details] = await Promise.all([
                  getJson<SellerListingRow>(base),
                  getJson<SellerListingArticleDetails>(`${base}/article-details`),
                ]);
                setListing(saved); setArticle(details); setEditOpen(false);
                setNotice('Draft details updated. Continue with images and final submission.');
              }}/>
          </div>
        ) : null}
      </section>
      <div id="seller-listing-media" className="scroll-mt-6">
        <SellerListingMedia listingId={listingId}
          readOnly={submitted || submitting}
          onPendingChange={setMediaPending}
          onReadinessChange={setMedia}/>
      </div>
      <section aria-label="Review and submit" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Review and submit</h3>
          <span className="text-xs font-medium text-slate-700">
            {media?.complete && !mediaPending ? 'Photos ready' : 'Check required photos'}
          </span>
        </div>
        {issues.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          {issues.map(item => <li key={item}>{item}</li>)}
        </ul> : <p role="status" className="text-sm text-emerald-900">
          Image and document requirements satisfied. The server will verify all remaining Product Type rules.
        </p>}
        {editOpen ? <p role="status" className="text-sm text-amber-900">
          Save or close the details editor before submitting.
        </p> : null}
        {mediaPending ? <p role="status" className="text-sm text-amber-900">
          Upload or remove the queued files before submitting.
        </p> : null}
        {error ? <p role="alert" className="text-sm font-medium text-red-800">{error}</p> : null}
        {notice ? <p role="status" className="text-sm text-emerald-900">{notice}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={submitting || mediaPending || editOpen}
            onClick={() => { if (!submitted) void onSaveDraft(); }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            Save Draft &amp; return to My Listings
          </button>
          <button type="button" disabled={submitting || submitted || mediaPending || loading || editOpen}
            onClick={() => void submit()}
            className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Submitting…' : submitted ? 'Submitted' : 'Submit for Admin review'}
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Your Listing is not public until approval. Transport selections describe one selling
          unit and are not confirmed carrier assignments or multi-item shipping quotations.
        </p>
      </section>
    </section>
  );
}
