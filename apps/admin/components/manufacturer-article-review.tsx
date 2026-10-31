'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import type {
  AdminArticleReviewItem,
  AdminArticleReviewPage,
  AdminArticleReviewSortBy,
  AdminArticleReviewState,
  ArticleSource,
} from '@/lib/article-review-contracts';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import type { ProductStatus } from '@/lib/product-contracts';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { AdminSavedViewsToolbar } from './admin-saved-views-toolbar';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { useAdminPrincipal } from './admin-session';

type SourceFilter = 'ALL' | ArticleSource;
type StatusFilter = 'ALL' | ProductStatus;
type SortDirection = 'ASC' | 'DESC';

const ARTICLE_REVIEW_SAVED_VIEW_SCOPE = 'CATALOG_ARTICLE_REVIEW';

const reviewStates: AdminArticleReviewState[] = [
  'AWAITING_REVIEW',
  'SELLER_DRAFT',
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'DEPRECATED',
  'ARCHIVED',
  'ALL',
];

const articleSources: ArticleSource[] = [
  'SELLER_SUBMISSION',
  'MANUFACTURER_SUBMISSION',
  'APPROVED_CATALOG_IMPORT',
  'PLATFORM_MIGRATION',
];

const articleStatuses: ProductStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'DEPRECATED',
  'ARCHIVED',
];

const sortOptions: Array<{ value: AdminArticleReviewSortBy; label: string }> = [
  { value: 'REVIEW_SUBMITTED_AT', label: 'Review submitted time' },
  { value: 'UPDATED_AT', label: 'Updated time' },
  { value: 'NAME', label: 'Article name' },
];

const EMPTY_PAGE: AdminArticleReviewPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 0,
};

export function ManufacturerArticleReview({
  initialSearch = '',
}: {
  initialSearch?: string;
}) {
  const principal = useAdminPrincipal();
  const canReview =
    principal.permissions.includes('catalog.manage') &&
    principal.permissions.includes('seller.manage');
  const canReadAudit = principal.permissions.includes('admin.audit.read');

  const [pageData, setPageData] = useState<AdminArticleReviewPage>(EMPTY_PAGE);
  const [search, setSearch] = useState(initialSearch);
  const [reviewState, setReviewState] =
    useState<AdminArticleReviewState>(
      initialSearch ? 'ALL' : 'AWAITING_REVIEW',
    );
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] =
    useState<AdminArticleReviewSortBy>('REVIEW_SUBMITTED_AT');
  const [sortDirection, setSortDirection] =
    useState<SortDirection>('ASC');
  const [pageNumber, setPageNumber] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [workingArticleId, setWorkingArticleId] = useState('');
  const [returningArticleId, setReturningArticleId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [savedViews, setSavedViews] = useState<AdminSavedViewRecord[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewSaving, setSavedViewSaving] = useState(false);
  const [savedViewError, setSavedViewError] = useState('');

  useEffect(() => {
    if (!canReview) {
      setSavedViewsLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        setSavedViewsLoading(true);
        setSavedViewError('');
        const response = await fetch(
          `/api/admin/preferences/saved-views?scope=${ARTICLE_REVIEW_SAVED_VIEW_SCOPE}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Article review saved views.');
        const records = (await response.json()) as AdminSavedViewRecord[];
        if (active) setSavedViews(records);
      } catch {
        if (active) {
          setSavedViewError(
            'Saved views could not be loaded. Article review is still available.',
          );
        }
      } finally {
        if (active) setSavedViewsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [canReview]);

  useEffect(() => {
    if (!canReview) {
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setLoadError('');
        const query = new URLSearchParams({
          reviewState,
          sortBy,
          sortDirection,
          page: String(pageNumber),
          pageSize: '25',
        });
        if (search.trim()) query.set('search', search.trim());
        if (sourceFilter !== 'ALL') query.set('source', sourceFilter);
        if (statusFilter !== 'ALL') query.set('status', statusFilter);

        const response = await fetch(
          `/api/admin/catalog/article-review?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(
            payload?.error?.message ?? 'Manufacturer Article review could not be loaded.',
          );
        }

        const nextPage = (await response.json()) as AdminArticleReviewPage;
        if (!active) return;
        setPageData(nextPage);
        if (nextPage.pageCount > 0 && pageNumber > nextPage.pageCount) {
          setPageNumber(nextPage.pageCount);
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Manufacturer Article review could not be loaded.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    canReview,
    pageNumber,
    reloadKey,
    reviewState,
    search,
    sortBy,
    sortDirection,
    sourceFilter,
    statusFilter,
  ]);

  const filtersActive =
    Boolean(search.trim()) ||
    reviewState !== 'AWAITING_REVIEW' ||
    sourceFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sortBy !== 'REVIEW_SUBMITTED_AT' ||
    sortDirection !== 'ASC';

  const awaitingCountOnPage = useMemo(
    () =>
      pageData.items.filter((article) => article.reviewState === 'AWAITING_REVIEW')
        .length,
    [pageData.items],
  );

  function resetFilters() {
    setSearch('');
    setReviewState('AWAITING_REVIEW');
    setSourceFilter('ALL');
    setStatusFilter('ALL');
    setSortBy('REVIEW_SUBMITTED_AT');
    setSortDirection('ASC');
    setPageNumber(1);
    setSelectedSavedViewId('');
    setSavedViewName('');
  }

  function currentSavedViewState(): Record<string, unknown> {
    return {
      search,
      reviewState,
      source: sourceFilter,
      status: statusFilter,
      sortBy,
      sortDirection,
    };
  }

  function applySavedView(view: AdminSavedViewRecord) {
    const state = view.state;
    setSearch(typeof state.search === 'string' ? state.search : '');
    setReviewState(
      isReviewState(state.reviewState)
        ? state.reviewState
        : 'AWAITING_REVIEW',
    );
    setSourceFilter(isSourceFilter(state.source) ? state.source : 'ALL');
    setStatusFilter(isStatusFilter(state.status) ? state.status : 'ALL');
    setSortBy(isSortBy(state.sortBy) ? state.sortBy : 'REVIEW_SUBMITTED_AT');
    setSortDirection(state.sortDirection === 'DESC' ? 'DESC' : 'ASC');
    setPageNumber(1);
    setSelectedSavedViewId(view.id);
    setSavedViewName(view.name);
    setSavedViewError('');
  }

  async function saveView() {
    const name = savedViewName.trim();
    if (!name) {
      setSavedViewError('Enter a name for the saved view.');
      return;
    }

    setSavedViewSaving(true);
    setSavedViewError('');
    try {
      const created = await postJson<AdminSavedViewRecord>(
        '/api/admin/preferences/saved-views',
        {
          scope: ARTICLE_REVIEW_SAVED_VIEW_SCOPE,
          name,
          state: currentSavedViewState(),
        },
      );
      setSavedViews((current) => [
        created,
        ...current.filter((view) => view.id !== created.id),
      ]);
      setSelectedSavedViewId(created.id);
      setSavedViewName(created.name);
    } catch (error) {
      setSavedViewError(
        error instanceof ClientApiError
          ? error.message
          : 'The current Article review view could not be saved.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function updateView() {
    const selected = savedViews.find(
      (view) => view.id === selectedSavedViewId,
    );
    const name = savedViewName.trim();
    if (!selected) {
      setSavedViewError('Choose a saved view to update.');
      return;
    }
    if (!name) {
      setSavedViewError('Saved view name is required.');
      return;
    }

    setSavedViewSaving(true);
    setSavedViewError('');
    try {
      const updated = await patchJson<AdminSavedViewRecord>(
        `/api/admin/preferences/saved-views/${selected.id}`,
        {
          version: selected.version,
          name,
          state: currentSavedViewState(),
        },
      );
      setSavedViews((current) =>
        current.map((view) => (view.id === updated.id ? updated : view)),
      );
      setSavedViewName(updated.name);
    } catch (error) {
      setSavedViewError(
        error instanceof ClientApiError
          ? error.message
          : 'The Article review saved view could not be updated.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function deleteView() {
    const selected = savedViews.find(
      (view) => view.id === selectedSavedViewId,
    );
    if (!selected) return;

    setSavedViewSaving(true);
    setSavedViewError('');
    try {
      const response = await fetch(
        `/api/admin/preferences/saved-views/${selected.id}?version=${selected.version}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          payload?.error?.message ?? 'The saved view could not be deleted.',
        );
      }
      setSavedViews((current) =>
        current.filter((view) => view.id !== selected.id),
      );
      setSelectedSavedViewId('');
      setSavedViewName('');
    } catch (error) {
      setSavedViewError(
        error instanceof Error
          ? error.message
          : 'The Article review saved view could not be deleted.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function approveArticle(article: AdminArticleReviewItem) {
    if (!article.canApprove) return;
    const confirmed = window.confirm(
      `Approve ${article.name} and activate this canonical Manufacturer Article?`,
    );
    if (!confirmed) return;

    setWorkingArticleId(article.id);
    setDecisionError('');
    setSuccessMessage('');
    try {
      await postJson(
        `/api/admin/catalog/article-review/${article.id}/approve`,
        { version: article.version },
      );
      setSuccessMessage(
        `${article.name} was approved and activated as a canonical Manufacturer Article.`,
      );
      setReloadKey((current) => current + 1);
    } catch (error) {
      setDecisionError(
        error instanceof ClientApiError
          ? error.message
          : 'The Manufacturer Article could not be approved.',
      );
    } finally {
      setWorkingArticleId('');
    }
  }

  function beginReturn(article: AdminArticleReviewItem) {
    setReturningArticleId(article.id);
    setReturnReason('');
    setDecisionError('');
    setSuccessMessage('');
  }

  async function returnToSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const article = pageData.items.find(
      (item) => item.id === returningArticleId,
    );
    const reason = returnReason.trim();
    if (!article || !article.canReturnToSeller || reason.length < 3) return;

    setWorkingArticleId(article.id);
    setDecisionError('');
    setSuccessMessage('');
    try {
      await postJson(
        `/api/admin/catalog/article-review/${article.id}/return`,
        {
          version: article.version,
          reason,
        },
      );
      setSuccessMessage(
        `${article.name} was returned to the Seller for correction.`,
      );
      setReturningArticleId('');
      setReturnReason('');
      setReloadKey((current) => current + 1);
    } catch (error) {
      setDecisionError(
        error instanceof ClientApiError
          ? error.message
          : 'The Manufacturer Article could not be returned to the Seller.',
      );
    } finally {
      setWorkingArticleId('');
    }
  }

  if (!canReview) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog governance"
          title="Manufacturer Article Review"
          description="Article review requires both catalog.manage and seller.manage because Seller-submission identity and catalog governance are reviewed together."
        />
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have both required permissions.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page article-review-page">
      <AdminPageHeader
        eyebrow="Catalog governance"
        title="Manufacturer Article Review"
        description="Review Seller-submitted Manufacturer Articles without editing seller-owned evidence. Approve only strict activation-ready Articles, or return the same Draft to the Seller with an audited correction reason."
        actions={
          <div className="article-review-header-status">
            <span className="catalog-count">
              {pageData.total} {pageData.total === 1 ? 'Article' : 'Articles'}
            </span>
            {reviewState === 'AWAITING_REVIEW' ? (
              <span className="roadmap-badge">
                {awaitingCountOnPage} awaiting on this page
              </span>
            ) : null}
          </div>
        }
      />

      <CatalogPrimaryNav active="article-review" />

      <div className="catalog-toolbar catalog-toolbar--filters article-review-toolbar">
        <div className="catalog-filter article-review-search">
          <label htmlFor="article-review-search">Search</label>
          <input
            id="article-review-search"
            type="search"
            value={search}
            placeholder="Article, MPN, Brand, Product Type, Seller, or UUID"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="article-review-state">Review state</label>
          <select
            id="article-review-state"
            value={reviewState}
            onChange={(event) => {
              setReviewState(event.target.value as AdminArticleReviewState);
              setPageNumber(1);
            }}
          >
            {reviewStates.map((state) => (
              <option value={state} key={state}>
                {reviewStateLabel(state)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="article-review-source">Source</label>
          <select
            id="article-review-source"
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value as SourceFilter);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All sources</option>
            {articleSources.map((source) => (
              <option value={source} key={source}>
                {formatAdminEnumLabel(source)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="article-review-status">Lifecycle</label>
          <select
            id="article-review-status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All lifecycle states</option>
            {articleStatuses.map((status) => (
              <option value={status} key={status}>
                {formatAdminEnumLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <AdminFilterResetButton active={filtersActive} onReset={resetFilters} />
      </div>

      <div className="catalog-toolbar catalog-toolbar--filters article-review-sortbar">
        <div className="catalog-filter">
          <label htmlFor="article-review-sort">Sort</label>
          <select
            id="article-review-sort"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as AdminArticleReviewSortBy);
              setPageNumber(1);
            }}
          >
            {sortOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="article-review-direction">Direction</label>
          <select
            id="article-review-direction"
            value={sortDirection}
            onChange={(event) => {
              setSortDirection(event.target.value as SortDirection);
              setPageNumber(1);
            }}
          >
            <option value="ASC">Oldest / A–Z first</option>
            <option value="DESC">Newest / Z–A first</option>
          </select>
        </div>
      </div>

      <AdminSavedViewsToolbar
        idPrefix="article-review"
        savedViews={savedViews}
        loading={savedViewsLoading}
        saving={savedViewSaving}
        selectedId={selectedSavedViewId}
        name={savedViewName}
        namePlaceholder="e.g. Seller submissions needing review"
        error={savedViewError}
        onSelect={(view) => {
          if (view) applySavedView(view);
          else {
            setSelectedSavedViewId('');
            setSavedViewName('');
          }
        }}
        onNameChange={setSavedViewName}
        onSaveAsNew={() => void saveView()}
        onUpdate={() => void updateView()}
        onDelete={() => void deleteView()}
      />

      {loadError ? (
        <div className="alert alert--error" role="alert">{loadError}</div>
      ) : null}
      {decisionError ? (
        <div className="alert alert--error" role="alert">{decisionError}</div>
      ) : null}
      {successMessage ? (
        <div className="alert alert--success" role="status">{successMessage}</div>
      ) : null}

      {loading ? (
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Evaluating Manufacturer Articles and activation readiness…</p>
        </div>
      ) : null}

      {!loading && !loadError && pageData.items.length === 0 ? (
        <div className="catalog-empty">
          <h3>No Manufacturer Articles match this view</h3>
          <p>
            Adjust the review state, source, lifecycle, or search filters.
          </p>
        </div>
      ) : null}

      {!loading && !loadError && pageData.items.length > 0 ? (
        <div className="article-review-list">
          <div className="article-review-list__header" aria-hidden="true">
            <span>Article identity</span>
            <span>Catalog context</span>
            <span>Source</span>
            <span>Readiness</span>
            <span>Decision</span>
          </div>

          {pageData.items.map((article) => {
            const working = workingArticleId === article.id;
            const returning = returningArticleId === article.id;
            return (
              <article className="article-review-row" key={article.id}>
                <div className="article-review-cell article-review-identity">
                  <strong>{article.name}</strong>
                  <span>
                    {article.brand?.name ?? 'Brand not supplied'} ·{' '}
                    {article.manufacturerPartNumber ?? 'MPN not supplied'}
                  </span>
                  <small>{article.id}</small>
                </div>

                <div className="article-review-cell">
                  <strong>{article.productType.name}</strong>
                  <span>{article.productType.code}</span>
                  <small>Schema v{article.schemaVersion}</small>
                </div>

                <div className="article-review-cell">
                  <strong>{formatAdminEnumLabel(article.articleSource)}</strong>
                  <span>
                    {article.sourceSeller
                      ? `${article.sourceSeller.displayName} · ${article.sourceSeller.sellerCode}`
                      : 'Platform / approved source'}
                  </span>
                  <small>
                    {article.catalogReviewSubmittedAt
                      ? `Review submitted ${formatDateTime(article.catalogReviewSubmittedAt)}`
                      : `Updated ${formatDateTime(article.updatedAt)}`}
                  </small>
                </div>

                <div className="article-review-cell article-review-readiness">
                  <div className="article-review-state-line">
                    <span className={`article-review-state article-review-state--${article.reviewState.toLowerCase().replaceAll('_', '-')}`}>
                      {reviewStateLabel(article.reviewState)}
                    </span>
                    <span className={`article-review-score article-review-score--${article.qualityBand.toLowerCase()}`}>
                      {article.qualityScore}/100
                    </span>
                  </div>
                  <strong>
                    {article.readyForActivation
                      ? 'Ready for activation'
                      : `${article.issues.length} activation blocker${article.issues.length === 1 ? '' : 's'}`}
                  </strong>
                  <span>
                    {article.summary.identifierCount} identifiers ·{' '}
                    {article.summary.oeReferenceCount} OE ·{' '}
                    {article.summary.verifiedFitmentCount} verified fitments ·{' '}
                    {article.summary.imageCount} images
                  </span>
                  {article.issues.length > 0 ? (
                    <details className="article-review-issues">
                      <summary>Review blockers</summary>
                      <ul>
                        {article.issues.map((issue) => (
                          <li key={`${issue.code}:${issue.attributeCode ?? ''}`}>
                            <strong>{formatAdminEnumLabel(issue.area)}</strong>
                            <span>{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>

                <div className="article-review-cell article-review-actions">
                  {article.canApprove ? (
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={working}
                      onClick={() => void approveArticle(article)}
                    >
                      {working ? 'Working…' : 'Approve'}
                    </button>
                  ) : article.reviewState === 'AWAITING_REVIEW' ? (
                    <span className="article-review-action-note">
                      Resolve activation blockers before approval.
                    </span>
                  ) : null}

                  {article.canReturnToSeller ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={working}
                      onClick={() => beginReturn(article)}
                    >
                      Return to seller
                    </button>
                  ) : null}

                  <a
                    className="button button--quiet"
                    href={`/admin/catalog/article-review/${article.id}`}
                  >
                    Inspect
                  </a>

                  {canReadAudit ? (
                    <a
                      className="button button--quiet"
                      href={articleAuditHref(article.id)}
                    >
                      Audit
                    </a>
                  ) : null}

                  {article.status === 'ACTIVE' ? (
                    <span className="article-review-action-note">
                      Published {article.publishedAt ? formatDateTime(article.publishedAt) : ''}
                    </span>
                  ) : null}
                </div>

                {returning ? (
                  <form
                    className="article-review-return"
                    onSubmit={(event) => void returnToSeller(event)}
                  >
                    <div>
                      <strong>Return this Article for Seller correction</strong>
                      <p>
                        The Article stays Draft, the review lock is removed, and this reason is recorded in Audit History.
                      </p>
                    </div>
                    <label className="field">
                      <span className="field__label">Correction reason</span>
                      <div className="field__control">
                        <textarea
                          value={returnReason}
                          maxLength={500}
                          rows={3}
                          placeholder="Explain exactly what the Seller must correct or verify."
                          autoFocus
                          onChange={(event) => setReturnReason(event.target.value)}
                        />
                      </div>
                    </label>
                    <div className="article-review-return__actions">
                      <button
                        className="button button--primary"
                        type="submit"
                        disabled={working || returnReason.trim().length < 3}
                      >
                        {working ? 'Returning…' : 'Return for correction'}
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        disabled={working}
                        onClick={() => {
                          setReturningArticleId('');
                          setReturnReason('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {!loadError && pageData.total > 0 ? (
        <div className="catalog-pagination">
          <button
            className="button button--quiet"
            type="button"
            disabled={loading || pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>
            Page {pageData.pageCount === 0 ? 0 : pageData.page} of{' '}
            {pageData.pageCount} · {pageData.total} total
          </span>
          <button
            className="button button--quiet"
            type="button"
            disabled={
              loading ||
              pageData.pageCount === 0 ||
              pageNumber >= pageData.pageCount
            }
            onClick={() => setPageNumber((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function reviewStateLabel(state: AdminArticleReviewState): string {
  switch (state) {
    case 'AWAITING_REVIEW':
      return 'Awaiting review';
    case 'SELLER_DRAFT':
      return 'Seller draft';
    case 'DRAFT':
      return 'Draft';
    case 'ACTIVE':
      return 'Active';
    case 'INACTIVE':
      return 'Inactive';
    case 'DEPRECATED':
      return 'Deprecated';
    case 'ARCHIVED':
      return 'Archived';
    case 'ALL':
      return 'All Article states';
  }
}

function isReviewState(value: unknown): value is AdminArticleReviewState {
  return typeof value === 'string' && reviewStates.includes(value as AdminArticleReviewState);
}

function isSourceFilter(value: unknown): value is SourceFilter {
  return value === 'ALL' || (
    typeof value === 'string' && articleSources.includes(value as ArticleSource)
  );
}

function isStatusFilter(value: unknown): value is StatusFilter {
  return value === 'ALL' || (
    typeof value === 'string' && articleStatuses.includes(value as ProductStatus)
  );
}

function isSortBy(value: unknown): value is AdminArticleReviewSortBy {
  return typeof value === 'string' &&
    sortOptions.some((option) => option.value === value);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function articleAuditHref(articleId: string): string {
  return `/admin/audit?${new URLSearchParams({
    entityType: 'Product',
    entityId: articleId,
  }).toString()}`;
}
