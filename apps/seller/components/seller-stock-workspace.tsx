'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import type {
  SellerArticleSearchResult,
  SellerInventoryLocation,
  SellerListingRow,
  SellerProductRow,
} from '@/lib/seller-stock-contracts';
import { ReactSelect } from './common/react-select';
import { SellerWorkspaceArticlePicker } from './seller-workspace-article-picker';
import { SellerInlineArticleFields } from './seller-inline-article-fields';
import { SellerVehicleConfigurationPicker } from './seller-vehicle-configuration-picker';
import { emptyInlineSellerArticle, inlineEntryArticlePayload, type InlineSellerArticle } from '@/lib/seller-inline-article';
import { SellerStockTransferPanel } from './seller-stock-transfer-panel';
import { SellerLocationsPanel } from './seller-locations-panel';
import { SellerListingEditor } from './seller-listing-editor';
import { SellerListProductModal } from './seller-list-product-modal';
import { SellerListingCommercialFields } from './seller-listing-commercial-fields';
import type { SellerCommercialDetails } from '@/lib/seller-commercial';
import { validateSellerCommercial, DEFAULT_SELLER_COMMERCIAL_POLICY } from '@/lib/seller-commercial';
import { SellerArticleWorkspace } from './seller-article-workspace';
import { SellerProductDraftCorrections } from './seller-product-draft-corrections';
import { validateSellerInventoryEntry } from '@/lib/seller-inventory-entry';
import type { SellerOfferRequirements } from '@/lib/seller-inventory-listing';
import { SellerRecordsTable } from './seller-records-table';
import { productMatchIssue, resolveSellerProductTab, type SellerProductTab } from '@/lib/seller-product-journey';

type SellerEntrySelection = {
  articleId?: string;
  article?: ReturnType<typeof inlineEntryArticlePayload>['article'];
  identifiers?: ReturnType<typeof inlineEntryArticlePayload>['identifiers'];
};

type FormMode = 'product' | 'listing-from-product' | null;

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#a71920]';
const primaryClass = 'rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:opacity-50';
const secondaryClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-[#a71920] disabled:opacity-50';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load your Seller workspace. Try again.');
  return response.json() as Promise<T>;
}

function friendlyError(error: unknown) {
  return error instanceof ClientApiError || error instanceof Error
    ? error.message : 'This request could not be completed.';
}

export function SellerStockWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<SellerProductTab>(
    resolveSellerProductTab(searchParams.get('tab')),
  );
  useEffect(() => { setTab(resolveSellerProductTab(searchParams.get('tab'))); }, [searchParams]);
  const [products, setProducts] = useState<SellerProductRow[]>([]);
  const [locations, setLocations] = useState<SellerInventoryLocation[]>([]);
  const [listings, setListings] = useState<SellerListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<FormMode>(null);
  const [entryStep, setEntryStep] = useState<'find' | 'details'>('find');
  const [selectedProduct, setSelectedProduct] = useState<SellerProductRow | null>(null);
  const [locationId, setLocationId] = useState('');
  const [article, setArticle] = useState<SellerArticleSearchResult | null>(null);
  const [matchConfirmed, setMatchConfirmed] = useState(false);
  const [preparedArticle, setPreparedArticle] = useState<SellerArticleSearchResult | null>(null);
  const [articleSource, setArticleSource] = useState<'existing' | 'new'>('existing');
  const [inlineArticle, setInlineArticle] = useState<InlineSellerArticle>(emptyInlineSellerArticle);
  const [inlineArticleReady, setInlineArticleReady] = useState(false);
  const [fitmentRequired, setFitmentRequired] = useState(false);
  const [fitmentApplicable, setFitmentApplicable] = useState(false);
  const [offerRules, setOfferRules] = useState<SellerOfferRequirements | null>(null);
  const [vehicleConfigurationIds, setVehicleConfigurationIds] = useState<string[]>([]);
  const entrySkuRef = useRef('');
  const [articleTableRevision, setArticleTableRevision] = useState(0);
  const formTitleRef = useRef<HTMLHeadingElement>(null);
  const articleEditorRef = useRef<HTMLElement>(null);
  const [articleCreatorOpen, setArticleCreatorOpen] = useState(false);
  const [articleToResume, setArticleToResume] = useState<string | null>(null);
  const [condition, setCondition] = useState('NEW');
  const [packageQuantity, setPackageQuantity] = useState('1');
  const [customSku, setCustomSku] = useState('');
  const [openingQuantity, setOpeningQuantity] = useState('0');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [warranty, setWarranty] = useState('');
  const [delivery, setDelivery] = useState('');
  const [commercialDetails, setCommercialDetails] = useState<SellerCommercialDetails>({});
  const [stockProduct, setStockProduct] = useState<SellerProductRow | null>(null);
  const [transferProduct, setTransferProduct] = useState<SellerProductRow | null>(null);
  const [stockLocationId, setStockLocationId] = useState('');
  const [stockDelta, setStockDelta] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [editListing, setEditListing] = useState<SellerListingRow | null>(null);
  const [listingProduct, setListingProduct] = useState<SellerProductRow | null>(null);
  const [priceListing, setPriceListing] = useState<SellerListingRow | null>(null);
  const [updatedPrice, setUpdatedPrice] = useState('');

  const load = useCallback(async () => {
    const [productData, locationData, listingData] = await Promise.all([
      getJson<SellerProductRow[]>('/api/seller/products'),
      getJson<SellerInventoryLocation[]>('/api/seller/locations'),
      getJson<SellerListingRow[]>('/api/seller/listings'),
    ]);
    setProducts(productData);
    setLocations(locationData);
    setListings(listingData);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    void load().catch(error => {
      if (mounted) {
        setError(friendlyError(error));
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [load]);

  useEffect(() => { if (mode) formTitleRef.current?.focus(); }, [mode, entryStep]);

  const draftProductId = searchParams.get('draftProductId');
  useEffect(() => {
    // Draft edit links from Listing details reuse the ownership-checked editor.
    if (!draftProductId || !/^[a-f0-9-]{36}$/i.test(draftProductId)) return;
    setArticleToResume(draftProductId);
    setArticleCreatorOpen(true);
    setTab('listing');
  }, [draftProductId]);

  useEffect(() => {
    if (articleCreatorOpen && articleToResume) articleEditorRef.current?.focus();
  }, [articleCreatorOpen, articleToResume]);

  const defaultLocation = useMemo(
    () => locations.find(item => item.isDefault) ?? null,
    [locations],
  );
  const matchingInventory = useMemo(
    () => article ? products.filter(product => product.productId === article.id) : [],
    [article, products],
  );
  const locationOptions = locations.map(item => ({
    value: item.id,
    label: `${item.name}${item.isDefault ? ' (Default)' : ''}`,
  }));

  useEffect(() => {
    if (mode !== 'listing-from-product' ||
        (articleSource !== 'existing' && !selectedProduct?.productId)) return;
    const articleId = selectedProduct?.productId ?? article?.id;
    if (!articleId) { setOfferRules(null); return; }
    let active = true;
    setOfferRules(null);
    void getJson<SellerOfferRequirements>(
      `/api/seller/entry/offer-requirements/${articleId}`,
    ).then(rules => { if (active) setOfferRules(rules); })
      .catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [mode, articleSource, selectedProduct?.productId, article?.id]);

  function resetForm() {
    setSelectedProduct(null);
    setArticle(null);
    setMatchConfirmed(false);
    setCondition('NEW');
    setPackageQuantity('1');
    setCustomSku('');
    setOpeningQuantity('0');
    setPrice('');
    setDescription('');
    setWarranty('');
    setDelivery('');
    setCommercialDetails({});
    setMode(null);
    setArticleSource('existing');
    setEntryStep('find');
    setInlineArticle(emptyInlineSellerArticle);
    setInlineArticleReady(false);
    setFitmentRequired(false);
    setFitmentApplicable(false);
    setOfferRules(null);
    setVehicleConfigurationIds([]);
    entrySkuRef.current = '';
  }

  function openProductForm(storeId?: string, selectedArticle?: SellerArticleSearchResult) {
    resetForm();
    setError('');
    setNotice('');
    setArticle(selectedArticle ?? null);
    setArticleSource('existing');
    setMode('product');
    setLocationId(storeId ?? defaultLocation?.id ?? '');
    setTab('inventory');
  }

  function receiveExistingArticleStock(product: SellerProductRow) {
    resetForm();
    setTab('inventory');
    setStockProduct(product);
    setStockLocationId(product.inventories[0]?.locationId ?? defaultLocation?.id ?? '');
    setStockDelta('');
    setStockReason('');
  }

  function openListingForm(product?: SellerProductRow, storeId?: string, initialProduct?: SellerArticleSearchResult) {
    resetForm();
    setError('');
    setNotice('');
    setSelectedProduct(product ?? null);
    setArticle(initialProduct ?? null);
    setArticleSource('existing');
    setEntryStep(product ? 'details' : initialProduct ? 'details' : 'find');
    setCondition(product?.condition ?? 'NEW');
    setPackageQuantity(String(product?.packageQuantity ?? 1));
    setLocationId(storeId ?? defaultLocation?.id ?? '');
    setMode('listing-from-product');
    setTab('listing');
  }

  function listInventoryProduct(product: SellerProductRow) {
    if (product.listing || !product.productId) return;
    resetForm();
    setError('');
    setNotice('');
    setStockProduct(null);
    setListingProduct(product);
  }

  async function handleInventoryListed(listing: SellerListingRow) {
    setListingProduct(null);
    setTab('listing');
    router.push(`/listings/${encodeURIComponent(listing.id)}?manage=images`);
    setNotice(`Listing ${listing.sellerSku} prepared. Upload photos and submit for review.`);
    try {
      await load();
    } catch (error) {
      setError(`Draft Listing saved, but records could not refresh: ${friendlyError(error)}`);
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      try {
        await load();
      } catch (refreshError) {
        setError(`Save completed, but the records could not refresh: ${friendlyError(refreshError)}`);
      }
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  function continueToSellingDetails() {
    const problem = productMatchIssue({
      inventoryProductId: selectedProduct?.productId,
      source: articleSource,
      existingArticleId: article?.id,
      catalogConfirmed: matchConfirmed,
      newArticleReady: inlineArticleReady,
      fitmentRequired,
      selectedVehicleCount: vehicleConfigurationIds.length,
    });
    if (problem) { setError(problem); return; }
    setError('');
    setEntryStep('details');
  }

  function sellerEntryArticle(): SellerEntrySelection {
    if (selectedProduct?.productId) return { articleId: selectedProduct.productId };
    if (articleSource === 'existing') {
      if (!article) throw new Error('Search for and choose a matching product from the catalog.');
      return { articleId: article.id };
    }
    if (!inlineArticleReady) throw new Error('Complete the published Product Type requirements and technical attributes.');
    if (fitmentRequired && vehicleConfigurationIds.length === 0) {
      throw new Error('Select at least one configured vehicle for this Product Type.');
    }
    return inlineEntryArticlePayload(inlineArticle);
  }

  function sellerEntrySku() {
    // Seller-chosen codes remain stable across a retry; otherwise use one
    // generated code per Add Product attempt, never a new SKU on each retry.
    if (customSku.trim()) return customSku.trim().toUpperCase();
    if (!entrySkuRef.current) {
      entrySkuRef.current = `SKU-${window.crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    }
    return entrySkuRef.current;
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let selection: ReturnType<typeof sellerEntryArticle>;
    try { selection = sellerEntryArticle(); }
    catch (cause) { setError(friendlyError(cause)); return; }
    const opening = Number(openingQuantity);
    const quantity = Number(packageQuantity);
    const inventoryError = validateSellerInventoryEntry({
      productId: selection.articleId ?? inlineArticle.productTypeId,
      locationId, availableLocationIds: locations.map(item => item.id),
      packageQuantity: quantity, openingQuantity: opening,
    });
    if (inventoryError) { setError(inventoryError); return; }
    await run(async () => {
      const result = await postJson<{ articleCreated: boolean; record: SellerProductRow }>('/api/seller/entry', {
        kind: 'INVENTORY', ...selection,
        vehicleConfigurationIds, sku: sellerEntrySku(),
        condition, packageQuantity: quantity, locationId, openingQuantity: opening,
      });
      resetForm();
      setTab('inventory');
      setArticleTableRevision(current => current + (result.articleCreated ? 1 : 0));
      setNotice(`Inventory ${result.record.sku} saved. Product information ${result.articleCreated ? 'submitted as a new Draft' : 'matched to an existing product'}.`);
    });
  }

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let selection: ReturnType<typeof sellerEntryArticle>;
    try { selection = sellerEntryArticle(); }
    catch (cause) { setError(friendlyError(cause)); return; }
    if (!offerRules) { setError('Wait for Product Type selling requirements to load.'); return; }
    if (offerRules.price === 'NOT_APPLICABLE' || offerRules.stock === 'NOT_APPLICABLE') {
      setError('This Product Type cannot be listed as a priced stock-backed offer.'); return;
    }
    if (offerRules.warranty === 'REQUIRED' && !warranty.trim()) {
      setError('Warranty information is required for this Product Type.'); return;
    }
    const sellingPrice = Number(price);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      setError('Enter a positive online selling price.'); return;
    }
    const commercialError = validateSellerCommercial(commercialDetails,
      offerRules.commercial ?? DEFAULT_SELLER_COMMERCIAL_POLICY, sellingPrice);
    if (commercialError) { setError(commercialError); return; }
    const quantity = Number(packageQuantity);
    const opening = Number(openingQuantity);
    if (!selectedProduct) {
      const inventoryError = validateSellerInventoryEntry({
        productId: selection.articleId ?? inlineArticle.productTypeId,
        locationId, availableLocationIds: locations.map(item => item.id),
        packageQuantity: quantity, openingQuantity: opening,
      });
      if (inventoryError) { setError(inventoryError); return; }
    }
    await run(async () => {
      const result = await postJson<{ articleCreated: boolean; record: SellerListingRow }>('/api/seller/entry', {
        kind: 'LISTING', ...selection,
        vehicleConfigurationIds: selectedProduct ? [] : vehicleConfigurationIds,
        ...(selectedProduct ? { sellerProductId: selectedProduct.id, sku: selectedProduct.sku } :
          { sku: sellerEntrySku(), packageQuantity: quantity, openingQuantity: opening }),
        locationId,
        ...(offerRules.condition !== 'NOT_APPLICABLE' ? { condition } : {}),
        sellingPrice,
        sellerDescription: description.trim() || undefined,
        ...(offerRules.warranty !== 'NOT_APPLICABLE' && warranty.trim()
          ? { warrantyInformation: warranty.trim() } : {}),
        deliveryInformation: delivery.trim() || undefined,
        commercialDetails,
      });
      resetForm();
      setTab('listing');
      setArticleTableRevision(current => current + (result.articleCreated ? 1 : 0));
      router.push(`/listings/${encodeURIComponent(result.record.id)}?manage=images`);
    });
  }

  async function updateLocation(location: SellerInventoryLocation, change: {
    isDefault?: boolean;
    onlineFulfillmentEnabled?: boolean;
  }) {
    await run(async () => {
      await patchJson(`/api/seller/locations/${location.id}`, {
        version: location.version,
        ...change,
      });
      setNotice('Location updated.');
    });
  }

  async function moveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockProduct || !stockLocationId) return;
    await run(async () => {
      let current = stockProduct;
      let row = current.inventories.find(item => item.locationId === stockLocationId);
      if (!row) {
        current = await postJson<SellerProductRow>(
          `/api/seller/products/${current.id}/locations/${stockLocationId}`, {},
        );
        row = current.inventories.find(item => item.locationId === stockLocationId);
      }
      if (!row) throw new Error('Could not associate this stock Location.');
      await postJson(`/api/seller/products/${current.id}/stock`, {
        locationId: stockLocationId,
        delta: Number(stockDelta),
        version: row.version,
        reason: stockReason.trim(),
      });
      setStockProduct(null);
      setStockDelta('');
      setStockReason('');
      setNotice('Stock movement recorded and online availability recalculated.');
    });
  }

  async function changeListingPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priceListing?.price) return;
    await run(async () => {
      await patchJson(`/api/seller/listings/${priceListing.id}/price`, {
        listingVersion: priceListing.version,
        priceVersion: priceListing.price!.version,
        sellingPrice: Number(updatedPrice),
      });
      setPriceListing(null);
      setNotice('Central online selling price updated without new Admin approval.');
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#a71920]">Lemekinaye Seller</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">My Products</h1>
            <p className="mt-2 text-sm text-slate-600">
              Find spare parts, manage stock, and sell on the marketplace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryClass} disabled={!defaultLocation || loading || Boolean(mode)}
              onClick={() => openListingForm()}>
              Add Product
            </button>
            <Link href="/dashboard" className={secondaryClass}>Dashboard</Link>
          </div>
        </div>
        <nav aria-label="Product workspace" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {([
            ['listing', 'Listings'],
            ['inventory', 'Inventory'],
            ['locations', 'Locations'],
          ] as const).map(([key, title]) => (
            <button key={key} type="button" onClick={() => { setTab(key); resetForm(); }}
              disabled={Boolean(mode)}
              aria-pressed={tab === key}
              className={tab === key
                ? 'rounded-lg bg-[#a71920] px-4 py-2 text-sm font-semibold text-white'
                : secondaryClass}>
              {title}
            </button>
          ))}
        </nav>
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
        {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div> : null}
        {loading ? <p role="status" className="p-6 text-sm text-slate-600">Loading Seller workspace…</p> : null}
        {!loading && locations.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Create your first Store or Warehouse. It will become your Default Store automatically.
            <button type="button" onClick={() => setTab('locations')} className="ml-2 font-semibold underline">Create Location</button>
          </div>
        ) : null}

        {mode ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 ref={formTitleRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">{mode === 'product' ? 'Add Inventory' : 'Add Product'}</h2>
              <button type="button" className={secondaryClass} onClick={resetForm}>Close</button>
            </div>
            <form onSubmit={event => {
              if (entryStep === 'find') {
                event.preventDefault();
                continueToSellingDetails();
                return;
              }
              return mode === 'product' ? createProduct(event) : createListing(event);
            }} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#a71920]">
                  {entryStep === 'find' ? 'Step 1 · Find the spare part' :
                    mode === 'product' ? 'Step 2 · Record inventory' :
                      'Step 2 · Stock and selling details'}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {entryStep === 'find'
                    ? 'Search for a verified product first. If there is no match, enter the required product information.'
                    : mode === 'product'
                      ? 'Record what you have in stock. Technical product data remains linked in the background.'
                      : 'Add your quantity, selling price, and terms. Photos and approval come next.'}
                </p>
              </div>
              {entryStep === 'find' ? (
                <>
                  {selectedProduct?.productId ? (
                    <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                      <strong>Existing stock: {selectedProduct.sku}</strong>
                      <p className="text-slate-700">Using {selectedProduct.name} with its established product details.</p>
                    </div>
                  ) : (
                    <div className="md:col-span-2 space-y-4">
                      {articleSource === 'existing' ? (
                        <SellerWorkspaceArticlePicker article={article}
                          onChange={selected => { setArticle(selected); setMatchConfirmed(false); }}
                          onConfirmedChange={setMatchConfirmed}
                          onStartNew={() => {
                            setArticleSource('new');
                            setArticle(null);
                            setVehicleConfigurationIds([]);
                            setError('');
                          }}/>
                      ) : (
                        <section className="space-y-4 rounded-lg border border-slate-200 p-4">
                          <button type="button" className={secondaryClass} onClick={() => {
                            setArticleSource('existing');
                            setVehicleConfigurationIds([]);
                            setOfferRules(null);
                          }}>Back to catalog search</button>
                          <div>
                            <h3 className="text-base font-semibold">New product information</h3>
                            <p className="mt-1 text-xs text-slate-600">
                              Enter only the required Product Type fields. The system will look for an exact match
                              before creating a new Draft for verification.
                            </p>
                          </div>
                          <SellerInlineArticleFields value={inlineArticle} onChange={next => {
                            if (next.productTypeId !== inlineArticle.productTypeId) {
                              setVehicleConfigurationIds([]);
                            }
                            setInlineArticle(next);
                          }}
                            onReadyChange={setInlineArticleReady}
                            onFitmentRequiredChange={setFitmentRequired}
                            onFitmentApplicableChange={setFitmentApplicable}
                            onOfferRequirementsChange={setOfferRules} disabled={busy}/>
                          {fitmentApplicable ? <SellerVehicleConfigurationPicker
                            value={vehicleConfigurationIds} onChange={setVehicleConfigurationIds}
                            required={fitmentRequired} disabled={busy}/> : null}
                        </section>
                      )}
                    </div>
                  )}
                  {matchingInventory.length > 0 ? (
                    <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <h3 className="font-semibold text-amber-950">You already have stock for this part</h3>
                      <p className="mt-1 text-sm text-amber-900">
                        Reuse an existing SKU when it is the same condition and packaging, rather than entering the same stock twice.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {matchingInventory.map(existing => (
                          <li key={existing.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
                            <span className="text-sm">
                              <strong>{existing.sku}</strong> · {existing.condition ?? 'Unspecified condition'}
                              {' · '}{existing.packageQuantity} {existing.packageUnit} · {existing.totalOnHand} on hand
                            </span>
                            {mode === 'product' ? (
                              <button type="button" className={secondaryClass}
                                onClick={() => receiveExistingArticleStock(existing)}>
                                Receive / adjust existing stock
                              </button>
                            ) : existing.listing ? (
                              <Link className={secondaryClass} href={`/listings/${existing.listing.id}`}>
                                View existing Listing
                              </Link>
                            ) : (
                              <button type="button" className={secondaryClass}
                                onClick={() => openListingForm(existing)}>
                                Use this Inventory SKU
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button type="submit" disabled={busy || !defaultLocation}
                      className={primaryClass}>Continue to stock {mode === 'product' ? 'details' : 'and price'}</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <div>
                      <strong>{selectedProduct?.name ?? (articleSource === 'existing' ? article?.name : 'New product information')}</strong>
                      <p className="text-xs text-slate-600">
                        {selectedProduct ? `Using Inventory SKU ${selectedProduct.sku} without adding opening stock again.` :
                          articleSource === 'existing' ? 'Existing catalog product selected.' :
                            'New product details will be matched or submitted for verification.'}
                      </p>
                    </div>
                    {!selectedProduct ? <button type="button" className={secondaryClass}
                      onClick={() => setEntryStep('find')}>Change product</button> : null}
                  </div>
              {mode === 'product' ? (
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Stock and selling details</p>
                  <p className="mt-1 text-sm text-slate-600">Condition, packaging, Location and quantity belong to your stock; prices belong to this Listing.</p>
                </div>
              ) : null}
              {!selectedProduct ? (
                <label className="block text-sm font-medium">
                  Your SKU (optional)
                  <input type="text" maxLength={100} value={customSku}
                    onChange={event => setCustomSku(event.target.value)}
                    placeholder="Leave blank to generate a SKU"
                    className={inputClass}/>
                  <span className="mt-1 block text-xs font-normal text-slate-600">
                    Use your shop's existing stock code, or let Lemekinaye generate one.
                  </span>
                </label>
              ) : null}
              {(mode === 'product' || offerRules?.condition !== 'NOT_APPLICABLE') ? (
                <div>
                  <ReactSelect label="Condition" value={condition}
                    options={[{value:'NEW',label:'New'},{value:'USED',label:'Used'},{value:'REFURBISHED',label:'Refurbished'},{value:'OTHER',label:'Other'}]}
                    onChange={option => setCondition(String(option?.value ?? 'NEW'))}
                    isDisabled={Boolean(selectedProduct)} isClearable={false}/>
                </div>
              ) : null}
              <label className="block text-sm font-medium">Package quantity
                <input type="number" min={1} step={1} required value={packageQuantity}
                  disabled={Boolean(selectedProduct)}
                  onChange={event => setPackageQuantity(event.target.value)} className={inputClass}/>
              </label>
              <ReactSelect label="Stock Location" options={locationOptions} value={locationId}
                onChange={option => setLocationId(String(option?.value ?? ''))}
                isClearable={false}/>
              {!selectedProduct ? (
                <label className="block text-sm font-medium">Opening stock (optional)
                  <input type="number" min={0} step={1} value={openingQuantity}
                    onChange={event => setOpeningQuantity(event.target.value)} className={inputClass}/>
                </label>
              ) : null}
              {mode !== 'product' ? (
                <>
                  {!offerRules ? (
                    <p role="status" className="text-sm text-slate-600 md:col-span-2">Loading published Product Type selling policies…</p>
                  ) : offerRules.stock === 'NOT_APPLICABLE' || offerRules.price === 'NOT_APPLICABLE' ? (
                    <p role="alert" className="text-sm text-amber-800 md:col-span-2">
                      This Product Type does not support a priced stock-backed Listing.
                    </p>
                  ) : null}
                  {offerRules?.price !== 'NOT_APPLICABLE' ? (
                    <label className="block text-sm font-medium">Central online selling price (ETB) *
                      <input type="number" min={0.01} step="0.01" required value={price}
                        onChange={event => setPrice(event.target.value)} className={inputClass}/>
                    </label>
                  ) : null}
                  {offerRules?.warranty !== 'NOT_APPLICABLE' ? (
                    <label className="block text-sm font-medium">Warranty information{offerRules?.warranty === 'REQUIRED' ? ' *' : ''}
                      <input maxLength={5000} required={offerRules?.warranty === 'REQUIRED'}
                        value={warranty} onChange={event => setWarranty(event.target.value)} className={inputClass}/>
                    </label>
                  ) : null}
                  <label className="block text-sm font-medium">Delivery information
                    <input maxLength={5000} value={delivery} onChange={event => setDelivery(event.target.value)} className={inputClass}/>
                  </label>
                  <div className="md:col-span-2">
                     <SellerListingCommercialFields value={commercialDetails}
                       onChange={setCommercialDetails} policy={offerRules?.commercial}
                       disabled={busy}/>
                   </div>
                   <label className="block text-sm font-medium md:col-span-2">Listing description
                    <textarea maxLength={5000} rows={3} value={description} onChange={event => setDescription(event.target.value)}
                      className={inputClass}/>
                  </label>
                </>
              ) : null}
              <p className="text-xs text-slate-600 md:col-span-2">
                Your Default Store is always associated at zero stock if absent. Only the selected Location receives opening quantity.
                Online fulfillment uses enabled Locations only.
              </p>

                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    {!selectedProduct ? <button type="button" className={secondaryClass}
                      onClick={() => setEntryStep('find')}>Back</button> : null}
                    <button type="submit" disabled={busy || !defaultLocation || !locationId ||
                      (mode !== 'product' && (!offerRules || offerRules.price === 'NOT_APPLICABLE' ||
                        offerRules.stock === 'NOT_APPLICABLE' ||
                        (offerRules.warranty === 'REQUIRED' && !warranty.trim()))) ||
                      (!selectedProduct && (articleSource === 'existing' ? !article :
                        !inlineArticleReady || (fitmentRequired && vehicleConfigurationIds.length === 0)))}
                      className={primaryClass}>
                      {busy ? 'Saving…' : mode === 'product' ? 'Save Inventory' : 'Continue to images'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </section>
        ) : null}


        {!loading && !mode && !articleCreatorOpen && (tab === 'listing' || tab === 'inventory') ? (
          <SellerProductDraftCorrections refreshKey={articleTableRevision}
            onCorrect={id => {
              setArticleToResume(id);
              setArticleCreatorOpen(true);
              setPreparedArticle(null);
              resetForm();
              setError('');
            }}/>
        ) : null}

        {articleCreatorOpen && articleToResume ? (
          <section ref={articleEditorRef} tabIndex={-1}
            aria-label="Correct product information"
            className="space-y-3 scroll-mt-6 rounded-xl border border-slate-200 bg-white p-4 focus:outline-none sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Correct product information</h2>
                <p className="text-sm text-slate-600">
                  Only your unfinished product submission can be changed. Shared approved products are not edited.
                </p>
              </div>
              <button type="button" className={secondaryClass} onClick={() => {
                setArticleCreatorOpen(false);
                setArticleToResume(null);
                setPreparedArticle(null);
              }}>Close</button>
            </div>
            {preparedArticle ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p role="status" className="text-sm text-emerald-900">
                  Product information saved: {preparedArticle.name}.
                </p>
                <button type="button" className={secondaryClass}
                  onClick={() => {
                    setArticleCreatorOpen(false);
                    setArticleToResume(null);
                    openListingForm(undefined, undefined, preparedArticle);
                  }}>Use this product in a listing</button>
              </div>
            ) : null}
            <SellerArticleWorkspace key={articleToResume} initialDraftId={articleToResume}
              embedded onArticlePrepared={updated => {
                setPreparedArticle(updated);
                setArticleTableRevision(value => value + 1);
              }}/>
          </section>
        ) : null}

        {!loading && !mode && tab === 'inventory' ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Inventory ({products.length})</h2>
              <button type="button" onClick={() => openProductForm()} disabled={!defaultLocation}
                className={primaryClass}>Add Inventory</button>
            </div>
            <SellerRecordsTable
              label="Inventory"
              rows={products}
              rowKey={product => product.id}
              searchText={product => [product.sku, product.name, product.condition, product.listing?.status].join(' ')}
              emptyMessage="No Inventory yet. Search for an existing product or enter new product details."
              columns={[
                { key: 'sku', title: 'Product / SKU', render: product => (
                  <div><strong className="block">{product.name}</strong>
                  <span className="text-xs text-slate-500">{product.sku} · {product.packageQuantity} {product.packageUnit}</span></div>
                ) },
                { key: 'condition', title: 'Condition', render: product => product.condition ?? '—' },
                { key: 'locations', title: 'Stock locations', render: product =>
                  product.inventories.map(row => row.location.name).join(', ') || 'None' },
                { key: 'stock', title: 'On hand', numeric: true, render: product => product.totalOnHand },
                { key: 'available', title: 'Online available', numeric: true, render: product => product.onlineAvailable },
                { key: 'listing', title: 'Listing', render: product => product.listing?.status ?? 'Not listed' },
                { key: 'actions', title: 'Actions', render: product => (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondaryClass} onClick={() => {
                      setStockProduct(product);
                      setStockLocationId(product.inventories[0]?.locationId ?? defaultLocation?.id ?? '');
                      setStockDelta('');
                      setStockReason('');
                    }}>Adjust Stock</button>
                    <button type="button" className={secondaryClass} onClick={() => setTransferProduct(product)}>Transfer</button>
                    {product.listing ? (
                      <Link href={`/listings/${product.listing.id}`} className={secondaryClass}>
                        View Listing
                      </Link>
                    ) : (
                      <button type="button" className={primaryClass}
                        disabled={!product.productId || busy}
                        title={product.productId ? 'Prepare a Draft Listing for this Inventory SKU' : 'Choose a product before listing'}
                        onClick={() => listInventoryProduct(product)}>
                        List Product
                      </button>
                    )}
                  </div>
                ) },
              ]}
            />
          </section>
        ) : null}

        {!loading && tab === 'locations' ? (
          <SellerLocationsPanel
            locations={locations}
            products={products}
            busy={busy}
            onUpdate={(location, changes) => { void updateLocation(location, changes); }}
            onAddProduct={openProductForm}
            onCreated={load}
          />
        ) : null}

        {!loading && !mode && tab === 'listing' ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="seller-product-listings-heading" tabIndex={-1} className="text-xl font-semibold focus:outline-none">My Listings ({listings.length})</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTab('inventory')} className={secondaryClass}>Choose Inventory to List</button>
              </div>
            </div>
            <SellerRecordsTable
              label="Product Listings"
              rows={listings}
              rowKey={listing => listing.id}
              searchText={listing => [listing.sellerTitle, listing.sellerSku, listing.status].join(' ')}
              emptyMessage="No listings yet. Select Add Product to find the spare part, enter stock and price, then upload images."
              columns={[
                { key: 'listing', title: 'Listing / SKU', render: listing => (
                  <div><strong className="block">{listing.sellerTitle || listing.sellerSku}</strong>
                  <span className="text-xs text-slate-500">{listing.sellerSku}</span></div>
                ) },
                { key: 'price', title: 'Selling Price', numeric: true, render: listing =>
                  listing.price ? `${listing.price.sellingPrice} ${listing.price.currency}` : '—' },
                { key: 'available', title: 'Online available', numeric: true, render: listing => listing.quantityAvailable },
                { key: 'status', title: 'Publication status', render: listing => listing.status === 'DRAFT' && listing.reviewIntent ? 'Waiting for product verification' : listing.status },
                { key: 'actions', title: 'Actions', render: listing => (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/listings/${listing.id}`} className={secondaryClass}
                      aria-label={`View details and photos for ${listing.sellerSku}`}>View details</Link>
                    {['DRAFT','REJECTED'].includes(listing.status) ?
                      <button type="button" className={secondaryClass} onClick={() => setEditListing(listing)}>Edit</button> : null}
                    {listing.price && ['DRAFT','REJECTED','ACTIVE','OUT_OF_STOCK','PAUSED'].includes(listing.status) ?
                      <button type="button" className={secondaryClass} onClick={() => {
                        setPriceListing(listing); setUpdatedPrice(String(listing.price!.sellingPrice));
                      }}>Update price</button> : null}
                  </div>
                ) },
              ]}
            />
          </section>
        ) : null}

        {stockProduct ? (
          <section className="max-w-2xl space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Record stock movement · {stockProduct.sku}</h2>
              <button type="button" onClick={() => setStockProduct(null)} className={secondaryClass}>Close</button>
            </div>
            <form onSubmit={moveStock} className="space-y-3">
              <ReactSelect label="Location" value={stockLocationId} options={locationOptions}
                onChange={option => setStockLocationId(String(option?.value ?? ''))} isClearable={false}/>
              <label className="block text-sm font-medium">Quantity change (+ receipt / − adjustment)
                <input type="number" required step={1} value={stockDelta}
                  onChange={event => setStockDelta(event.target.value)} className={inputClass}/>
              </label>
              <label className="block text-sm font-medium">Movement reason
                <input required minLength={3} maxLength={500} value={stockReason}
                  onChange={event => setStockReason(event.target.value)} className={inputClass}/>
              </label>
              <button type="submit" disabled={busy || !stockLocationId || Number(stockDelta) === 0} className={primaryClass}>
                Record stock movement
              </button>
            </form>
          </section>
        ) : null}

        {transferProduct ? (
          <SellerStockTransferPanel
            product={transferProduct}
            locations={locations}
            onDone={async () => { await load(); }}
            onClose={() => setTransferProduct(null)}
          />
        ) : null}

        {listingProduct ? (
          <SellerListProductModal key={listingProduct.id} product={listingProduct}
            onClose={() => setListingProduct(null)}
            onSaved={handleInventoryListed}/>
        ) : null}

        {editListing ? (
          <SellerListingEditor
            key={editListing.id}
            listing={editListing}
            article={null}
            onDone={load}
            onClose={() => setEditListing(null)}
          />
        ) : null}

        {priceListing ? (
          <form onSubmit={changeListingPrice} className="max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Update online price · {priceListing.sellerSku}</h2>
            <label className="block text-sm font-medium">Selling price ({priceListing.price?.currency ?? 'ETB'})
              <input type="number" required min={0.01} step="0.01" value={updatedPrice}
                onChange={event => setUpdatedPrice(event.target.value)} className={inputClass}/>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primaryClass}>Save price</button>
              <button type="button" className={secondaryClass} onClick={() => setPriceListing(null)}>Cancel</button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
