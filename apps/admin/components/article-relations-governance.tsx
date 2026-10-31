'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ArticleRelationArticle,
  ArticleRelationCandidatePage,
  ArticleRelationGovernancePage,
  ArticleRelationGovernanceRow,
  ArticleRelationGovernanceSummary,
  ArticleRelationType,
} from '@/lib/article-relation-governance-contracts';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { useAdminPrincipal } from './admin-session';

type StatusFilter = 'ALL' | MasterDataStatus;

const relationTypes: ArticleRelationType[] = [
  'SUPERSEDES',
  'INTERCHANGEABLE',
  'ACCESSORY',
  'REPAIR_KIT',
  'CONTAINS',
  'CONTAINED_IN',
  'PAIRED_WITH',
  'RELATED',
];

const createStatuses: MasterDataStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE'];
const updateStatuses: MasterDataStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'DEPRECATED',
  'ARCHIVED',
];

const EMPTY_PAGE: ArticleRelationGovernancePage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 0,
};

const EMPTY_CANDIDATES: ArticleRelationCandidatePage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  pageCount: 0,
};

export function ArticleRelationsGovernance({
  initialArticleId = '',
}: {
  initialArticleId?: string;
}) {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');
  const canInspect =
    canManage && principal.permissions.includes('seller.manage');
  const canReadAudit = principal.permissions.includes('admin.audit.read');

  const [summary, setSummary] =
    useState<ArticleRelationGovernanceSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');

  const [pageData, setPageData] =
    useState<ArticleRelationGovernancePage>(EMPTY_PAGE);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ArticleRelationType>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [articleFilter, setArticleFilter] = useState(initialArticleId);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceCandidates, setSourceCandidates] =
    useState<ArticleRelationCandidatePage>(EMPTY_CANDIDATES);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [selectedSource, setSelectedSource] =
    useState<ArticleRelationArticle | null>(null);
  const [relationType, setRelationType] =
    useState<ArticleRelationType>('SUPERSEDES');
  const [targetSearch, setTargetSearch] = useState('');
  const [targetCandidates, setTargetCandidates] =
    useState<ArticleRelationCandidatePage>(EMPTY_CANDIDATES);
  const [targetLoading, setTargetLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] =
    useState<ArticleRelationArticle | null>(null);
  const [createStatus, setCreateStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [note, setNote] = useState('');
  const [componentQuantity, setComponentQuantity] = useState('');
  const [componentRole, setComponentRole] = useState('');
  const [componentOrder, setComponentOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [editId, setEditId] = useState('');
  const [editStatus, setEditStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [editNote, setEditNote] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editOrder, setEditOrder] = useState('');

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    void (async () => {
      try {
        setSummaryError('');
        const response = await fetch(
          '/api/admin/catalog/article-relations/summary',
          { credentials: 'same-origin', cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error('Article relation summary could not be loaded.');
        }
        const next = (await response.json()) as ArticleRelationGovernanceSummary;
        if (active) setSummary(next);
      } catch (error) {
        if (active) {
          setSummaryError(
            error instanceof Error
              ? error.message
              : 'Article relation summary could not be loaded.',
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [canManage, reloadKey]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setLoadError('');
        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: '25',
        });
        if (search.trim()) query.set('search', search.trim());
        if (articleFilter) query.set('articleId', articleFilter);
        if (typeFilter !== 'ALL') query.set('type', typeFilter);
        if (statusFilter !== 'ALL') query.set('status', statusFilter);

        const response = await fetch(
          `/api/admin/catalog/article-relations?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error('Article relations could not be loaded.');
        }
        const next = (await response.json()) as ArticleRelationGovernancePage;
        if (!active) return;
        setPageData(next);
        if (next.pageCount > 0 && pageNumber > next.pageCount) {
          setPageNumber(next.pageCount);
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Article relations could not be loaded.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    articleFilter,
    canManage,
    pageNumber,
    reloadKey,
    search,
    statusFilter,
    typeFilter,
  ]);

  useEffect(() => {
    if (!createOpen || selectedSource || !initialArticleId || !canManage) return;

    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/catalog/article-relations/candidates?${new URLSearchParams({
            search: initialArticleId,
            page: '1',
            pageSize: '5',
          }).toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const page = (await response.json()) as ArticleRelationCandidatePage;
        const exact = page.items.find((item) => item.id === initialArticleId);
        if (active && exact) {
          setSelectedSource(exact);
          setSourceSearch('');
        }
      } catch {
        // The source picker remains available for manual selection.
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canManage, createOpen, initialArticleId, selectedSource]);

  useEffect(() => {
    if (!createOpen || selectedSource || !canManage) return;
    const queryText = sourceSearch.trim();
    if (queryText.length < 2) {
      setSourceCandidates(EMPTY_CANDIDATES);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSourceLoading(true);
        const response = await fetch(
          `/api/admin/catalog/article-relations/candidates?${new URLSearchParams({
            search: queryText,
            page: '1',
            pageSize: '12',
          }).toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error();
        const next = (await response.json()) as ArticleRelationCandidatePage;
        if (active) setSourceCandidates(next);
      } catch {
        if (active) setSourceCandidates(EMPTY_CANDIDATES);
      } finally {
        if (active) setSourceLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canManage, createOpen, selectedSource, sourceSearch]);

  useEffect(() => {
    setSelectedTarget(null);
    setTargetSearch('');
    setTargetCandidates(EMPTY_CANDIDATES);
  }, [relationType, selectedSource?.id]);

  useEffect(() => {
    if (!createOpen || !selectedSource || selectedTarget || !canManage) return;
    const queryText = targetSearch.trim();
    if (queryText.length < 2) {
      setTargetCandidates(EMPTY_CANDIDATES);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setTargetLoading(true);
        const query = new URLSearchParams({
          search: queryText,
          sourceArticleId: selectedSource.id,
          type: relationType,
          page: '1',
          pageSize: '12',
        });
        const response = await fetch(
          `/api/admin/catalog/article-relations/candidates?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error();
        const next = (await response.json()) as ArticleRelationCandidatePage;
        if (active) setTargetCandidates(next);
      } catch {
        if (active) setTargetCandidates(EMPTY_CANDIDATES);
      } finally {
        if (active) setTargetLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    canManage,
    createOpen,
    relationType,
    selectedSource,
    selectedTarget,
    targetSearch,
  ]);

  const filtersActive =
    Boolean(search.trim()) ||
    Boolean(articleFilter) ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const componentRelation =
    relationType === 'CONTAINS' || relationType === 'CONTAINED_IN';

  function resetFilters() {
    setSearch('');
    setArticleFilter('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setPageNumber(1);
  }

  function resetCreateForm() {
    setSelectedSource(null);
    setSourceSearch('');
    setSourceCandidates(EMPTY_CANDIDATES);
    setRelationType('SUPERSEDES');
    setSelectedTarget(null);
    setTargetSearch('');
    setTargetCandidates(EMPTY_CANDIDATES);
    setCreateStatus('DRAFT');
    setNote('');
    setComponentQuantity('');
    setComponentRole('');
    setComponentOrder('');
  }

  async function createRelation() {
    if (!selectedSource || !selectedTarget) return;
    setSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const body: Record<string, unknown> = {
        sourceArticleId: selectedSource.id,
        targetArticleId: selectedTarget.id,
        type: relationType,
        status: createStatus,
      };
      if (note.trim()) body.note = note.trim();
      if (componentRelation) {
        if (componentQuantity.trim()) {
          body.componentQuantity = Number(componentQuantity);
        }
        if (componentRole.trim()) body.componentRole = componentRole.trim();
        if (componentOrder.trim()) body.componentOrder = Number(componentOrder);
      }

      await postJson('/api/admin/catalog/article-relations', body);
      setSuccessMessage(
        `${formatAdminEnumLabel(relationType)} relation created successfully.`,
      );
      setCreateOpen(false);
      resetCreateForm();
      setReloadKey((current) => current + 1);
    } catch (error) {
      setActionError(
        error instanceof ClientApiError
          ? error.message
          : 'The Article relation could not be created.',
      );
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(row: ArticleRelationGovernanceRow) {
    setEditId(row.id);
    setEditStatus(row.status);
    setEditNote(row.note ?? '');
    setEditQuantity(
      row.componentQuantity === null ? '' : String(row.componentQuantity),
    );
    setEditRole(row.componentRole ?? '');
    setEditOrder(row.componentOrder === null ? '' : String(row.componentOrder));
    setActionError('');
    setSuccessMessage('');
  }

  async function saveEdit(row: ArticleRelationGovernanceRow) {
    setSaving(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const body: Record<string, unknown> = {
        version: row.version,
        status: editStatus,
        note: editNote.trim() || null,
      };
      if (isComponentType(row.type)) {
        body.componentQuantity = editQuantity.trim()
          ? Number(editQuantity)
          : null;
        body.componentRole = editRole.trim() || null;
        body.componentOrder = editOrder.trim() ? Number(editOrder) : null;
      }

      await patchJson(
        `/api/admin/catalog/article-relations/${row.id}`,
        body,
      );
      setSuccessMessage('Article relation updated successfully.');
      setEditId('');
      setReloadKey((current) => current + 1);
    } catch (error) {
      setActionError(
        error instanceof ClientApiError
          ? error.message
          : 'The Article relation could not be updated.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog governance"
          title="Article Relations & Supersession"
          description="Article relation governance requires catalog.manage."
        />
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have catalog.manage.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page article-relations-page">
      <AdminPageHeader
        eyebrow="Canonical Article graph"
        title="Article Relations & Supersession"
        description="Govern replacement chains, interchangeability, accessories, repair kits, structured kit contents and related Manufacturer Articles. Relation semantics are validated server-side and every change is audited."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              setCreateOpen((current) => !current);
              setActionError('');
              setSuccessMessage('');
            }}
          >
            {createOpen ? 'Close relation form' : 'Create relation'}
          </button>
        }
      />

      <CatalogPrimaryNav active="article-relations" />

      {summaryError ? (
        <div className="alert alert--error" role="alert">{summaryError}</div>
      ) : null}

      {summary ? (
        <div className="article-relations-summary">
          <SummaryCard label="Live relations" value={summary.liveRelations} />
          <SummaryCard
            label="Supersession"
            value={summary.supersessionRelations}
          />
          <SummaryCard
            label="Active supersession"
            value={summary.activeSupersessions}
          />
          <SummaryCard label="Draft relations" value={summary.draftRelations} />
          <SummaryCard
            label="Kit/component"
            value={summary.componentRelations}
          />
        </div>
      ) : null}

      {createOpen ? (
        <section className="catalog-card article-relation-create">
          <div className="catalog-section-heading">
            <div>
              <span className="eyebrow">Governed relation</span>
              <h2>Create Article relation</h2>
              <p>{relationRuleHelp(relationType)}</p>
            </div>
          </div>

          <div className="article-relation-create-grid">
            <ArticlePicker
              label={sourceRoleLabel(relationType)}
              selected={selectedSource}
              search={sourceSearch}
              loading={sourceLoading}
              candidates={sourceCandidates.items}
              placeholder="Search Brand, MPN, Article, Product Type or UUID"
              onSearchChange={setSourceSearch}
              onSelect={(article) => {
                setSelectedSource(article);
                setSourceSearch('');
              }}
              onClear={() => {
                setSelectedSource(null);
                setSourceSearch('');
              }}
            />

            <label className="field">
              <span className="field__label">Relation type</span>
              <div className="field__control">
                <select
                  value={relationType}
                  onChange={(event) =>
                    setRelationType(event.target.value as ArticleRelationType)
                  }
                >
                  {relationTypes.map((type) => (
                    <option value={type} key={type}>
                      {formatAdminEnumLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <ArticlePicker
              label={targetRoleLabel(relationType)}
              selected={selectedTarget}
              search={targetSearch}
              loading={targetLoading}
              candidates={targetCandidates.items}
              placeholder={
                selectedSource
                  ? 'Search compatible target Article'
                  : 'Choose source Article first'
              }
              disabled={!selectedSource}
              onSearchChange={setTargetSearch}
              onSelect={(article) => {
                setSelectedTarget(article);
                setTargetSearch('');
              }}
              onClear={() => {
                setSelectedTarget(null);
                setTargetSearch('');
              }}
            />

            <label className="field">
              <span className="field__label">Lifecycle</span>
              <div className="field__control">
                <select
                  value={createStatus}
                  onChange={(event) =>
                    setCreateStatus(event.target.value as MasterDataStatus)
                  }
                >
                  {createStatuses.map((status) => (
                    <option value={status} key={status}>
                      {formatAdminEnumLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          {componentRelation ? (
            <div className="article-relation-component-grid">
              <label className="field">
                <span className="field__label">Component quantity</span>
                <div className="field__control">
                  <input
                    type="number"
                    min="0.001"
                    max="9999999.999"
                    step="0.001"
                    value={componentQuantity}
                    onChange={(event) => setComponentQuantity(event.target.value)}
                    placeholder="Required when Active"
                  />
                </div>
              </label>
              <label className="field">
                <span className="field__label">Component role</span>
                <div className="field__control">
                  <input
                    value={componentRole}
                    maxLength={120}
                    onChange={(event) => setComponentRole(event.target.value)}
                    placeholder="e.g. seal, fastener, left-side component"
                  />
                </div>
              </label>
              <label className="field">
                <span className="field__label">Display / assembly order</span>
                <div className="field__control">
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    value={componentOrder}
                    onChange={(event) => setComponentOrder(event.target.value)}
                  />
                </div>
              </label>
            </div>
          ) : null}

          <label className="field">
            <span className="field__label">Governance note</span>
            <div className="field__control">
              <textarea
                value={note}
                maxLength={500}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional reason, manufacturer bulletin, replacement note, or kit context."
              />
            </div>
          </label>

          <div className="article-relation-create-actions">
            <button
              className="button button--primary"
              type="button"
              disabled={saving || !selectedSource || !selectedTarget}
              onClick={() => void createRelation()}
            >
              {saving ? 'Creating…' : 'Create relation'}
            </button>
            <button
              className="button button--quiet"
              type="button"
              disabled={saving}
              onClick={resetCreateForm}
            >
              Reset
            </button>
          </div>
        </section>
      ) : null}

      {actionError ? (
        <div className="alert alert--error" role="alert">{actionError}</div>
      ) : null}
      {successMessage ? (
        <div className="alert alert--success" role="status">{successMessage}</div>
      ) : null}

      <div className="catalog-toolbar catalog-toolbar--filters article-relations-toolbar">
        <div className="catalog-filter article-relations-search">
          <label htmlFor="article-relations-search">Search relations</label>
          <input
            id="article-relations-search"
            type="search"
            value={search}
            placeholder="Brand, MPN, Article, Product Type, note or UUID"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="article-relation-type-filter">Type</label>
          <select
            id="article-relation-type-filter"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(
                event.target.value as 'ALL' | ArticleRelationType,
              );
              setPageNumber(1);
            }}
          >
            <option value="ALL">All relation types</option>
            {relationTypes.map((type) => (
              <option value={type} key={type}>
                {formatAdminEnumLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="article-relation-status-filter">Lifecycle</label>
          <select
            id="article-relation-status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPageNumber(1);
            }}
          >
            <option value="ALL">Not archived</option>
            {updateStatuses.map((status) => (
              <option value={status} key={status}>
                {formatAdminEnumLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <AdminFilterResetButton active={filtersActive} onReset={resetFilters} />
      </div>

      {articleFilter ? (
        <div className="article-relations-context-filter">
          <span>Showing relations connected to Article {articleFilter}</span>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => {
              setArticleFilter('');
              setPageNumber(1);
            }}
          >
            Show all relations
          </button>
        </div>
      ) : null}

      {loadError ? (
        <div className="alert alert--error" role="alert">{loadError}</div>
      ) : null}

      {loading ? (
        <div className="catalog-state">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading Article relations…</p>
        </div>
      ) : null}

      {!loading && !loadError && pageData.items.length === 0 ? (
        <div className="catalog-empty">
          <h3>No Article relations match this view</h3>
          <p>Adjust the filters or create the first governed relation.</p>
        </div>
      ) : null}

      {!loading && !loadError && pageData.items.length > 0 ? (
        <div className="article-relations-list">
          {pageData.items.map((row) => {
            const editing = editId === row.id;
            return (
              <article className="article-relation-row" key={row.id}>
                <div className="article-relation-row__top">
                  <div className="article-relation-type">
                    <span>{formatAdminEnumLabel(row.type)}</span>
                    <small>{relationDirectionLabel(row.type)}</small>
                  </div>

                  <ArticleIdentity
                    role={sourceRoleLabel(row.type)}
                    article={row.sourceArticle}
                  />

                  <span className="article-relation-arrow" aria-hidden="true">
                    →
                  </span>

                  <ArticleIdentity
                    role={targetRoleLabel(row.type)}
                    article={row.targetArticle}
                  />

                  <div className="article-relation-state">
                    <span>{formatAdminEnumLabel(row.status)}</span>
                    <small>v{row.version} · {formatDateTime(row.updatedAt)}</small>
                  </div>

                  <div className="article-relation-actions">
                    {canInspect ? (
                      <>
                        <a
                          className="button button--quiet"
                          href={`/admin/catalog/article-review/${row.sourceArticle.id}#relations`}
                        >
                          Source
                        </a>
                        <a
                          className="button button--quiet"
                          href={`/admin/catalog/article-review/${row.targetArticle.id}#relations`}
                        >
                          Target
                        </a>
                      </>
                    ) : null}
                    {canReadAudit ? (
                      <a
                        className="button button--quiet"
                        href={`/admin/audit?${new URLSearchParams({
                          entityType: 'ArticleRelation',
                          entityId: row.id,
                        }).toString()}`}
                      >
                        Audit
                      </a>
                    ) : null}
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() =>
                        editing ? setEditId('') : beginEdit(row)
                      }
                    >
                      {editing ? 'Cancel edit' : 'Edit relation'}
                    </button>
                  </div>
                </div>

                {(row.note || isComponentType(row.type)) && !editing ? (
                  <div className="article-relation-row__detail">
                    {row.note ? <p>{row.note}</p> : null}
                    {isComponentType(row.type) ? (
                      <div>
                        <span>
                          Qty {row.componentQuantity ?? '—'}
                        </span>
                        <span>{row.componentRole ?? 'No role'}</span>
                        <span>
                          Order {row.componentOrder ?? '—'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {editing ? (
                  <div className="article-relation-edit">
                    <label className="field">
                      <span className="field__label">Lifecycle</span>
                      <div className="field__control">
                        <select
                          value={editStatus}
                          onChange={(event) =>
                            setEditStatus(
                              event.target.value as MasterDataStatus,
                            )
                          }
                        >
                          {updateStatuses.map((status) => (
                            <option value={status} key={status}>
                              {formatAdminEnumLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    {isComponentType(row.type) ? (
                      <>
                        <label className="field">
                          <span className="field__label">Quantity</span>
                          <div className="field__control">
                            <input
                              type="number"
                              min="0.001"
                              max="9999999.999"
                              step="0.001"
                              value={editQuantity}
                              onChange={(event) =>
                                setEditQuantity(event.target.value)
                              }
                            />
                          </div>
                        </label>
                        <label className="field">
                          <span className="field__label">Role</span>
                          <div className="field__control">
                            <input
                              value={editRole}
                              maxLength={120}
                              onChange={(event) =>
                                setEditRole(event.target.value)
                              }
                            />
                          </div>
                        </label>
                        <label className="field">
                          <span className="field__label">Order</span>
                          <div className="field__control">
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              step="1"
                              value={editOrder}
                              onChange={(event) =>
                                setEditOrder(event.target.value)
                              }
                            />
                          </div>
                        </label>
                      </>
                    ) : null}

                    <label className="field article-relation-edit__note">
                      <span className="field__label">Governance note</span>
                      <div className="field__control">
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={editNote}
                          onChange={(event) => setEditNote(event.target.value)}
                        />
                      </div>
                    </label>

                    <div className="article-relation-edit__actions">
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={saving}
                        onClick={() => void saveEdit(row)}
                      >
                        {saving ? 'Saving…' : 'Save relation'}
                      </button>
                      <small>
                        Type and Article endpoints are immutable. Archive and recreate
                        if the relationship itself is wrong.
                      </small>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <Pager
        page={pageData.page}
        pageCount={pageData.pageCount}
        disabled={loading}
        onPrevious={() =>
          setPageNumber((current) => Math.max(1, current - 1))
        }
        onNext={() => setPageNumber((current) => current + 1)}
      />
    </section>
  );
}

function ArticlePicker({
  label,
  selected,
  search,
  loading,
  candidates,
  placeholder,
  disabled = false,
  onSearchChange,
  onSelect,
  onClear,
}: {
  label: string;
  selected: ArticleRelationArticle | null;
  search: string;
  loading: boolean;
  candidates: ArticleRelationArticle[];
  placeholder: string;
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (article: ArticleRelationArticle) => void;
  onClear: () => void;
}) {
  return (
    <div className="article-relation-picker">
      <span className="field__label">{label}</span>
      {selected ? (
        <div className="article-relation-picker__selected">
          <ArticleIdentity role={label} article={selected} compact />
          <button
            className="button button--quiet"
            type="button"
            onClick={onClear}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={search}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {loading ? (
            <small className="article-relation-picker__hint">Searching…</small>
          ) : null}
          {search.trim().length >= 2 && candidates.length === 0 && !loading ? (
            <small className="article-relation-picker__hint">
              No matching Manufacturer Articles.
            </small>
          ) : null}
          {candidates.length > 0 ? (
            <div className="article-relation-picker__results">
              {candidates.map((article) => (
                <button
                  type="button"
                  onClick={() => onSelect(article)}
                  key={article.id}
                >
                  <ArticleIdentity role="" article={article} compact />
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ArticleIdentity({
  role,
  article,
  compact = false,
}: {
  role: string;
  article: ArticleRelationArticle;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'article-relation-identity is-compact' : 'article-relation-identity'}>
      {role ? <span>{role}</span> : null}
      <strong>
        {article.brand?.name ? `${article.brand.name} · ` : ''}
        {article.manufacturerPartNumber
          ? `${article.manufacturerPartNumber} · `
          : ''}
        {article.name}
      </strong>
      <small>
        {article.productType.name} · {formatAdminEnumLabel(article.status)}
      </small>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
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

function isComponentType(type: ArticleRelationType): boolean {
  return type === 'CONTAINS' || type === 'CONTAINED_IN';
}

function sourceRoleLabel(type: ArticleRelationType): string {
  if (type === 'SUPERSEDES') return 'Replacement Article';
  if (type === 'CONTAINS') return 'Container / kit Article';
  if (type === 'CONTAINED_IN') return 'Component Article';
  return 'Source Article';
}

function targetRoleLabel(type: ArticleRelationType): string {
  if (type === 'SUPERSEDES') return 'Superseded Article';
  if (type === 'CONTAINS') return 'Component Article';
  if (type === 'CONTAINED_IN') return 'Container / kit Article';
  return 'Target Article';
}

function relationDirectionLabel(type: ArticleRelationType): string {
  if (type === 'SUPERSEDES') return 'Replacement → superseded';
  if (type === 'CONTAINS') return 'Kit/container → component';
  if (type === 'CONTAINED_IN') return 'Component → kit/container';
  return 'Source → target';
}

function relationRuleHelp(type: ArticleRelationType): string {
  switch (type) {
    case 'SUPERSEDES':
      return 'Replacement and superseded Articles must use the same Manufacturer Brand and Product Type. Active supersession requires the replacement to be Active and the superseded Article to be Active or Deprecated. Circular replacement chains are rejected.';
    case 'INTERCHANGEABLE':
      return 'Interchangeable Articles must use the same Product Type. Active relations require both Articles to be Active.';
    case 'CONTAINS':
    case 'CONTAINED_IN':
      return 'Kit/component relations support quantity, role and order. Active component relations require a positive quantity, and circular containment is rejected.';
    default:
      return 'Active relations require both Manufacturer Articles to be Active. Duplicate relation keys are rejected and every change is audited.';
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
