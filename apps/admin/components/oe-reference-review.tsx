'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  OeCollisionPage,
  OeReferenceSummary,
  ReferencePage,
  ReferenceType,
} from '@/lib/oe-reference-review-contracts';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import type { ProductStatus } from '@/lib/product-contracts';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { useAdminPrincipal } from './admin-session';

type ViewMode = 'COLLISIONS' | 'REFERENCES';
type IntegrityFilter = 'ALL' | 'OE_MISSING_ISSUER';
type StatusFilter<T extends string> = 'ALL' | T;

const EMPTY_COLLISIONS: OeCollisionPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 0,
};

const EMPTY_REFERENCES: ReferencePage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 0,
};

const referenceTypes: ReferenceType[] = [
  'OE',
  'CROSS_REFERENCE',
  'MANUFACTURER',
  'AFTERMARKET',
  'SUPPLIER',
  'OTHER',
];

const masterStatuses: MasterDataStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'DEPRECATED',
  'ARCHIVED',
];

const articleStatuses: ProductStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'DEPRECATED',
  'ARCHIVED',
];

export function OeReferenceReview({
  initialSearch = '',
  initialView = 'COLLISIONS',
}: {
  initialSearch?: string;
  initialView?: ViewMode;
}) {
  const principal = useAdminPrincipal();
  const canReview =
    principal.permissions.includes('catalog.manage') &&
    principal.permissions.includes('seller.manage');

  const [view, setView] = useState<ViewMode>(
    initialSearch ? initialView : 'COLLISIONS',
  );
  const [summary, setSummary] = useState<OeReferenceSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');

  const [collisionSearch, setCollisionSearch] = useState(initialSearch);
  const [collisionPageNumber, setCollisionPageNumber] = useState(1);
  const [collisions, setCollisions] =
    useState<OeCollisionPage>(EMPTY_COLLISIONS);
  const [collisionsLoading, setCollisionsLoading] = useState(false);
  const [collisionsError, setCollisionsError] = useState('');

  const [referenceSearch, setReferenceSearch] = useState(initialSearch);
  const [referenceType, setReferenceType] =
    useState<StatusFilter<ReferenceType>>('ALL');
  const [referenceStatus, setReferenceStatus] =
    useState<StatusFilter<MasterDataStatus>>('ALL');
  const [articleStatus, setArticleStatus] =
    useState<StatusFilter<ProductStatus>>('ALL');
  const [integrity, setIntegrity] = useState<IntegrityFilter>('ALL');
  const [referencePageNumber, setReferencePageNumber] = useState(1);
  const [references, setReferences] =
    useState<ReferencePage>(EMPTY_REFERENCES);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referencesError, setReferencesError] = useState('');

  useEffect(() => {
    if (!canReview) return;
    let active = true;
    void (async () => {
      try {
        setSummaryError('');
        const response = await fetch('/api/admin/catalog/oe-references/summary', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('OE reference summary could not be loaded.');
        const next = (await response.json()) as OeReferenceSummary;
        if (active) setSummary(next);
      } catch (error) {
        if (active) {
          setSummaryError(
            error instanceof Error
              ? error.message
              : 'OE reference summary could not be loaded.',
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [canReview]);

  useEffect(() => {
    if (!canReview || view !== 'COLLISIONS') return;

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setCollisionsLoading(true);
        setCollisionsError('');
        const query = new URLSearchParams({
          page: String(collisionPageNumber),
          pageSize: '25',
        });
        if (collisionSearch.trim()) {
          query.set('search', collisionSearch.trim());
        }
        const response = await fetch(
          `/api/admin/catalog/oe-references/collisions?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error('OE collision groups could not be loaded.');
        }
        const next = (await response.json()) as OeCollisionPage;
        if (!active) return;
        setCollisions(next);
        if (next.pageCount > 0 && collisionPageNumber > next.pageCount) {
          setCollisionPageNumber(next.pageCount);
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setCollisionsError(
            error instanceof Error
              ? error.message
              : 'OE collision groups could not be loaded.',
          );
        }
      } finally {
        if (active) setCollisionsLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canReview, collisionPageNumber, collisionSearch, view]);

  useEffect(() => {
    if (!canReview || view !== 'REFERENCES') return;

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setReferencesLoading(true);
        setReferencesError('');
        const query = new URLSearchParams({
          integrity,
          page: String(referencePageNumber),
          pageSize: '25',
        });
        if (referenceSearch.trim()) query.set('search', referenceSearch.trim());
        if (referenceType !== 'ALL') query.set('type', referenceType);
        if (referenceStatus !== 'ALL') {
          query.set('referenceStatus', referenceStatus);
        }
        if (articleStatus !== 'ALL') query.set('articleStatus', articleStatus);

        const response = await fetch(
          `/api/admin/catalog/oe-references/references?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error('Reference search could not be loaded.');
        }
        const next = (await response.json()) as ReferencePage;
        if (!active) return;
        setReferences(next);
        if (next.pageCount > 0 && referencePageNumber > next.pageCount) {
          setReferencePageNumber(next.pageCount);
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setReferencesError(
            error instanceof Error
              ? error.message
              : 'Reference search could not be loaded.',
          );
        }
      } finally {
        if (active) setReferencesLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    articleStatus,
    canReview,
    integrity,
    referencePageNumber,
    referenceSearch,
    referenceStatus,
    referenceType,
    view,
  ]);

  const referenceFiltersActive = useMemo(
    () =>
      Boolean(referenceSearch.trim()) ||
      referenceType !== 'ALL' ||
      referenceStatus !== 'ALL' ||
      articleStatus !== 'ALL' ||
      integrity !== 'ALL',
    [
      articleStatus,
      integrity,
      referenceSearch,
      referenceStatus,
      referenceType,
    ],
  );

  function investigateNumber(value: string) {
    setReferenceSearch(value);
    setReferenceType('OE');
    setReferenceStatus('ALL');
    setArticleStatus('ALL');
    setIntegrity('ALL');
    setReferencePageNumber(1);
    setView('REFERENCES');
  }

  function resetReferenceFilters() {
    setReferenceSearch('');
    setReferenceType('ALL');
    setReferenceStatus('ALL');
    setArticleStatus('ALL');
    setIntegrity('ALL');
    setReferencePageNumber(1);
  }

  if (!canReview) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog governance"
          title="OE & Cross-reference Review"
          description="OE/reference governance requires both catalog.manage and seller.manage because canonical Article identity and Seller-submission provenance are reviewed together."
        />
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have both required permissions.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page oe-review-page">
      <AdminPageHeader
        eyebrow="Catalog identity governance"
        title="OE & Cross-reference Review"
        description="Investigate ambiguous OE assignments and trace any known Manufacturer/OE/cross-reference number to its canonical Article. This workspace is read-only; corrections stay in the owning Article Review workflow."
      />

      <CatalogPrimaryNav active="oe-references" />

      {summaryError ? (
        <div className="alert alert--error" role="alert">{summaryError}</div>
      ) : null}

      {summary ? (
        <section className="oe-review-summary" aria-label="OE reference summary">
          <SummaryStat
            label="Live OE references"
            value={summary.liveOeReferences}
            detail="Draft + Active Articles"
          />
          <SummaryStat
            label="Cross references"
            value={summary.liveCrossReferences}
            detail="Live reference evidence"
          />
          <SummaryStat
            label="Collision groups"
            value={summary.collisionGroups}
            detail="Same issuer OE maps to multiple Articles"
            attention={summary.collisionGroups > 0}
          />
          <SummaryStat
            label="OE missing issuer"
            value={summary.oeWithoutIssuerBrand}
            detail="Legacy/import integrity issue"
            attention={summary.oeWithoutIssuerBrand > 0}
            onClick={
              summary.oeWithoutIssuerBrand > 0
                ? () => {
                    setIntegrity('OE_MISSING_ISSUER');
                    setReferenceType('OE');
                    setReferencePageNumber(1);
                    setView('REFERENCES');
                  }
                : undefined
            }
          />
        </section>
      ) : null}

      <div className="oe-review-tabs" role="tablist" aria-label="OE review views">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'COLLISIONS'}
          className={view === 'COLLISIONS' ? 'is-active' : undefined}
          onClick={() => setView('COLLISIONS')}
        >
          Collision Review
          {summary?.collisionGroups ? <span>{summary.collisionGroups}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'REFERENCES'}
          className={view === 'REFERENCES' ? 'is-active' : undefined}
          onClick={() => setView('REFERENCES')}
        >
          Reference Search
        </button>
      </div>

      {view === 'COLLISIONS' ? (
        <section className="oe-review-workspace">
          <div className="catalog-toolbar catalog-toolbar--filters oe-review-collision-toolbar">
            <div className="catalog-filter">
              <label htmlFor="oe-collision-search">OE number</label>
              <input
                id="oe-collision-search"
                type="search"
                value={collisionSearch}
                placeholder="Search OE number; punctuation is ignored"
                onChange={(event) => {
                  setCollisionSearch(event.target.value);
                  setCollisionPageNumber(1);
                }}
              />
            </div>
            <AdminFilterResetButton
              active={Boolean(collisionSearch.trim())}
              onReset={() => {
                setCollisionSearch('');
                setCollisionPageNumber(1);
              }}
            />
          </div>

          {collisionsError ? (
            <div className="alert alert--error" role="alert">{collisionsError}</div>
          ) : null}

          {collisionsLoading ? (
            <div className="catalog-state">
              <span className="spinner spinner--dark" aria-hidden="true" />
              <p>Loading OE collision groups…</p>
            </div>
          ) : null}

          {!collisionsLoading &&
          !collisionsError &&
          collisions.items.length === 0 ? (
            <div className="catalog-empty">
              <h3>No OE collision groups</h3>
              <p>
                {collisionSearch.trim()
                  ? 'No ambiguous live OE assignments match this number.'
                  : 'No ambiguous live OE assignments currently require review.'}
              </p>
            </div>
          ) : null}

          {!collisionsLoading && !collisionsError && collisions.items.length > 0 ? (
            <div className="oe-collision-list">
              {collisions.items.map((group) => (
                <article className="oe-collision-card" key={group.groupKey}>
                  <div className="oe-collision-card__header">
                    <div>
                      <span className="eyebrow">OE collision</span>
                      <h2>{group.displayPartNumber}</h2>
                      <p>
                        Issuer: <strong>{group.issuerBrand?.name ?? 'Missing issuer'}</strong>
                        {' · '}Article Brand: <strong>{group.articleBrand?.name ?? 'No Article Brand'}</strong>
                        {' · '}Product Type: <strong>{group.productType.name}</strong>
                      </p>
                    </div>
                    <div className="oe-collision-card__metrics">
                      <span>{group.articleCount} Articles</span>
                      <small>{group.activeArticleCount} active · {group.draftArticleCount} draft</small>
                    </div>
                  </div>

                  <div className="oe-collision-articles">
                    {group.sampleArticles.map((article) => (
                      <ArticleMatch
                        article={article}
                        key={article.id}
                      />
                    ))}
                    {group.articleCount > group.sampleArticles.length ? (
                      <div className="oe-collision-more">
                        +{group.articleCount - group.sampleArticles.length} more matching Article
                        {group.articleCount - group.sampleArticles.length === 1 ? '' : 's'}
                      </div>
                    ) : null}
                  </div>

                  <div className="oe-collision-card__actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => investigateNumber(group.displayPartNumber)}
                    >
                      Search all matching references
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <Pager
            page={collisions.page}
            pageCount={collisions.pageCount}
            disabled={collisionsLoading}
            onPrevious={() =>
              setCollisionPageNumber((current) => Math.max(1, current - 1))
            }
            onNext={() => setCollisionPageNumber((current) => current + 1)}
          />
        </section>
      ) : (
        <section className="oe-review-workspace">
          <div className="catalog-toolbar catalog-toolbar--filters oe-review-reference-toolbar">
            <div className="catalog-filter oe-review-reference-search">
              <label htmlFor="oe-reference-search">Reference / Article</label>
              <input
                id="oe-reference-search"
                type="search"
                value={referenceSearch}
                placeholder="OE, MPN, cross-reference, Brand, Product Type, Article"
                onChange={(event) => {
                  setReferenceSearch(event.target.value);
                  setReferencePageNumber(1);
                }}
              />
            </div>

            <div className="catalog-filter">
              <label htmlFor="oe-reference-type">Reference type</label>
              <select
                id="oe-reference-type"
                value={referenceType}
                onChange={(event) => {
                  setReferenceType(event.target.value as StatusFilter<ReferenceType>);
                  setReferencePageNumber(1);
                }}
              >
                <option value="ALL">All types</option>
                {referenceTypes.map((type) => (
                  <option value={type} key={type}>
                    {formatAdminEnumLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="catalog-filter">
              <label htmlFor="oe-reference-status">Reference lifecycle</label>
              <select
                id="oe-reference-status"
                value={referenceStatus}
                onChange={(event) => {
                  setReferenceStatus(event.target.value as StatusFilter<MasterDataStatus>);
                  setReferencePageNumber(1);
                }}
              >
                <option value="ALL">Not archived</option>
                {masterStatuses.map((status) => (
                  <option value={status} key={status}>
                    {formatAdminEnumLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="catalog-filter">
              <label htmlFor="oe-article-status">Article lifecycle</label>
              <select
                id="oe-article-status"
                value={articleStatus}
                onChange={(event) => {
                  setArticleStatus(event.target.value as StatusFilter<ProductStatus>);
                  setReferencePageNumber(1);
                }}
              >
                <option value="ALL">Not archived</option>
                {articleStatuses.map((status) => (
                  <option value={status} key={status}>
                    {formatAdminEnumLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div className="catalog-filter">
              <label htmlFor="oe-reference-integrity">Integrity</label>
              <select
                id="oe-reference-integrity"
                value={integrity}
                onChange={(event) => {
                  const next = event.target.value as IntegrityFilter;
                  setIntegrity(next);
                  if (next === 'OE_MISSING_ISSUER') setReferenceType('OE');
                  setReferencePageNumber(1);
                }}
              >
                <option value="ALL">All records</option>
                <option value="OE_MISSING_ISSUER">OE missing issuer</option>
              </select>
            </div>

            <AdminFilterResetButton
              active={referenceFiltersActive}
              onReset={resetReferenceFilters}
            />
          </div>

          {referencesError ? (
            <div className="alert alert--error" role="alert">{referencesError}</div>
          ) : null}

          {referencesLoading ? (
            <div className="catalog-state">
              <span className="spinner spinner--dark" aria-hidden="true" />
              <p>Searching canonical reference evidence…</p>
            </div>
          ) : null}

          {!referencesLoading &&
          !referencesError &&
          references.items.length === 0 ? (
            <div className="catalog-empty">
              <h3>No reference records match</h3>
              <p>Adjust the number, type, lifecycle, or integrity filters.</p>
            </div>
          ) : null}

          {!referencesLoading && !referencesError && references.items.length > 0 ? (
            <div className="oe-reference-table">
              <div className="oe-reference-table__header" aria-hidden="true">
                <span>Reference</span>
                <span>Issuer</span>
                <span>Canonical Article</span>
                <span>Context</span>
                <span>Action</span>
              </div>
              {references.items.map((reference) => (
                <article className="oe-reference-row" key={reference.id}>
                  <div className="oe-reference-cell">
                    <strong>{reference.partNumber}</strong>
                    <span>{formatAdminEnumLabel(reference.type)}</span>
                    <small>{reference.normalizedPartNumber}</small>
                  </div>

                  <div className="oe-reference-cell">
                    <strong>{reference.issuerBrand?.name ?? 'Issuer missing'}</strong>
                    <span>{formatAdminEnumLabel(reference.status)}</span>
                    {reference.isPrimary ? <small>Primary MPN</small> : null}
                  </div>

                  <div className="oe-reference-cell oe-reference-article">
                    <strong>
                      {reference.article.brand?.name
                        ? `${reference.article.brand.name} · `
                        : ''}
                      {reference.article.manufacturerPartNumber
                        ? `${reference.article.manufacturerPartNumber} · `
                        : ''}
                      {reference.article.name}
                    </strong>
                    <span>
                      {reference.article.productType.name} ·{' '}
                      {formatAdminEnumLabel(reference.article.status)}
                    </span>
                    <small>{reference.article.id}</small>
                  </div>

                  <div className="oe-reference-cell">
                    <strong>{formatAdminEnumLabel(reference.article.articleSource)}</strong>
                    <span>
                      {reference.article.sourceSeller
                        ? `${reference.article.sourceSeller.displayName} · ${reference.article.sourceSeller.sellerCode}`
                        : 'Platform / approved source'}
                    </span>
                    <small>
                      {reference.article.relationCount} Article relation
                      {reference.article.relationCount === 1 ? '' : 's'}
                    </small>
                  </div>

                  <div className="oe-reference-actions">
                    <a
                      className="button button--secondary"
                      href={`/admin/catalog/article-review/${reference.article.id}#identifiers`}
                    >
                      Inspect Article
                    </a>
                    {reference.article.awaitingReview ? (
                      <a
                        className="button button--quiet"
                        href={`/admin/catalog/article-review?articleId=${encodeURIComponent(reference.article.id)}`}
                      >
                        Review decision
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <Pager
            page={references.page}
            pageCount={references.pageCount}
            disabled={referencesLoading}
            onPrevious={() =>
              setReferencePageNumber((current) => Math.max(1, current - 1))
            }
            onNext={() => setReferencePageNumber((current) => current + 1)}
          />
        </section>
      )}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  detail,
  attention = false,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  attention?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </>
  );

  if (onClick) {
    return (
      <button
        className={attention ? 'is-attention' : undefined}
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={attention ? 'is-attention' : undefined}>
      {content}
    </article>
  );
}

function ArticleMatch({
  article,
}: {
  article: OeCollisionPage['items'][number]['sampleArticles'][number];
}) {
  return (
    <article>
      <div>
        <strong>
          {article.brand?.name ? `${article.brand.name} · ` : ''}
          {article.manufacturerPartNumber
            ? `${article.manufacturerPartNumber} · `
            : ''}
          {article.name}
        </strong>
        <small>
          {article.productType.name} · {formatAdminEnumLabel(article.status)}
          {article.sourceSeller
            ? ` · ${article.sourceSeller.displayName}`
            : ''}
        </small>
      </div>
      <span>{article.relationCount} relations</span>
      <a
        className="button button--quiet"
        href={`/admin/catalog/article-review/${article.id}#identifiers`}
      >
        Inspect
      </a>
    </article>
  );
}

function Pager({
  page,
  pageCount,
  disabled,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="catalog-pagination">
      <button
        className="button button--quiet"
        type="button"
        disabled={disabled || page <= 1}
        onClick={onPrevious}
      >
        Previous
      </button>
      <span>Page {page} of {pageCount}</span>
      <button
        className="button button--quiet"
        type="button"
        disabled={disabled || page >= pageCount}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  );
}
