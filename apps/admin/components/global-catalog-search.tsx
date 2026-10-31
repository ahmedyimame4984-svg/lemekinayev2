'use client';

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GlobalCatalogSearchResult,
  GlobalSearchArticleResult,
  GlobalSearchBrandResult,
  GlobalSearchProductTypeResult,
  GlobalSearchVehicleResult,
} from '@/lib/global-catalog-search-contracts';
import {
  globalSearchArticleHref,
  globalSearchBrandHref,
  globalSearchProductTypeHref,
  globalSearchVehicleHref,
} from '@/lib/global-catalog-search-links';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { AdminPageHeader } from './admin-page-header';
import { useAdminPrincipal } from './admin-session';
import { SearchIcon } from './icons';

const EMPTY_RESULT: GlobalCatalogSearchResult = {
  query: '',
  normalizedQuery: '',
  articles: [],
  brands: [],
  productTypes: [],
  vehicles: [],
};

export function GlobalCatalogSearch({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const router = useRouter();
  const principal = useAdminPrincipal();
  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery.trim());
  const [result, setResult] = useState<GlobalCatalogSearchResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(Boolean(initialQuery.trim()));
  const [error, setError] = useState('');

  const canManageCatalog = principal.permissions.includes('catalog.manage');
  const canManageSellers = principal.permissions.includes('seller.manage');
  const canManageVehicles = principal.permissions.includes('vehicle.manage');
  const canInspectArticle = canManageCatalog && canManageSellers;

  useEffect(() => {
    const trimmed = activeQuery.trim();
    if (trimmed.length < 2) {
      setResult(EMPTY_RESULT);
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({
          q: trimmed,
          limit: '12',
        });
        const response = await fetch(
          `/api/admin/search/catalog?${params.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(
            payload?.error?.message ?? 'Global Catalog Search could not be loaded.',
          );
        }
        const next = (await response.json()) as GlobalCatalogSearchResult;
        if (active) setResult(next);
      } catch (cause) {
        if (
          active &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        ) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Global Catalog Search could not be loaded.',
          );
          setResult(EMPTY_RESULT);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeQuery]);

  const totalResults = useMemo(
    () =>
      result.articles.length +
      result.productTypes.length +
      result.brands.length +
      result.vehicles.length,
    [result],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    if (next.length < 2) {
      setError('Enter at least 2 characters to search the catalog.');
      return;
    }
    setActiveQuery(next);
    router.replace(
      `/admin/search?${new URLSearchParams({ q: next }).toString()}`,
    );
  }

  return (
    <section className="catalog-page global-catalog-search-page">
      <AdminPageHeader
        eyebrow="Admin-wide discovery"
        title="Global Catalog Search"
        description="Search the canonical active catalog by Manufacturer Article, MPN, OE/cross-reference, GTIN, searchable technical criteria, Brand, Product Type, vehicle hierarchy, engine code, transmission or model year."
      />

      <form className="global-search-hero" onSubmit={submit}>
        <SearchIcon />
        <input
          aria-label="Search the global catalog"
          autoFocus
          maxLength={120}
          minLength={2}
          name="q"
          placeholder="Search MPN, OE number, Bosch, brake pad, Toyota Corolla, 2ZR-FE…"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!activeQuery ? (
        <section className="global-search-start">
          <div>
            <span className="eyebrow">Fast lookup</span>
            <h2>One search across the automotive catalog</h2>
            <p>
              Use the exact number you know, or search natural catalog context such
              as Brand + Product Type, vehicle hierarchy, engine code or technical
              value.
            </p>
          </div>
          <div className="global-search-examples" aria-label="Search examples">
            <span>0 986 494 123</span>
            <span>04465-02390</span>
            <span>Toyota Corolla 2020</span>
            <span>2ZR-FE</span>
            <span>Brake Pad Set</span>
          </div>
        </section>
      ) : null}

      {activeQuery && loading ? (
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Searching Articles, references, Product Types, Brands and vehicles…</p>
        </div>
      ) : null}

      {activeQuery && !loading && !error ? (
        <>
          <section className="global-search-summary" aria-label="Search result summary">
            <div>
              <span>Query</span>
              <strong>{result.query || activeQuery}</strong>
              <small>{totalResults} visible result{totalResults === 1 ? '' : 's'}</small>
            </div>
            <SummaryCount label="Articles" value={result.articles.length} />
            <SummaryCount label="Product Types" value={result.productTypes.length} />
            <SummaryCount label="Brands" value={result.brands.length} />
            <SummaryCount label="Vehicles" value={result.vehicles.length} />
          </section>

          {totalResults === 0 ? (
            <div className="catalog-empty">
              <h3>No canonical catalog results</h3>
              <p>
                Try a complete or partial MPN/OE number, Brand, Product Type,
                vehicle model, engine code, or searchable technical value.
              </p>
            </div>
          ) : (
            <div className="global-search-results">
              <SearchGroup
                title="Manufacturer Articles"
                description="Canonical active Articles matched by Article identity, reference numbers, GTIN or searchable technical criteria."
                count={result.articles.length}
              >
                {result.articles.map((article) => (
                  <ArticleResult
                    item={article}
                    canInspect={canInspectArticle}
                    canManageCatalog={canManageCatalog}
                    key={article.id}
                  />
                ))}
              </SearchGroup>

              <SearchGroup
                title="Product Types"
                description="Published technical schemas and catalog hierarchy."
                count={result.productTypes.length}
              >
                {result.productTypes.map((item) => (
                  <ProductTypeResult
                    item={item}
                    canOpen={canManageCatalog}
                    key={item.id}
                  />
                ))}
              </SearchGroup>

              <SearchGroup
                title="Brands"
                description="Approved canonical Brand master records."
                count={result.brands.length}
              >
                {result.brands.map((item) => (
                  <BrandResult
                    item={item}
                    canOpen={canManageCatalog}
                    key={item.id}
                  />
                ))}
              </SearchGroup>

              <SearchGroup
                title="Configured Vehicles"
                description="Canonical active vehicle configurations matched by hierarchy, powertrain or model year."
                count={result.vehicles.length}
              >
                {result.vehicles.map((item) => (
                  <VehicleResult
                    item={item}
                    canOpen={canManageVehicles}
                    key={item.vehicleConfigurationId}
                  />
                ))}
              </SearchGroup>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>top ranked results</small>
    </div>
  );
}

function SearchGroup({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="catalog-card global-search-group">
      <div className="catalog-section-heading">
        <div>
          <span className="eyebrow">Search group</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="catalog-count">{count}</span>
      </div>
      <div className="global-search-list">{children}</div>
    </section>
  );
}

function ArticleResult({
  item,
  canInspect,
  canManageCatalog,
}: {
  item: GlobalSearchArticleResult;
  canInspect: boolean;
  canManageCatalog: boolean;
}) {
  return (
    <article className="global-search-row">
      <div className="global-search-row__identity">
        <span className="eyebrow">Manufacturer Article</span>
        <strong>
          {item.brandName ? `${item.brandName} · ` : ''}
          {item.primaryManufacturerPartNumber
            ? `${item.primaryManufacturerPartNumber} · `
            : ''}
          {item.name}
        </strong>
        <small>{item.productTypeName}</small>
      </div>
      <MatchReasons values={item.matchedBy} />
      <div className="global-search-row__actions">
        {canInspect ? (
          <a className="button button--secondary" href={globalSearchArticleHref(item.id)}>
            Inspect Article
          </a>
        ) : canManageCatalog ? (
          <a
            className="button button--quiet"
            href={`/admin/catalog/article-relations?${new URLSearchParams({
              articleId: item.id,
            }).toString()}`}
          >
            Open Article context
          </a>
        ) : (
          <span className="global-search-permission-note">
            Catalog permission required
          </span>
        )}
      </div>
    </article>
  );
}

function ProductTypeResult({
  item,
  canOpen,
}: {
  item: GlobalSearchProductTypeResult;
  canOpen: boolean;
}) {
  return (
    <article className="global-search-row">
      <div className="global-search-row__identity">
        <span className="eyebrow">Product Type</span>
        <strong>{item.name}</strong>
        <small>
          {item.categoryName}
          {item.partGroupName ? ` › ${item.partGroupName}` : ''}
          {' › '}
          {item.code}
        </small>
      </div>
      <MatchReasons values={item.matchedBy} />
      <div className="global-search-row__actions">
        {canOpen ? (
          <a className="button button--secondary" href={globalSearchProductTypeHref(item)}>
            Open Product Type
          </a>
        ) : (
          <span className="global-search-permission-note">
            catalog.manage required
          </span>
        )}
      </div>
    </article>
  );
}

function BrandResult({
  item,
  canOpen,
}: {
  item: GlobalSearchBrandResult;
  canOpen: boolean;
}) {
  return (
    <article className="global-search-row">
      <div className="global-search-row__identity">
        <span className="eyebrow">Brand Master</span>
        <strong>{item.name}</strong>
        <small>{item.code}</small>
      </div>
      <MatchReasons values={item.matchedBy} />
      <div className="global-search-row__actions">
        {canOpen ? (
          <a className="button button--secondary" href={globalSearchBrandHref(item)}>
            Open Brand Master
          </a>
        ) : (
          <span className="global-search-permission-note">
            catalog.manage required
          </span>
        )}
      </div>
    </article>
  );
}

function VehicleResult({
  item,
  canOpen,
}: {
  item: GlobalSearchVehicleResult;
  canOpen: boolean;
}) {
  const hierarchy = [
    item.make,
    item.model,
    item.modelYear ? String(item.modelYear) : null,
    item.generation,
    item.trim,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' › ');
  const powertrain = [item.engine, item.transmission]
    .filter((value): value is string => Boolean(value))
    .join(' · ');

  return (
    <article className="global-search-row">
      <div className="global-search-row__identity">
        <span className="eyebrow">Configured Vehicle</span>
        <strong>{hierarchy}</strong>
        <small>{powertrain || 'Canonical vehicle configuration'}</small>
      </div>
      <MatchReasons values={item.matchedBy} />
      <div className="global-search-row__actions">
        {canOpen ? (
          <a className="button button--secondary" href={globalSearchVehicleHref(item)}>
            Open Vehicle Library
          </a>
        ) : (
          <span className="global-search-permission-note">
            vehicle.manage required
          </span>
        )}
      </div>
    </article>
  );
}

function MatchReasons({ values }: { values: string[] }) {
  const visible = [...new Set(values)].slice(0, 4);
  return (
    <div className="global-search-match-reasons" aria-label="Matched by">
      {visible.map((value) => (
        <span key={value}>{formatMatchReason(value)}</span>
      ))}
    </div>
  );
}

function formatMatchReason(value: string): string {
  if (value.startsWith('CRITERIA:')) {
    return `Technical: ${value.slice('CRITERIA:'.length)}`;
  }
  const aliases: Record<string, string> = {
    MANUFACTURER_PART_NUMBER: 'MPN',
    OE_NUMBER: 'OE number',
    CROSS_REFERENCE: 'Cross-reference',
    ARTICLE_NAME: 'Article name',
    PRODUCT_TYPE: 'Product Type',
    PRODUCT_TYPE_NAME: 'Product Type name',
    PRODUCT_TYPE_CODE: 'Product Type code',
    PRODUCT_TYPE_HIERARCHY: 'Catalog hierarchy',
    BRAND: 'Brand',
    BRAND_NAME: 'Brand name',
    BRAND_CODE: 'Brand code',
    CATEGORY: 'Category',
    PART_GROUP: 'Part Group',
    VEHICLE_MAKE: 'Vehicle make',
    VEHICLE_MAKE_CODE: 'Make code',
    VEHICLE_MODEL: 'Vehicle model',
    VEHICLE_MODEL_CODE: 'Model code',
    VEHICLE_GENERATION: 'Generation',
    VEHICLE_GENERATION_CODE: 'Generation code',
    VEHICLE_TRIM: 'Trim',
    VEHICLE_TRIM_CODE: 'Trim code',
    ENGINE_NAME: 'Engine',
    ENGINE_CODE: 'Engine code',
    ENGINE_FAMILY: 'Engine family',
    TRANSMISSION_CODE: 'Transmission code',
    TRANSMISSION_TYPE: 'Transmission',
    MODEL_YEAR: 'Model year',
    VEHICLE_HIERARCHY: 'Vehicle hierarchy',
    TRADE_NUMBER: 'Trade number',
    GTIN_8: 'GTIN-8',
    GTIN_12: 'GTIN-12',
    GTIN_13: 'GTIN-13',
    GTIN_14: 'GTIN-14',
  };
  return aliases[value] ?? formatAdminEnumLabel(value);
}
