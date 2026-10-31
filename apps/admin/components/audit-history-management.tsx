'use client';

import { useEffect, useState } from 'react';
import type {
  AuditEntityHistory,
  AuditLogPage,
  AuditLogRecord,
} from '@/lib/audit-contracts';
import { useAdminPrincipal } from './admin-session';
import { AdminPageHeader } from './admin-page-header';

export function AuditHistoryManagement({
  initialEntityType = '',
  initialEntityId = '',
}: {
  initialEntityType?: string;
  initialEntityId?: string;
}) {
  const principal = useAdminPrincipal();
  const canRead = principal.permissions.includes('admin.audit.read');

  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState(initialEntityType);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [entityHistory, setEntityHistory] =
    useState<AuditEntityHistory | null>(null);
  const [entityHistoryLoading, setEntityHistoryLoading] = useState(false);
  const [entityHistoryError, setEntityHistoryError] = useState('');

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setLoadError('');

        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: '50',
        });
        const values = {
          search: search.trim(),
          action: action.trim(),
          entityType: entityType.trim(),
          entityId: entityId.trim(),
          actor: actor.trim(),
        };

        for (const [key, value] of Object.entries(values)) {
          if (value) query.set(key, value);
        }
        if (from) query.set('from', new Date(from).toISOString());
        if (to) query.set('to', new Date(to).toISOString());

        const response = await fetch(
          `/api/admin/audit?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(
            body?.error?.message ?? 'Audit History could not be loaded.',
          );
        }

        const page = (await response.json()) as AuditLogPage;
        if (!active) return;

        setRecords(page.items);
        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Audit History could not be loaded.',
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
    action,
    actor,
    canRead,
    entityId,
    entityType,
    from,
    pageNumber,
    search,
    to,
  ]);

  useEffect(() => {
    const normalizedType = entityType.trim();
    const normalizedId = entityId.trim();
    if (!canRead || !normalizedType || !normalizedId) {
      setEntityHistory(null);
      setEntityHistoryError('');
      setEntityHistoryLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setEntityHistoryLoading(true);
        setEntityHistoryError('');
        const response = await fetch(
          `/api/admin/audit/entities/${encodeURIComponent(normalizedType)}/${encodeURIComponent(normalizedId)}/history?includeRelated=true&limit=100`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(
            body?.error?.message ??
              'Entity version history could not be loaded.',
          );
        }

        const history = (await response.json()) as AuditEntityHistory;
        if (active) setEntityHistory(history);
      } catch (error) {
        if (active) {
          setEntityHistory(null);
          setEntityHistoryError(
            error instanceof Error
              ? error.message
              : 'Entity version history could not be loaded.',
          );
        }
      } finally {
        if (active) setEntityHistoryLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [canRead, entityId, entityType]);

  function clearFilters() {
    setSearch('');
    setAction('');
    setEntityType('');
    setEntityId('');
    setActor('');
    setFrom('');
    setTo('');
    setPageNumber(1);
  }

  const filtersActive = Boolean(
    search || action || entityType || entityId || actor || from || to,
  );

  if (!canRead) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Administration</span>
        <h1>Audit History</h1>
        <div className="catalog-state" role="alert">
          <p>
            Your administrator account does not have the admin.audit.read
            permission.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page audit-history-page">
      <AdminPageHeader
        eyebrow="Administration"
        title="Audit History"
        description="Review immutable platform changes by actor, action, entity and time. Audit History is read-only; operational changes remain in their owning Admin workspaces."
        actions={
          <span className="catalog-count">
            {total} {total === 1 ? 'event' : 'events'}
          </span>
        }
      />

      <div className="catalog-toolbar catalog-toolbar--filters">
        <div className="catalog-filter">
          <label htmlFor="audit-search">Search</label>
          <input
            id="audit-search"
            type="search"
            value={search}
            placeholder="Action, entity, ID, actor name or email"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="audit-action">Action</label>
          <input
            id="audit-action"
            value={action}
            placeholder="PRODUCT_TYPE_SCHEMA_PUBLISHED"
            onChange={(event) => {
              setAction(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="audit-entity-type">Entity type</label>
          <input
            id="audit-entity-type"
            value={entityType}
            placeholder="VehicleConfiguration"
            onChange={(event) => {
              setEntityType(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="audit-actor">Actor</label>
          <input
            id="audit-actor"
            value={actor}
            placeholder="Admin name or email"
            onChange={(event) => {
              setActor(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        {filtersActive ? (
          <button
            className="button button--quiet"
            type="button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <details className="catalog-workspace-advanced audit-history-advanced">
        <summary>Advanced filters</summary>
        <div className="audit-history-advanced__grid">
          <label className="field">
            <span className="field__label">Exact entity ID</span>
            <div className="field__control">
              <input
                value={entityId}
                placeholder="UUID or canonical entity identifier"
                onChange={(event) => {
                  setEntityId(event.target.value);
                  setPageNumber(1);
                }}
              />
            </div>
          </label>

          <label className="field">
            <span className="field__label">From</span>
            <div className="field__control">
              <input
                type="datetime-local"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPageNumber(1);
                }}
              />
            </div>
          </label>

          <label className="field">
            <span className="field__label">To</span>
            <div className="field__control">
              <input
                type="datetime-local"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPageNumber(1);
                }}
              />
            </div>
          </label>
        </div>
      </details>

      {entityType.trim() && entityId.trim() ? (
        <section className="catalog-card audit-entity-history" aria-live="polite">
          <div className="catalog-section-heading">
            <div>
              <span className="eyebrow">Entity timeline</span>
              <h2>Version history</h2>
              <p>
                Direct changes plus related catalog identity, criteria, schema
                and fitment events for this exact entity.
              </p>
            </div>
          </div>

          {entityHistoryLoading ? (
            <div className="catalog-state">
              <span className="spinner spinner--dark" aria-hidden="true" />
              <p>Loading entity history…</p>
            </div>
          ) : null}

          {entityHistoryError ? (
            <div className="alert alert--error" role="alert">
              {entityHistoryError}
            </div>
          ) : null}

          {!entityHistoryLoading &&
          !entityHistoryError &&
          entityHistory?.items.length === 0 ? (
            <div className="catalog-empty">
              <h3>No version events found</h3>
              <p>This entity has no recorded audit history yet.</p>
            </div>
          ) : null}

          {!entityHistoryLoading &&
          !entityHistoryError &&
          entityHistory &&
          entityHistory.items.length > 0 ? (
            <div className="audit-history-list" role="list" aria-label="Entity audit events">
              {entityHistory.items.map((item) => (
                <article className="audit-history-row" role="listitem" key={item.id}>
                  <div className="audit-history-row__action" role="cell">
                    <strong>{formatAction(item.action)}</strong>
                    <span>
                      {item.scope === 'RELATED'
                        ? `Related · ${item.entityType}`
                        : item.entityType}
                    </span>
                  </div>

                  <div className="audit-history-row__entity" role="cell">
                    <small>Version</small>
                    <strong>
                      {formatVersionTransition(
                        item.versionBefore,
                        item.versionAfter,
                      )}
                    </strong>
                    <span>
                      {formatLifecycleTransition(
                        item.lifecycleBefore,
                        item.lifecycleAfter,
                      )}
                    </span>
                  </div>

                  <div className="audit-history-row__actor" role="cell">
                    <small>Changed by</small>
                    <strong>
                      {item.actor?.name ??
                        item.actor?.email ??
                        'System / anonymous'}
                    </strong>
                    <span>
                      {item.changedFields.length > 0
                        ? item.changedFields.join(', ')
                        : 'Recorded event'}
                    </span>
                  </div>

                  <time
                    className="audit-history-row__time"
                    dateTime={item.createdAt}
                    title={item.createdAt}
                  >
                    {formatTimestamp(item.createdAt)}
                  </time>

                  <details className="audit-history-row__metadata">
                    <summary>Evidence</summary>
                    <pre>{formatMetadata(item.metadata)}</pre>
                  </details>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {loading ? (
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading Audit History…</p>
        </div>
      ) : null}

      {loadError ? (
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      ) : null}

      {!loading && !loadError && records.length === 0 ? (
        <div className="catalog-empty">
          <h2>No audit events match this view</h2>
          <p>Change the filters or date range and try again.</p>
        </div>
      ) : null}

      {!loading && !loadError && records.length > 0 ? (
        <div className="audit-history-list" role="table" aria-label="Audit History">
          <div
            className="audit-history-row audit-history-row--header"
            role="row"
          >
            <span role="columnheader">Action</span>
            <span role="columnheader">Entity</span>
            <span role="columnheader">Actor</span>
            <span role="columnheader">Time</span>
            <span role="columnheader">Metadata</span>
          </div>
          {records.map((record) => (
            <article className="audit-history-row" role="row" key={record.id}>
              <div className="audit-history-row__action">
                <strong>{formatAction(record.action)}</strong>
                <span>{record.action}</span>
              </div>

              <div className="audit-history-row__entity">
                <small>Entity</small>
                <strong>{record.entityType}</strong>
                <span title={record.entityId ?? undefined}>
                  {record.entityId ? shortId(record.entityId) : 'No entity ID'}
                </span>
                {record.entityId ? (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => {
                      setEntityType(record.entityType);
                      setEntityId(record.entityId ?? '');
                      setPageNumber(1);
                    }}
                  >
                    View history
                  </button>
                ) : null}
              </div>

              <div className="audit-history-row__actor">
                <small>Actor</small>
                <strong>
                  {record.actor?.name ??
                    record.actor?.email ??
                    'System / anonymous'}
                </strong>
                <span>{record.actor?.email ?? 'No account identity'}</span>
              </div>

              <time
                className="audit-history-row__time"
                role="cell"
                dateTime={record.createdAt}
                title={record.createdAt}
              >
                {formatTimestamp(record.createdAt)}
              </time>

              <div role="cell">
                <details className="audit-history-row__metadata">
                  <summary>Metadata</summary>
                  <pre>{formatMetadata(record.metadata)}</pre>
                </details>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!loading && !loadError && total > 0 ? (
        <div className="catalog-pagination">
          <button
            className="button button--quiet"
            type="button"
            disabled={pageNumber <= 1}
            onClick={() =>
              setPageNumber((current) => Math.max(1, current - 1))
            }
          >
            Previous
          </button>
          <span>
            Page {pageCount === 0 ? 0 : pageNumber} of {pageCount}
          </span>
          <button
            className="button button--quiet"
            type="button"
            disabled={pageCount === 0 || pageNumber >= pageCount}
            onClick={() => setPageNumber((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function formatAction(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function formatVersionTransition(
  before: number | null,
  after: number | null,
): string {
  if (before !== null && after !== null) return `v${before} → v${after}`;
  if (after !== null) return `v${after}`;
  if (before !== null) return `from v${before}`;
  return 'Version not recorded';
}

function formatLifecycleTransition(
  before: string | null,
  after: string | null,
): string {
  if (before && after && before !== after) return `${before} → ${after}`;
  return after ?? before ?? 'No lifecycle change';
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMetadata(value: unknown): string {
  if (value === null || value === undefined) return 'No metadata';
  const serialized = JSON.stringify(value, null, 2);
  if (!serialized) return String(value);
  return serialized.length > 4000
    ? `${serialized.slice(0, 4000)}\n… metadata truncated in Admin view`
    : serialized;
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
