'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ManufacturerArticleInspectorRecord } from '@/lib/article-inspector-contracts';
import type { AuditEntityHistory } from '@/lib/audit-contracts';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { AdminPageHeader } from './admin-page-header';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { useAdminPrincipal } from './admin-session';

const sections = [
  ['overview', 'Overview'],
  ['technical', 'Technical values'],
  ['identifiers', 'Identifiers & OE'],
  ['fitment', 'Fitment'],
  ['assets', 'Assets'],
  ['relations', 'Relations'],
  ['audit', 'Audit'],
] as const;

export function ManufacturerArticleInspector({
  articleId,
}: {
  articleId: string;
}) {
  const principal = useAdminPrincipal();
  const canInspect =
    principal.permissions.includes('catalog.manage') &&
    principal.permissions.includes('seller.manage');
  const canReadAudit = principal.permissions.includes('admin.audit.read');

  const [record, setRecord] =
    useState<ManufacturerArticleInspectorRecord | null>(null);
  const [fitmentPage, setFitmentPage] = useState(1);
  const [relationPage, setRelationPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [audit, setAudit] = useState<AuditEntityHistory | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  useEffect(() => {
    if (!canInspect) {
      setLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();

    void (async () => {
      try {
        setLoading(true);
        setLoadError('');
        const query = new URLSearchParams({
          fitmentPage: String(fitmentPage),
          fitmentPageSize: '25',
          relationPage: String(relationPage),
          relationPageSize: '25',
        });
        const response = await fetch(
          `/api/admin/catalog/article-review/${articleId}/inspector?${query.toString()}`,
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
            payload?.error?.message ??
              'Manufacturer Article Inspector could not be loaded.',
          );
        }
        const next = (await response.json()) as ManufacturerArticleInspectorRecord;
        if (!active) return;
        setRecord(next);
        if (
          next.fitments.pageCount > 0 &&
          fitmentPage > next.fitments.pageCount
        ) {
          setFitmentPage(next.fitments.pageCount);
        }
        if (
          next.relations.pageCount > 0 &&
          relationPage > next.relations.pageCount
        ) {
          setRelationPage(next.relations.pageCount);
        }
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Manufacturer Article Inspector could not be loaded.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [articleId, canInspect, fitmentPage, relationPage]);

  useEffect(() => {
    if (!canInspect || !canReadAudit) return;

    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        setAuditLoading(true);
        setAuditError('');
        const response = await fetch(
          `/api/admin/audit/entities/Product/${articleId}/history?includeRelated=true&limit=50`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error('Article audit timeline could not be loaded.');
        }
        const next = (await response.json()) as AuditEntityHistory;
        if (active) setAudit(next);
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setAuditError(
            error instanceof Error
              ? error.message
              : 'Article audit timeline could not be loaded.',
          );
        }
      } finally {
        if (active) setAuditLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [articleId, canInspect, canReadAudit]);

  const technicalGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof record>['technicalValues']>();
    for (const item of record?.technicalValues ?? []) {
      const key = item.group ?? 'General';
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    }
    return [...groups.entries()];
  }, [record]);

  if (!canInspect) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog governance"
          title="Manufacturer Article Inspector"
          description="Article inspection requires both catalog.manage and seller.manage because canonical Article evidence and Seller-submission provenance are shown together."
        />
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have both required permissions.</p>
        </div>
      </section>
    );
  }

  if (loading && !record) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog governance"
          title="Manufacturer Article Inspector"
          description="Loading canonical Article identity, evidence, fitment and governance context."
        />
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading Manufacturer Article…</p>
        </div>
      </section>
    );
  }

  if (loadError && !record) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog governance"
          title="Manufacturer Article Inspector"
          description="Inspect one canonical Manufacturer Article across all governed evidence."
        />
        <div className="alert alert--error" role="alert">{loadError}</div>
        <a className="button button--quiet" href="/admin/catalog/article-review">
          Back to Article Review
        </a>
      </section>
    );
  }

  if (!record) return null;

  const awaitingReview =
    record.articleSource === 'SELLER_SUBMISSION' &&
    record.status === 'DRAFT' &&
    record.catalogReviewSubmittedAt !== null;
  const primaryMpn =
    record.partNumbers.find(
      (item) => item.type === 'MANUFACTURER' && item.isPrimary,
    ) ??
    record.partNumbers.find((item) => item.type === 'MANUFACTURER') ??
    null;
  const oeCount = record.partNumbers.filter((item) => item.type === 'OE').length;
  const crossReferenceCount = record.partNumbers.filter(
    (item) => item.type === 'CROSS_REFERENCE',
  ).length;

  return (
    <section className="catalog-page article-inspector-page">
      <AdminPageHeader
        eyebrow="Manufacturer Article"
        title={record.name}
        description="Read-only canonical inspector for Article identity, technical values, identifiers, OE references, fitment, assets, relations, provenance, readiness and history."
        actions={
          <div className="article-inspector-header-actions">
            <span className={`article-inspector-status article-inspector-status--${record.status.toLowerCase()}`}>
              {formatAdminEnumLabel(record.status)}
            </span>
            <span className={`article-inspector-quality article-inspector-quality--${record.validation.qualityBand.toLowerCase()}`}>
              {record.validation.qualityScore}/100 · {formatAdminEnumLabel(record.validation.qualityBand)}
            </span>
            <a className="button button--quiet" href="/admin/catalog/article-review">
              Back to review
            </a>
          </div>
        }
      />

      <CatalogPrimaryNav active="article-review" />

      {loadError ? (
        <div className="alert alert--error" role="alert">{loadError}</div>
      ) : null}

      <nav className="article-inspector-section-nav" aria-label="Article inspector sections">
        {sections.map(([id, label]) => (
          <a href={`#${id}`} key={id}>{label}</a>
        ))}
      </nav>

      <section id="overview" className="article-inspector-overview">
        <div className="article-inspector-summary-grid">
          <SummaryCard
            label="Identity"
            value={primaryMpn?.partNumber ?? 'MPN not supplied'}
            detail={record.brand?.name ?? 'Brand not supplied'}
          />
          <SummaryCard
            label="Product Type"
            value={record.productType.name}
            detail={`${record.productType.code} · Schema v${record.schemaVersion}`}
          />
          <SummaryCard
            label="Readiness"
            value={
              record.validation.readyForActivation
                ? 'Activation ready'
                : `${record.validation.issues.length} blocker${record.validation.issues.length === 1 ? '' : 's'}`
            }
            detail={`${record.fitments.total} fitments · ${oeCount} OE · ${record.assets.length} assets`}
          />
          <SummaryCard
            label="Source"
            value={formatAdminEnumLabel(record.articleSource)}
            detail={
              record.sourceSeller
                ? `${record.sourceSeller.displayName} · ${record.sourceSeller.sellerCode}`
                : record.sourceReference ?? 'Platform-governed source'
            }
          />
        </div>

        <div className="article-inspector-overview-grid">
          <article className="catalog-card article-inspector-card">
            <div className="catalog-section-heading">
              <div>
                <span className="eyebrow">Canonical identity</span>
                <h2>Article and classification</h2>
              </div>
            </div>
            <DefinitionGrid
              items={[
                ['Article ID', record.id],
                ['Brand', record.brand?.name ?? 'Not supplied'],
                ['Manufacturer part number', primaryMpn?.partNumber ?? 'Not supplied'],
                ['Category', record.category.name],
                ['Part Group', record.productFamily?.name ?? 'Not assigned'],
                ['Product Type', `${record.productType.name} · ${record.productType.code}`],
                ['Schema', `v${record.schemaVersion} · ${shortHash(record.schemaHash)}`],
                ['Pack quantity', record.packQuantity === null ? 'Not supplied' : String(record.packQuantity)],
                ['Unit', record.unitOfMeasure ? `${record.unitOfMeasure.name}${record.unitOfMeasure.symbol ? ` (${record.unitOfMeasure.symbol})` : ''}` : 'Not supplied'],
                ['Version', String(record.version)],
              ]}
            />
          </article>

          <article className="catalog-card article-inspector-card">
            <div className="catalog-section-heading">
              <div>
                <span className="eyebrow">Provenance</span>
                <h2>Ownership and lifecycle</h2>
              </div>
            </div>
            <DefinitionGrid
              items={[
                ['Article source', formatAdminEnumLabel(record.articleSource)],
                ['Source reference', record.sourceReference ?? 'Not supplied'],
                ['Source Seller', record.sourceSeller ? `${record.sourceSeller.displayName} · ${record.sourceSeller.businessName}` : 'Not seller-owned'],
                ['Submitted', formatDateTime(record.submittedAt)],
                ['Review submitted', record.catalogReviewSubmittedAt ? formatDateTime(record.catalogReviewSubmittedAt) : 'Not in review'],
                ['Published', record.publishedAt ? formatDateTime(record.publishedAt) : 'Not published'],
                ['Created', formatDateTime(record.createdAt)],
                ['Last updated', formatDateTime(record.updatedAt)],
              ]}
            />
            {awaitingReview ? (
              <div className="article-inspector-decision-callout">
                <strong>Awaiting catalog review</strong>
                <p>Use the dedicated Article Review workflow for Approve or Return-to-seller decisions.</p>
                <a
                  className="button button--secondary"
                  href={`/admin/catalog/article-review?articleId=${encodeURIComponent(record.id)}`}
                >
                  Open review decision
                </a>
              </div>
            ) : null}
          </article>
        </div>

        <article className="catalog-card article-inspector-card">
          <div className="catalog-section-heading">
            <div>
              <span className="eyebrow">Readiness</span>
              <h2>Validation and completeness</h2>
              <p>
                Readiness is evaluated against the immutable Product Type schema bound to this Article.
              </p>
            </div>
            <span className={record.validation.readyForActivation ? 'status status--active' : 'status status--draft'}>
              {record.validation.readyForActivation ? 'Ready' : 'Blocked'}
            </span>
          </div>

          <div className="article-inspector-evidence-strip">
            <span><strong>{record.validation.summary.identifierCount}</strong> identifiers</span>
            <span><strong>{record.validation.summary.oeReferenceCount}</strong> OE refs</span>
            <span><strong>{record.validation.summary.crossReferenceCount}</strong> cross refs</span>
            <span><strong>{record.validation.summary.verifiedFitmentCount}</strong> verified fitments</span>
            <span><strong>{record.validation.summary.imageCount}</strong> images</span>
            <span><strong>{record.validation.summary.documentCount}</strong> documents</span>
          </div>

          {record.validation.issues.length > 0 ? (
            <div className="article-inspector-issue-grid">
              {record.validation.issues.map((issue) => (
                <article key={`${issue.code}:${issue.attributeCode ?? ''}`}>
                  <span>{formatAdminEnumLabel(issue.area)}</span>
                  <strong>{issue.message}</strong>
                  <small>{issue.code}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="catalog-empty catalog-empty--compact">
              <h3>No activation blockers</h3>
              <p>This Article satisfies the requirements in its bound schema.</p>
            </div>
          )}
        </article>

        {(record.shortDescription || record.description || record.manufacturerNotes) ? (
          <article className="catalog-card article-inspector-card">
            <div className="catalog-section-heading">
              <div>
                <span className="eyebrow">Article copy</span>
                <h2>Description and manufacturer notes</h2>
              </div>
            </div>
            <div className="article-inspector-copy-grid">
              {record.shortDescription ? <CopyBlock label="Short description" value={record.shortDescription} /> : null}
              {record.description ? <CopyBlock label="Description" value={record.description} /> : null}
              {record.manufacturerNotes ? <CopyBlock label="Manufacturer notes" value={record.manufacturerNotes} /> : null}
            </div>
          </article>
        ) : null}
      </section>

      <section id="technical" className="catalog-card article-inspector-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Schema-bound evidence</span>
            <h2>Technical values</h2>
            <p>{record.technicalValues.length} values captured on schema v{record.schemaVersion}.</p>
          </div>
        </div>
        {technicalGroups.length === 0 ? (
          <div className="catalog-empty catalog-empty--compact">
            <h3>No technical values</h3>
            <p>This Article does not currently contain technical Attribute values.</p>
          </div>
        ) : (
          <div className="article-inspector-technical-groups">
            {technicalGroups.map(([group, values]) => (
              <section key={group}>
                <h3>{group}</h3>
                <div className="article-inspector-table">
                  <div className="article-inspector-table__header" aria-hidden="true">
                    <span>Attribute</span><span>Value</span><span>Rule</span>
                  </div>
                  {values.map((item) => (
                    <div className="article-inspector-table__row" key={item.code}>
                      <span><strong>{item.name}</strong><small>{item.code}</small></span>
                      <span>{formatTechnicalValue(item.value, item.unit)}</span>
                      <span>{item.requirement ? formatAdminEnumLabel(item.requirement) : '—'}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section id="identifiers" className="catalog-card article-inspector-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Identity and references</span>
            <h2>Part numbers, OE references and trade identifiers</h2>
            <p>
              {record.partNumbers.length} part/reference numbers · {record.identifiers.length} GTIN/trade identifiers · {crossReferenceCount} cross references.
            </p>
          </div>
        </div>
        <div className="article-inspector-identifiers-grid">
          <div>
            <h3>Part numbers and OE references</h3>
            {record.partNumbers.length === 0 ? (
              <p className="muted">No part-number evidence.</p>
            ) : (
              <div className="article-inspector-list">
                {record.partNumbers.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.partNumber}</strong>
                      <small>
                        {item.issuerBrand?.name ?? record.brand?.name ?? 'Issuer not supplied'}
                        {item.isPrimary ? ' · Primary' : ''}
                      </small>
                    </div>
                    <span>{formatAdminEnumLabel(item.type)}</span>
                    <span>{formatAdminEnumLabel(item.status)}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3>GTIN and trade identifiers</h3>
            {record.identifiers.length === 0 ? (
              <p className="muted">No GTIN/trade identifiers.</p>
            ) : (
              <div className="article-inspector-list">
                {record.identifiers.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.value}</strong>
                      <small>{item.normalizedValue}</small>
                    </div>
                    <span>{formatAdminEnumLabel(item.type)}</span>
                    <span>{formatAdminEnumLabel(item.status)}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="fitment" className="catalog-card article-inspector-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Vehicle compatibility</span>
            <h2>Fitment</h2>
            <p>{record.fitments.total} structured fitment records.</p>
          </div>
        </div>
        {record.fitments.items.length === 0 ? (
          <div className="catalog-empty catalog-empty--compact">
            <h3>No fitment records</h3>
            <p>No vehicle-compatibility evidence is attached to this Article.</p>
          </div>
        ) : (
          <div className="article-inspector-fitments">
            {record.fitments.items.map((fitment) => (
              <article key={fitment.id}>
                <div className="article-inspector-fitment__main">
                  <strong>{fitment.targetLabel}</strong>
                  <small>
                    {fitment.identityCode ? `${fitment.identityCode} · ` : ''}
                    {formatAdminEnumLabel(fitment.fitmentType)}
                    {fitment.position ? ` · ${fitment.position}` : ''}
                    {fitment.yearFrom || fitment.yearTo
                      ? ` · ${fitment.yearFrom ?? '?'}–${fitment.yearTo ?? '?'}`
                      : ''}
                  </small>
                </div>
                <div className="article-inspector-fitment__status">
                  <span>{formatAdminEnumLabel(fitment.verificationStatus)}</span>
                  <small>{formatAdminEnumLabel(fitment.source)} · {formatAdminEnumLabel(fitment.status)}</small>
                </div>
                {fitment.criteria.length > 0 ? (
                  <div className="article-inspector-fitment__criteria">
                    {fitment.criteria.map((criterion, index) => (
                      <span key={`${criterion.type}:${index}`}>
                        <strong>{formatAdminEnumLabel(criterion.type)}</strong>
                        {criterion.label}
                        {criterion.required ? ' · required' : ''}
                      </span>
                    ))}
                  </div>
                ) : null}
                {fitment.notes ? <p>{fitment.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
        <Pager
          page={record.fitments.page}
          pageCount={record.fitments.pageCount}
          disabled={loading}
          onPrevious={() => setFitmentPage((current) => Math.max(1, current - 1))}
          onNext={() => setFitmentPage((current) => current + 1)}
        />
      </section>

      <section id="assets" className="catalog-card article-inspector-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Evidence assets</span>
            <h2>Images and documents</h2>
            <p>{record.assets.length} governed asset records.</p>
          </div>
        </div>
        {record.assets.length === 0 ? (
          <div className="catalog-empty catalog-empty--compact">
            <h3>No assets</h3>
            <p>No image or document evidence is attached to this Article.</p>
          </div>
        ) : (
          <div className="article-inspector-assets">
            {record.assets.map((asset) => (
              <article key={asset.id}>
                <div>
                  <strong>{asset.title}</strong>
                  <small>{asset.mimeType ?? 'MIME type not supplied'}</small>
                  <code>{asset.storageReference}</code>
                </div>
                <span>{formatAdminEnumLabel(asset.type)}</span>
                <span>{formatAdminEnumLabel(asset.visibility)}</span>
                <span>{formatAdminEnumLabel(asset.status)}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="relations" className="catalog-card article-inspector-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Article graph</span>
            <h2>Relations and supersession</h2>
            <p>{record.relations.total} incoming/outgoing Article relations.</p>
          </div>
          <a
            className="button button--secondary"
            href={`/admin/catalog/article-relations?${new URLSearchParams({
              articleId: record.id,
            }).toString()}`}
          >
            Manage relations
          </a>
        </div>
        {record.relations.items.length === 0 ? (
          <div className="catalog-empty catalog-empty--compact">
            <h3>No Article relations</h3>
            <p>No supersession, interchange, accessory, kit or related-Article links are recorded.</p>
          </div>
        ) : (
          <div className="article-inspector-relations">
            {record.relations.items.map((relation) => (
              <article key={relation.id}>
                <div>
                  <span className="eyebrow">{relation.direction}</span>
                  <strong>{formatAdminEnumLabel(relation.type)}</strong>
                </div>
                <div>
                  <a href={`/admin/catalog/article-review/${relation.relatedArticle.id}`}>
                    {relation.relatedArticle.brand ? `${relation.relatedArticle.brand} · ` : ''}
                    {relation.relatedArticle.manufacturerPartNumber
                      ? `${relation.relatedArticle.manufacturerPartNumber} · `
                      : ''}
                    {relation.relatedArticle.name}
                  </a>
                  <small>{formatAdminEnumLabel(relation.relatedArticle.status)}</small>
                </div>
                <div>
                  <span>{relation.componentRole ?? '—'}</span>
                  <small>
                    {relation.componentQuantity !== null ? `Qty ${relation.componentQuantity}` : ''}
                    {relation.componentOrder !== null ? ` · Order ${relation.componentOrder}` : ''}
                  </small>
                </div>
                <span>{formatAdminEnumLabel(relation.status)}</span>
                {relation.note ? <p>{relation.note}</p> : null}
              </article>
            ))}
          </div>
        )}
        <Pager
          page={record.relations.page}
          pageCount={record.relations.pageCount}
          disabled={loading}
          onPrevious={() => setRelationPage((current) => Math.max(1, current - 1))}
          onNext={() => setRelationPage((current) => current + 1)}
        />
      </section>

      <section id="audit" className="catalog-card article-inspector-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Governance history</span>
            <h2>Audit timeline</h2>
            <p>Article events plus related fitment and relation events.</p>
          </div>
          {canReadAudit ? (
            <a
              className="button button--quiet"
              href={`/admin/audit?${new URLSearchParams({
                entityType: 'Product',
                entityId: record.id,
              }).toString()}`}
            >
              Open full Audit History
            </a>
          ) : null}
        </div>

        {!canReadAudit ? (
          <div className="catalog-empty catalog-empty--compact">
            <h3>Audit permission required</h3>
            <p>admin.audit.read is required to view immutable Article history.</p>
          </div>
        ) : auditLoading ? (
          <div className="catalog-state">
            <span className="spinner spinner--dark" aria-hidden="true" />
            <p>Loading Article history…</p>
          </div>
        ) : auditError ? (
          <div className="alert alert--error" role="alert">{auditError}</div>
        ) : audit?.items.length ? (
          <div className="article-inspector-audit-list">
            {audit.items.map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{formatAdminEnumLabel(event.action)}</strong>
                  <small>
                    {event.scope === 'RELATED' ? 'Related evidence event · ' : ''}
                    {formatDateTime(event.createdAt)}
                  </small>
                </div>
                <span>
                  {event.actor?.name ?? event.actor?.email ?? 'System'}
                </span>
                <span>
                  {event.lifecycleBefore || event.lifecycleAfter
                    ? `${event.lifecycleBefore ?? '—'} → ${event.lifecycleAfter ?? '—'}`
                    : event.changedFields.length > 0
                      ? event.changedFields.join(', ')
                      : 'Recorded event'}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="catalog-empty catalog-empty--compact">
            <h3>No audit events</h3>
            <p>No immutable history is available for this Article yet.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DefinitionGrid({
  items,
}: {
  items: Array<[string, string]>;
}) {
  return (
    <dl className="article-inspector-definition-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <span className="eyebrow">{label}</span>
      <p>{value}</p>
    </section>
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

function formatTechnicalValue(value: unknown, unit: string | null): string {
  const formatted =
    value === null || value === undefined
      ? '—'
      : typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
  return unit && formatted !== '—' ? `${formatted} ${unit}` : formatted;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function shortHash(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 12)}…`;
}
