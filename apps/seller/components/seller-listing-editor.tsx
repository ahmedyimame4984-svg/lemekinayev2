'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ClientApiError, getJson, patchJson, postJson } from '@/lib/client-api';
import type { SellerOfferRequirements } from '@/lib/seller-inventory-listing';
import type { SellerListingArticleDetails, SellerListingRow, SellerArticleSearchResult } from '@/lib/seller-stock-contracts';
import { emptyInlineSellerArticle, inlineEntryArticlePayload, type InlineSellerArticle } from '@/lib/seller-inline-article';
import { SellerInlineArticleFields } from './seller-inline-article-fields';
import { SellerVehicleConfigurationPicker } from './seller-vehicle-configuration-picker';
import { SellerWorkspaceArticlePicker } from './seller-workspace-article-picker';
import { SellerListingMedia, type ProposedMediaSelection } from './seller-listing-media';

type SaveResult = {
  listingId: string;
  version: number;
  status: 'UNCHANGED' | 'APPLIED' | 'PRICE_UPDATED' | 'PENDING_REVIEW';
  articleId: string;
  proposedArticleId?: string;
  newArticle?: boolean;
  articleReview?: 'SUBMITTED' | 'NEEDS_ATTENTION';
  articleReviewMessage?: string;
};

function initialProductValues(details: SellerListingArticleDetails | null): InlineSellerArticle {
  if (!details) return emptyInlineSellerArticle;
  const mpn = details.partNumbers.find(item => item.type === 'MANUFACTURER');
  const oe = details.partNumbers.find(item => item.type === 'OE');
  const cross = details.partNumbers.find(item => item.type === 'CROSS_REFERENCE');
  const gtin = details.articleIdentifiers.find(item => item.type.startsWith('GTIN_'));
  const values = Object.fromEntries(details.attributeValues.map(row => [
    row.attribute.code,
    row.valueString ?? (row.valueNumeric === null ? null : Number(row.valueNumeric)) ?? row.valueBoolean ?? row.valueReferenceId ?? row.valueJson,
  ]));
  return {
    productTypeId: details.productTypeId,
    brandId: details.brandId ?? '',
    manufacturerPartNumber: mpn?.partNumber ?? '',
    duplicateReviewReason: '',
    values,
    identifiers: {
      gtinType: (gtin?.type as InlineSellerArticle['identifiers']['gtinType']) ?? 'GTIN_13',
      gtin: gtin?.value ?? '',
      oeReference: oe?.partNumber ?? '',
      crossReference: cross?.partNumber ?? '',
      issuerBrandId: oe?.issuerBrandId ?? cross?.issuerBrandId ?? '',
    },
  };
}

export function SellerListingEditor({
  listing, article, onDone, onClose,
}: {
  listing: SellerListingRow;
  article: SellerListingArticleDetails | null;
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(listing.sellerDescription ?? '');
  const [warranty, setWarranty] = useState(listing.warrantyInformation ?? '');
  const [delivery, setDelivery] = useState(listing.deliveryInformation ?? '');
  const [title, setTitle] = useState(listing.sellerTitle ?? '');
  const [price, setPrice] = useState(String(listing.price?.sellingPrice ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(listing.version);
  const [offerRules, setOfferRules] = useState<SellerOfferRequirements | null>(null);
  const [mediaPending, setMediaPending] = useState(false);
  const [mediaSelection, setMediaSelection] = useState<ProposedMediaSelection | null>(null);
  const [mode, setMode] = useState<'keep' | 'existing' | 'new'>('keep');
  const [selected, setSelected] = useState<SellerArticleSearchResult | null>(null);
  const [product, setProduct] = useState<InlineSellerArticle>(() => initialProductValues(article));
  const [fitmentIds, setFitmentIds] = useState<string[]>(() =>
    article?.compatibilities.map(row => row.vehicleConfigurationId).filter((id): id is string => !!id) ?? []);
  const [articleReady, setArticleReady] = useState(false);
  const [fitmentRequired, setFitmentRequired] = useState(false);
  const [fitmentApplicable, setFitmentApplicable] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [pendingError, setPendingError] = useState('');

  useEffect(() => {
    if (mode !== 'keep' || !article) return;
    setProduct(initialProductValues(article));
    setFitmentIds(article.compatibilities.map(row => row.vehicleConfigurationId).filter((id): id is string => !!id));
  }, [article, mode]);

  const reloadPending = useCallback(async () => {
    try {
      const pending = await getJson<{ revision: { id: string } | null }>(
        `/api/seller/listings/${encodeURIComponent(listing.id)}/pending-edit`,
      );
      setPendingReview(Boolean(pending.revision));
    } catch (cause) {
      setPendingError(cause instanceof Error ? cause.message : 'Could not check pending changes.');
    }
  }, [listing.id]);

  useEffect(() => {
    void reloadPending();
  }, [reloadPending]);

  useEffect(() => {
    let active = true;
    void getJson<SellerOfferRequirements>(
      `/api/seller/entry/offer-requirements/${listing.productId}`,
    ).then(value => { if (active) setOfferRules(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load Product Type rules.'); });
    return () => { active = false; };
  }, [listing.productId]);

  async function saveChanges(): Promise<SaveResult> {
    if (mode === 'new' && (!articleReady ||
      (fitmentRequired && fitmentIds.length === 0) ||
      (!fitmentApplicable && fitmentIds.length > 0))) {
      throw new Error('Complete the required product fields and vehicle configurations.');
    }
    if (mode === 'existing' && !selected) throw new Error('Select an existing approved product.');
    if (offerRules?.warranty === 'REQUIRED' && !warranty.trim()) {
      throw new Error('Warranty information is required for this Product Type.');
    }
    const amount = price.trim() ? Number(price) : null;
    const priceChanged = price.trim() !== String(listing.price?.sellingPrice ?? '');
    if (priceChanged && (amount === null || !/^\d+(?:\.\d{1,2})?$/u.test(price.trim()) || amount <= 0)) {
      throw new Error('Enter a positive selling price with at most two decimal places.');
    }
    const body = {
      version,
      sellerTitle: title.trim() || null,
      sellerDescription: description.trim() || null,
      ...(offerRules?.warranty !== 'NOT_APPLICABLE' ? { warrantyInformation: warranty.trim() || null } : {}),
      deliveryInformation: delivery.trim() || null,
      ...(priceChanged && amount !== null
        ? { sellingPrice: amount, ...(listing.price ? { priceVersion: listing.price.version } : {}) } : {}),
      ...(mediaSelection?.changed && !['DRAFT', 'REJECTED'].includes(listing.status) ? {
        mediaAssetIds: mediaSelection.assetIds, primaryMediaId: mediaSelection.primaryId,
      } : {}),
      ...(mode === 'existing' && selected ? { articleId: selected.id } : {}),
      ...(mode === 'new' ? {
        ...inlineEntryArticlePayload(product),
        vehicleConfigurationIds: fitmentApplicable ? fitmentIds : [],
      } : {}),
    };
    const result = await patchJson<SaveResult>(
      `/api/seller/listings/${encodeURIComponent(listing.id)}/edit`, body,
    );
    setVersion(result.version);
    return result;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mediaPending) {
      setError('Upload or remove selected Listing images before saving. Files that have not finished uploading are not part of this Listing yet.');
      return;
    }
    if (pendingReview &&
        (mode !== 'keep' ||
          title.trim() !== (listing.sellerTitle ?? '') ||
          description.trim() !== (listing.sellerDescription ?? '') ||
          warranty.trim() !== (listing.warrantyInformation ?? '') ||
          delivery.trim() !== (listing.deliveryInformation ?? ''))) {
      setError('Other changes must wait for Admin review. You can still update your selling price.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await saveChanges();
      if (result.status === 'PENDING_REVIEW') setPendingReview(true);
      if (result.articleReview === 'NEEDS_ATTENTION') {
        setError(`Listing saved. Product review still needs attention: ${result.articleReviewMessage ?? 'Complete the required product evidence.'}`);
      }
      try {
        await onDone();
        if (result.articleReview !== 'NEEDS_ATTENTION') onClose();
      } catch {
        setError('Your Listing was saved, but the details could not be refreshed. Reload to see the latest version.');
      }
    } catch (cause) {
      setError(cause instanceof ClientApiError || cause instanceof Error ? cause.message : 'Listing update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function finishCreation() {
    setBusy(true);
    setError('');
    try {
      const saved = await saveChanges();
      if (saved.articleReview === 'NEEDS_ATTENTION') {
        setError(`Listing saved. Product catalog review needs attention before final submission: ${saved.articleReviewMessage ?? 'Complete the required product evidence.'}`);
        return;
      }
      const finished = await postJson<SellerListingRow>(
        `/api/seller/listings/${encodeURIComponent(listing.id)}/finish`, {},
      );
      await onDone();
      if (finished.status === 'DRAFT' && !finished.reviewIntent) {
        setError('The Listing is still a Draft. Complete all required fields and retry.');
        return;
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Complete required fields and media before submitting.');
    } finally {
      setBusy(false);
    }
  }

  const field = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#a71920]';
  const draft = listing.status === 'DRAFT' || listing.status === 'REJECTED';

  return (
    <section aria-label="Edit Listing" className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Edit Listing · {listing.sellerSku}</h2>
        <p className="text-sm text-slate-600">Edit the product and selling details together. Product matching happens automatically when you save.</p>
        {!draft ? <p className="text-sm text-amber-800" role="status">
          Price changes take effect immediately. Other changes and the complete proposed image set go to Admin review while published content remains live.
        </p> : null}
      </header>
      {pendingReview ? <p role="status" className="rounded-lg border border-amber-200 p-3 text-sm text-amber-800">
        Your updated details are awaiting Admin review. The current approved Listing remains visible to buyers.
      </p> : null}
      {pendingError ? <p role="alert" className="text-sm text-red-800">{pendingError}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      <form onSubmit={save} className="space-y-5">
        <fieldset className="space-y-3" disabled={busy || pendingReview}>
          <legend className="text-base font-semibold">Product information</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['keep', 'Keep product details'],
              ['existing', 'Select existing product'],
              ['new', 'Update product details'],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <input type="radio" name="productMode" checked={mode === value}
                  onChange={() => setMode(value)} disabled={busy || pendingReview} />
                {label}
              </label>
            ))}
          </div>
          {mode === 'existing' ? (
            <SellerWorkspaceArticlePicker article={selected} onChange={setSelected}/>
          ) : null}
          {mode === 'new' ? (
            <div className="space-y-4">
              <SellerInlineArticleFields value={product} onChange={setProduct}
                onReadyChange={setArticleReady}
                onFitmentRequiredChange={setFitmentRequired}
                onFitmentApplicableChange={setFitmentApplicable}
                onOfferRequirementsChange={setOfferRules}
                disabled={busy || pendingReview} />
              {fitmentApplicable ? <SellerVehicleConfigurationPicker
                value={fitmentIds} onChange={setFitmentIds}
                required={fitmentRequired} disabled={busy || pendingReview}/> : null}
              <p className="text-xs text-slate-600">
                Saving a different identity creates a Draft for catalog review rather than changing a product used by other Sellers.
              </p>
            </div>
          ) : null}
        </fieldset>
          <label className="block text-sm font-medium">Selling price ({listing.price?.currency ?? 'ETB'})
            <input className={field} type="number" inputMode="decimal"
              min="0.01" step="0.01" value={price}
              onChange={event => setPrice(event.target.value)}/>
          </label>
        <p className="text-xs text-slate-600">
          Condition belongs to the physical Inventory SKU, and stock changes require an audited Inventory movement.
          To change condition, create a separate Inventory SKU for that physical condition.
        </p>
        <fieldset className="space-y-3" disabled={busy || pendingReview}>
          <legend className="text-base font-semibold">Selling information</legend>
          <label className="block text-sm font-medium">Listing title
            <input className={field} minLength={2} maxLength={180}
              value={title} onChange={event => setTitle(event.target.value)}/>
          </label>
          <label className="block text-sm font-medium">Description
            <textarea className={field} maxLength={5000} rows={3}
              value={description} onChange={event => setDescription(event.target.value)}/>
          </label>
          {offerRules?.warranty !== 'NOT_APPLICABLE' ? (
            <label className="block text-sm font-medium">
              Warranty information{offerRules?.warranty === 'REQUIRED' ? ' *' : ''}
              <textarea className={field} maxLength={5000} rows={2}
                required={offerRules?.warranty === 'REQUIRED'}
                value={warranty} onChange={event => setWarranty(event.target.value)}/>
            </label>
          ) : null}
          <label className="block text-sm font-medium">Delivery information
            <textarea className={field} maxLength={5000} rows={2}
              value={delivery} onChange={event => setDelivery(event.target.value)}/>
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !article || (pendingReview && price.trim() === String(listing.price?.sellingPrice ?? ''))}
            className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save Listing'}
          </button>
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold focus-visible:outline-2">
            Close
          </button>
        </div>
      </form>
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Listing photos and documents</h3>
        <SellerListingMedia listingId={listing.id}
          reviewMode={!draft}
          readOnly={busy || pendingReview}
          onSelectionChange={setMediaSelection}
          onPendingChange={setMediaPending}/>
        {draft ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void finishCreation()}
              disabled={busy || !offerRules || mediaPending || pendingReview || !article}
              className="rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 disabled:opacity-50">
              {busy ? 'Submitting…' : 'Submit Listing for review'}
            </button>
            {listing.reviewIntent ? <p role="status" className="text-sm text-amber-800">
              Waiting for product approval; review starts automatically when eligible.
            </p> : <p className="text-sm text-slate-600">
              Required images and fields are verified before Listing review.
            </p>}
          </div>
        ) : null}
      </div>
    </section>
  );
}
