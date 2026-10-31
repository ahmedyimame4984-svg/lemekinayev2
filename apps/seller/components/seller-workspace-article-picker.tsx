'use client';

import { useEffect, useId, useState } from 'react';
import type { SellerArticleSearchResult } from '@/lib/seller-stock-contracts';
import { ReactSelect } from './common/react-select';

const SEARCH_DELAY_MS = 350;
const MAX_MATCHES = 20;

type CatalogPreview = {
  id: string;
  name: string;
  fitmentRequirement: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  brand: { name: string } | null;
  productType: { name: string };
  partNumbers: Array<{ type: string; partNumber: string }>;
  attributeValues: Array<{
    attribute: { code: string; name: string };
    valueString: string | null;
    valueNumeric: number | string | null;
    valueBoolean: boolean | null;
    valueReferenceId: string | null;
    valueJson: unknown;
    unit: string | null;
  }>;
  compatibilities: Array<{
    vehicleConfigurationId: string | null;
    vehicleConfiguration: {
      id: string;
      modelYear: number | null;
      make: { name: string };
      model: { name: string };
      generation: { name: string } | null;
      trim: { name: string } | null;
      engine: { name: string } | null;
      transmission: { code: string } | null;
      bodyType: { name: string } | null;
      market: { name: string } | null;
    } | null;
  }>;
};

function valueLabel(row: CatalogPreview['attributeValues'][number]): string {
  const value = row.valueString ?? row.valueNumeric ?? row.valueBoolean ??
    row.valueReferenceId ?? row.valueJson;
  return [typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'Not provided'),
    row.unit].filter(Boolean).join(' ');
}

export function SellerWorkspaceArticlePicker({
  article, onChange, onStartNew, onConfirmedChange,
}: {
  article: SellerArticleSearchResult | null;
  onChange: (article: SellerArticleSearchResult | null) => void;
  onStartNew?: () => void;
  onConfirmedChange?: (confirmed: boolean) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SellerArticleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<CatalogPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewRetry, setPreviewRetry] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  // Search as the seller types. Abort stale queries so a slow response cannot
  // replace a more recent part-number search.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      setError('');
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const qs = new URLSearchParams({ q: term, limit: String(MAX_MATCHES) });
        const response = await fetch(`/api/seller/reference/search/catalog?${qs}`, {
          cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Catalog search is unavailable. Retry before entering a new product.');
        const data = await response.json() as { articles?: SellerArticleSearchResult[] };
        if (controller.signal.aborted) return;
        setResults(data.articles ?? []);
        setSearched(true);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearched(false);
        setError(cause instanceof Error ? cause.message : 'Catalog search failed.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => { clearTimeout(handle); controller.abort(); };
  }, [query]);

  useEffect(() => {
    setConfirmed(false);
    onConfirmedChange?.(false);
    setPreview(null);
    setPreviewError('');
    if (!article?.id) { setPreviewLoading(false); return; }
    const controller = new AbortController();
    setPreviewLoading(true);
    void fetch(`/api/seller/catalog/products/${encodeURIComponent(article.id)}/preview`, {
      cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Could not load verified product details. Retry to confirm this match.');
      return response.json() as Promise<CatalogPreview>;
    }).then(result => {
      if (!controller.signal.aborted) setPreview(result);
    }).catch(cause => {
      if (!controller.signal.aborted) {
        setPreviewError(cause instanceof Error ? cause.message : 'Product details unavailable.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewLoading(false);
    });
    return () => controller.abort();
  }, [article?.id, previewRetry, onConfirmedChange]);

  const options = [...results];
  if (article && !options.some(item => item.id === article.id)) options.push(article);

  return (
    <section className="space-y-3" aria-label="Find an existing marketplace product">
      <div role="search">
        <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-slate-800">
          Search the marketplace catalog first
        </label>
        <input id={inputId} type="search" maxLength={120} value={query}
          onChange={event => { setQuery(event.target.value); onChange(null); }}
          placeholder="Part number, OE number, barcode, brand or product name"
          aria-describedby={`${inputId}-help`}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"/>
        <p id={`${inputId}-help`} className="mt-1 text-xs text-slate-600">
          Using an existing product preserves verified technical details and compatible vehicles.
        </p>
      </div>
      {searching ? <p role="status" className="text-sm text-slate-600">Finding matching spare parts…</p> : null}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      {!searching && searched && results.length === 0 ? (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No matching product found. Check the part number, or enter the technical details for a new product.
        </p>
      ) : null}
      {options.length > 0 ? (
        <ReactSelect
          label="Matching products"
          options={options.map(item => ({
            value: item.id,
            label: [item.brandName, item.primaryManufacturerPartNumber, item.name]
              .filter(Boolean).join(' · '),
          }))}
          value={article?.id ?? ''}
          onChange={option => onChange(
            option ? options.find(item => item.id === option.value) ?? null : null
          )}
          placeholder="Choose the correct spare part"
          isClearable
        />
      ) : null}
      {article ? (
        <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
          aria-label="Confirm selected spare part">
          <div>
            <h3 className="font-semibold">{article.name}</h3>
            <p className="mt-1 text-xs">
              Brand: {article.brandName ?? 'Not specified'} · Part number: {article.primaryManufacturerPartNumber ?? 'Not specified'}
            </p>
          </div>
          {previewLoading ? <p role="status">Loading technical details and compatible vehicles…</p> : null}
          {previewError ? <div>
            <p role="alert" className="text-sm text-red-800">{previewError}</p>
            <button type="button" onClick={() => setPreviewRetry(value => value + 1)}
              className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">
              Retry product details
            </button>
          </div> : null}
          {preview ? (
            <>
              <p className="text-xs">Product Type: {preview.productType.name} · Brand: {preview.brand?.name ?? 'Not specified'}</p>
              {preview.partNumbers.length > 0 ? (
                <p className="text-xs">Numbers: {preview.partNumbers
                  .map(item => `${item.type}: ${item.partNumber}`).join(' · ')}</p>
              ) : null}
              <details className="rounded-md border border-emerald-200 bg-white p-3">
                <summary className="cursor-pointer font-semibold">
                  Compatible vehicles ({preview.compatibilities.length}{preview.compatibilities.length === 40 ? '+' : ''})
                </summary>
                {preview.fitmentRequirement === 'NOT_APPLICABLE' ? (
                  <p className="mt-2 text-xs">Vehicle compatibility is not applicable to this Product Type.</p>
                ) : preview.compatibilities.length ? (
                  <ul className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {preview.compatibilities.map(fitment => (
                      <li key={fitment.vehicleConfigurationId} className="border-b border-slate-100 pb-1 text-xs">
                        {fitment.vehicleConfiguration ? [
                          fitment.vehicleConfiguration.make.name,
                          fitment.vehicleConfiguration.model.name,
                          fitment.vehicleConfiguration.generation?.name,
                          fitment.vehicleConfiguration.modelYear,
                          fitment.vehicleConfiguration.trim?.name,
                          fitment.vehicleConfiguration.engine?.name,
                          fitment.vehicleConfiguration.transmission?.code,
                          fitment.vehicleConfiguration.bodyType?.name,
                          fitment.vehicleConfiguration.market?.name,
                        ].filter(Boolean).join(' · ') : 'Vehicle configuration unavailable'}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-xs">No configured vehicle fitments are recorded.</p>}
              </details>
              <details className="rounded-md border border-emerald-200 bg-white p-3">
                <summary className="cursor-pointer font-semibold">
                  Technical attributes ({preview.attributeValues.length}{preview.attributeValues.length === 40 ? '+' : ''})
                </summary>
                {preview.attributeValues.length ? (
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    {preview.attributeValues.map(row => (
                      <div key={row.attribute.code} className="text-xs">
                        <dt className="font-semibold">{row.attribute.name}</dt>
                        <dd>{valueLabel(row)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-2 text-xs">No additional technical attributes.</p>}
              </details>
              {onConfirmedChange ? (
                <button type="button"
                  onClick={() => { setConfirmed(true); onConfirmedChange(true); }}
                  disabled={confirmed}
                  className="rounded-lg bg-[#a71920] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70">
                  {confirmed ? 'Product confirmed' : 'Confirm this product and its compatibility'}
                </button>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
      {onStartNew ? (
        <button type="button" onClick={onStartNew}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
          Can't find your product? Enter new product details
        </button>
      ) : null}
    </section>
  );
}
