'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClientApiError, getJson, postJson } from '@/lib/client-api';
import type { SellerListingRow, SellerProductRow } from '@/lib/seller-stock-contracts';
import {
  firstListingLocation, inventoryListingPayload, validateInventoryListing,
  type InventoryListingDetails, type SellerOfferRequirements,
} from '@/lib/seller-inventory-listing';
import { ReactSelect } from './common/react-select';

const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]';
const buttonClass = 'rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:cursor-not-allowed disabled:opacity-50';

export function SellerListProductModal({
  product, onClose, onSaved,
}: {
  product: SellerProductRow;
  onClose: () => void;
  onSaved: (listing: SellerListingRow) => Promise<void>;
}) {
  const [details, setDetails] = useState<InventoryListingDetails>({
    locationId: firstListingLocation(product),
    title: product.name,
    sellingPrice: '',
    description: '',
    warranty: '',
    delivery: '',
  });
  const [requirements, setRequirements] = useState<SellerOfferRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saveError, setSaveError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  closeRef.current = onClose;
  savingRef.current = saving;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setRequirements(null);
    if (!product.productId) {
      setLoadError('Link this Inventory SKU to an Article before listing it.');
      setLoading(false);
      return () => { active = false; };
    }
    getJson<SellerOfferRequirements>(
      `/api/seller/entry/offer-requirements/${product.productId}`,
    ).then(value => {
      if (active) setRequirements(value);
    }).catch(cause => {
      if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load the published selling requirements.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [product.productId, retry]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const focusedBeforeOpening = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const background = document.querySelector('main');
    const wasInert = background?.hasAttribute('inert') ?? false;
    background?.setAttribute('inert', '');
    const overflowBeforeOpening = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    initialFocusRef.current?.focus();

    function handleKeys(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!savingRef.current) closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter(element => element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeys);
    return () => {
      document.removeEventListener('keydown', handleKeys);
      document.body.style.overflow = overflowBeforeOpening;
      if (!wasInert) background?.removeAttribute('inert');
      if (focusedBeforeOpening?.isConnected) focusedBeforeOpening.focus();
      else document.getElementById('seller-product-listings-heading')?.focus();
    };
  }, [mounted]);

  const validationError = validateInventoryListing(product, details, requirements);
  const selectedStock = product.inventories.find(row => row.locationId === details.locationId);

  function change<K extends keyof InventoryListingDetails>(key: K, value: InventoryListingDetails[K]) {
    setSaveError('');
    setDetails(previous => ({ ...previous, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || !requirements) return;
    const failure = validateInventoryListing(product, details, requirements);
    if (failure) { setSaveError(failure); return; }
    setSaving(true);
    savingRef.current = true;
    setSaveError('');
    try {
      const result = await postJson<{ record: SellerListingRow }>('/api/seller/entry',
        inventoryListingPayload(product, details, requirements));
      await onSaved(result.record);
    } catch (cause) {
      setSaveError(cause instanceof ClientApiError || cause instanceof Error
        ? cause.message : 'Could not create the Draft Listing. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-3 py-4 sm:px-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-list-product-heading"
        aria-describedby="seller-list-product-description"
        className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="seller-list-product-heading" className="text-xl font-semibold text-slate-950">List Product</h2>
            <p id="seller-list-product-description" className="mt-1 text-sm text-slate-600">
              Prepare a Draft Listing from existing Inventory. Stock stays in Inventory and publication still requires Admin approval.
            </p>
          </div>
          <button type="button" disabled={saving} onClick={onClose}
            aria-label="Close List Product dialog"
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#a71920] disabled:opacity-50">
            ✕
          </button>
        </div>
        <form onSubmit={save} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="block text-xs text-slate-500">Product Article</span><strong className="text-slate-900">{product.name}</strong></div>
              <div><span className="block text-xs text-slate-500">Inventory SKU</span><strong>{product.sku}</strong></div>
              <div><span className="block text-xs text-slate-500">Condition / package</span>
                <span>{product.condition ?? 'Not specified'} · {product.packageQuantity} {product.packageUnit}</span></div>
              <div><span className="block text-xs text-slate-500">Stock on hand / online available</span><span>{product.totalOnHand} / {product.onlineAvailable}</span></div>
            </div>

            {loading ? <p role="status" className="text-sm text-slate-600">Loading published Product Type selling requirements…</p> : null}
            {loadError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {loadError}
                {product.productId ? <button type="button" className="ml-2 font-semibold underline"
                  onClick={() => setRetry(previous => previous + 1)}>Retry</button> : null}
              </div>
            ) : null}

            <ReactSelect
              label="Stock Location *"
              value={details.locationId}
              isDisabled={saving}
              isClearable={false}
              options={product.inventories.map(row => ({
                value: row.locationId,
                label: `${row.location.name} · ${row.quantityAvailable} available${row.location.onlineFulfillmentEnabled ? '' : ' · Online fulfillment disabled'}`,
              }))}
              onChange={option => change('locationId', String(option?.value ?? ''))}
            />
            {selectedStock && !selectedStock.location.onlineFulfillmentEnabled ? (
              <p className="text-sm text-amber-900" role="status">
                Online fulfillment is disabled at this Location. The Listing can be saved as Draft, but the Location needs to be eligible before selling online.
              </p>
            ) : null}

            <label className="block text-sm font-medium text-slate-800">Listing title *
              <input ref={initialFocusRef} className={fieldClass} required minLength={2} maxLength={180}
                value={details.title} disabled={saving}
                onChange={event => change('title', event.target.value)}/>
            </label>
            {requirements?.price !== 'NOT_APPLICABLE' ? (
              <label className="block text-sm font-medium text-slate-800">Selling price (ETB) *
                <input className={fieldClass} type="number" inputMode="decimal" min="0.01" step="0.01" required
                  disabled={saving} value={details.sellingPrice}
                  onChange={event => change('sellingPrice', event.target.value)}/>
              </label>
            ) : null}
            {requirements?.warranty !== 'NOT_APPLICABLE' ? (
              <label className="block text-sm font-medium text-slate-800">
                Warranty information{requirements?.warranty === 'REQUIRED' ? ' *' : ''}
                <textarea className={fieldClass} maxLength={5000} rows={2}
                  required={requirements?.warranty === 'REQUIRED'} disabled={saving}
                  value={details.warranty} onChange={event => change('warranty', event.target.value)}/>
              </label>
            ) : null}
            <label className="block text-sm font-medium text-slate-800">Delivery information
              <textarea className={fieldClass} maxLength={5000} rows={2} disabled={saving}
                value={details.delivery} onChange={event => change('delivery', event.target.value)}/>
            </label>
            <label className="block text-sm font-medium text-slate-800">Listing description
              <textarea className={fieldClass} maxLength={5000} rows={3} disabled={saving}
                value={details.description} onChange={event => change('description', event.target.value)}/>
            </label>
          </div>

          <div className="shrink-0 space-y-3 border-t border-slate-200 bg-white px-5 py-4">
            {saveError ? <p role="alert" className="text-sm text-red-800">{saveError}</p> : null}
            {validationError && !loading && !loadError ? (
              <p role="status" className="text-sm text-amber-800">{validationError}</p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={saving} onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-[#a71920] disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || loading || Boolean(loadError) || Boolean(validationError)} className={buttonClass}>
                {saving ? 'Saving Draft…' : 'Continue to Listing images'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
