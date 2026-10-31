'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  CatalogHealthResponse,
  CatalogQualityFinding,
  CatalogQualityFindingPage,
  CatalogQualityIssue,
} from '@/lib/catalog-health-contracts';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { AdminPageHeader } from './admin-page-header';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { useAdminPrincipal } from './admin-session';

type QueueDefinition = {
  issue: CatalogQualityIssue;
  label: string;
  description: string;
  severity: 'CRITICAL' | 'ATTENTION';
  count: (health: CatalogHealthResponse) => number;
};

const queues: QueueDefinition[] = [
  {
    issue: 'REQUIRED_FITMENT_GAP',
    label: 'Required fitment gaps',
    description: 'Active Articles whose published Product Type requires fitment but no verified fitment exists.',
    severity: 'CRITICAL',
    count: (health) => health.articles.activeWithoutRequiredVerifiedFitment,
  },
  {
    issue: 'INCOMPLETE_CONFIGURATION',
    label: 'Incomplete configured vehicles',
    description: 'Active vehicle configurations missing canonical identity components required by the quality policy.',
    severity: 'CRITICAL',
    count: (health) => health.vehicles.incompleteActiveConfigurations,
  },
  {
    issue: 'SELLER_AWAITING_REVIEW',
    label: 'Seller Articles awaiting review',
    description: 'Seller-submitted Draft Manufacturer Articles waiting for Admin governance.',
    severity: 'ATTENTION',
    count: (health) => health.articles.sellerAwaitingReview,
  },
  {
    issue: 'OE_COLLISION',
    label: 'OE collision groups',
    description: 'Same issuer OE number linked to multiple live Articles for the same Article Brand and Product Type.',
    severity: 'ATTENTION',
    count: (health) => health.oeReferences.collisionGroups,
  },
  {
    issue: 'NO_PUBLISHED_SCHEMA',
    label: 'Product Types without schema',
    description: 'Active Product Types that cannot govern new Articles because no schema has been published.',
    severity: 'ATTENTION',
    count: (health) => health.productTypes.withoutPublishedSchema,
  },
  {
    issue: 'NO_REQUIRED_CRITERIA',
    label: 'Product Types without required criteria',
    description: 'Published Product Type schemas that contain no Mandatory or Conditional technical criteria.',
    severity: 'ATTENTION',
    count: (health) => health.productTypes.withoutRequiredCriteria,
  },
  {
    issue: 'MODEL_WITHOUT_CONFIGURATION',
    label: 'Models without configurations',
    description: 'Active Vehicle Models that have no Active canonical configured vehicle.',
    severity: 'ATTENTION',
    count: (health) => health.vehicles.activeModelsWithoutConfigurations,
  },
  {
    issue: 'GENERATION_WITHOUT_CONFIGURATION',
    label: 'Generations without configurations',
    description: 'Active Vehicle Generations that have no Active canonical configured vehicle.',
    severity: 'ATTENTION',
    count: (health) => health.vehicles.activeGenerationsWithoutConfigurations,
  },
];

const EMPTY_PAGE: CatalogQualityFindingPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  pageCount: 0,
};

export function CatalogQualityWorkbench() {
  const principal = useAdminPrincipal();
  const canUseWorkbench =
    principal.permissions.includes('catalog.manage') &&
    principal.permissions.includes('vehicle.manage');
  const canReadAudit = principal.permissions.includes('admin.audit.read');
  const canReviewArticles =
    principal.permissions.includes('catalog.manage') &&
    principal.permissions.includes('seller.manage');

  const [health, setHealth] = useState<CatalogHealthResponse | null>(null);
  const [healthReloadKey, setHealthReloadKey] = useState(0);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [selectedIssue, setSelectedIssue] =
    useState<CatalogQualityIssue>('REQUIRED_FITMENT_GAP');
  const [findings, setFindings] =
    useState<CatalogQualityFindingPage>(EMPTY_PAGE);
  const [pageNumber, setPageNumber] = useState(1);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [findingsError, setFindingsError] = useState('');

  useEffect(() => {
    if (!canUseWorkbench) {
      setHealthLoading(false);
      return;
    }

    let active = true;
    async function loadHealth() {
      try {
        setHealthLoading(true);
        setHealthError('');
        const response = await fetch('/api/admin/catalog/health', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Catalog Health could not be loaded.');
        }
        const nextHealth = (await response.json()) as CatalogHealthResponse;
        if (!active) return;
        setHealth(nextHealth);

        setSelectedIssue((currentIssue) => {
          const currentCount =
            queues.find((queue) => queue.issue === currentIssue)?.count(nextHealth) ??
            0;
          if (currentCount > 0) return currentIssue;
          return (
            queues.find((queue) => queue.count(nextHealth) > 0)?.issue ??
            currentIssue
          );
        });
      } catch (error) {
        if (active) {
          setHealthError(
            error instanceof Error
              ? error.message
              : 'Catalog Health could not be loaded.',
          );
        }
      } finally {
        if (active) setHealthLoading(false);
      }
    }

    void loadHealth();
    return () => {
      active = false;
    };
  }, [canUseWorkbench, healthReloadKey]);

  useEffect(() => {
    if (!canUseWorkbench || !health) return;

    let active = true;
    const controller = new AbortController();

    async function loadFindings() {
      try {
        setFindingsLoading(true);
        setFindingsError('');
        const query = new URLSearchParams({
          issue: selectedIssue,
          page: String(pageNumber),
          pageSize: '25',
        });
        const response = await fetch(
          `/api/admin/catalog/health/findings?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error('Quality findings could not be loaded.');
        }
        const page = (await response.json()) as CatalogQualityFindingPage;
        if (!active) return;
        setFindings(page);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setFindingsError(
            error instanceof Error
              ? error.message
              : 'Quality findings could not be loaded.',
          );
        }
      } finally {
        if (active) setFindingsLoading(false);
      }
    }

    void loadFindings();
    return () => {
      active = false;
      controller.abort();
    };
  }, [canUseWorkbench, health, pageNumber, selectedIssue]);

  const selectedQueue = useMemo(
    () => queues.find((queue) => queue.issue === selectedIssue) ?? queues[0],
    [selectedIssue],
  );

  if (!canUseWorkbench) {
    return (
      <section className="catalog-page">
        <AdminPageHeader
          eyebrow="Catalog intelligence"
          title="Catalog Quality"
          description="Catalog Quality requires both catalog.manage and vehicle.manage because the workbench evaluates Product Type, Article, OE and configured-vehicle quality together."
        />
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have both required permissions.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page catalog-quality-page">
      <AdminPageHeader
        eyebrow="Catalog intelligence"
        title="Catalog Quality Workbench"
        description="Turn Catalog Health signals into an operator queue. Inspect the exact affected records, then continue correction in the owning Product Type, Article-audit or Vehicle workflow."
        actions={
          <div className="catalog-quality-header-actions">
            {health ? (
              <span className={`catalog-quality-status catalog-quality-status--${health.status.toLowerCase()}`}>
                {formatAdminEnumLabel(health.status)} · {health.actionItems} action items
              </span>
            ) : null}
            <button
              className="button button--quiet"
              type="button"
              disabled={healthLoading}
              onClick={() => {
                setPageNumber(1);
                setHealthReloadKey((current) => current + 1);
              }}
            >
              {healthLoading ? 'Revalidating…' : 'Refresh health'}
            </button>
          </div>
        }
      />

      <CatalogPrimaryNav active="quality" />

      {healthError ? (
        <div className="alert alert--error" role="alert">{healthError}</div>
      ) : null}

      {healthLoading ? (
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Building Catalog Quality queues…</p>
        </div>
      ) : null}

      {health ? (
        <>
          <section className="catalog-quality-summary" aria-label="Catalog Quality summary">
            <div>
              <span className="eyebrow">Health snapshot</span>
              <strong>{health.actionItems}</strong>
              <small>actionable data-quality findings</small>
            </div>
            <div>
              <span className="eyebrow">Article review</span>
              <strong>{health.articles.sellerAwaitingReview}</strong>
              <small>seller Articles awaiting governance</small>
            </div>
            <div>
              <span className="eyebrow">OE review</span>
              <strong>{health.oeReferences.collisionGroups}</strong>
              <small>collision groups requiring inspection</small>
            </div>
            <div>
              <span className="eyebrow">Generated</span>
              <strong>{new Date(health.generatedAt).toLocaleTimeString()}</strong>
              <small>{new Date(health.generatedAt).toLocaleDateString()}</small>
            </div>
          </section>

          <div className="catalog-quality-layout">
            <aside className="catalog-quality-queues" aria-label="Quality queues">
              <div className="catalog-section-heading">
                <div>
                  <span className="eyebrow">Prioritized queues</span>
                  <h2>What needs attention</h2>
                  <p>Select a queue to inspect the affected canonical records.</p>
                </div>
              </div>

              <div className="catalog-quality-queue-list">
                {queues.map((queue) => {
                  const count = queue.count(health);
                  const selected = selectedIssue === queue.issue;
                  return (
                    <button
                      type="button"
                      className={selected ? 'catalog-quality-queue is-selected' : 'catalog-quality-queue'}
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedIssue(queue.issue);
                        setPageNumber(1);
                      }}
                      key={queue.issue}
                    >
                      <span>
                        <strong>{queue.label}</strong>
                        <small>{queue.description}</small>
                      </span>
                      <span className={`catalog-quality-count catalog-quality-count--${queue.severity.toLowerCase()}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="catalog-quality-results" aria-live="polite">
              <div className="catalog-section-heading catalog-quality-results__heading">
                <div>
                  <span className="eyebrow">{selectedQueue.severity === 'CRITICAL' ? 'Critical quality' : 'Review queue'}</span>
                  <h2>{selectedQueue.label}</h2>
                  <p>{selectedQueue.description}</p>
                </div>
                <span className="catalog-count">
                  {findings.total} {findings.total === 1 ? 'record' : 'records'}
                </span>
              </div>

              {findingsLoading ? (
                <div className="catalog-state">
                  <span className="spinner spinner--dark" aria-hidden="true" />
                  <p>Loading affected records…</p>
                </div>
              ) : null}

              {findingsError ? (
                <div className="alert alert--error" role="alert">{findingsError}</div>
              ) : null}

              {!findingsLoading && !findingsError && findings.items.length === 0 ? (
                <div className="catalog-empty">
                  <h3>No records in this queue</h3>
                  <p>This quality check currently has no affected records.</p>
                </div>
              ) : null}

              {!findingsLoading && !findingsError && findings.items.length > 0 ? (
                <div className="catalog-quality-finding-list">
                  {findings.items.map((finding) => (
                    <QualityFindingRow
                      finding={finding}
                      canReadAudit={canReadAudit}
                      canReviewArticles={canReviewArticles}
                      key={finding.id}
                    />
                  ))}
                </div>
              ) : null}

              {!findingsError && findings.total > 0 ? (
                <div className="catalog-pagination">
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={findingsLoading || pageNumber <= 1}
                    onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </button>
                  <span>
                    Page {findings.pageCount === 0 ? 0 : findings.page} of {findings.pageCount}
                  </span>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={
                      findingsLoading ||
                      findings.pageCount === 0 ||
                      pageNumber >= findings.pageCount
                    }
                    onClick={() => setPageNumber((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          {health.articles.lowCompletenessSamples.length > 0 ? (
            <section className="catalog-card catalog-quality-spotlight">
              <div className="catalog-section-heading">
                <div>
                  <span className="eyebrow">Bounded completeness sample</span>
                  <h2>Lowest-quality Seller Article samples</h2>
                  <p>
                    These are the weakest records from the oldest bounded Seller-submission sample used by Catalog Health. Correction #2 will provide the dedicated Article review queue.
                  </p>
                </div>
                <span className="catalog-count">
                  {health.articles.lowCompletenessInSample}/{health.articles.completenessSampleEvaluated} low
                </span>
              </div>
              <div className="catalog-quality-sample-grid">
                {health.articles.lowCompletenessSamples.map((article) => (
                  <article key={article.articleId}>
                    <div>
                      <strong>{article.name}</strong>
                      <small>{article.issueAreas.join(' · ') || 'General quality'}</small>
                    </div>
                    <span>{article.qualityScore}/100</span>
                    {canReviewArticles ? (
                      <a
                        className="button button--secondary"
                        href={articleReviewHref(article.articleId)}
                      >
                        Open Article review
                      </a>
                    ) : canReadAudit ? (
                      <a
                        className="button button--quiet"
                        href={articleAuditHref(article.articleId)}
                      >
                        Review audit
                      </a>
                    ) : (
                      <small className="catalog-quality-action-note">
                        Article Review or Audit permission required
                      </small>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function QualityFindingRow({
  finding,
  canReadAudit,
  canReviewArticles,
}: {
  finding: CatalogQualityFinding;
  canReadAudit: boolean;
  canReviewArticles: boolean;
}) {
  const action = primaryAction(finding, canReadAudit, canReviewArticles);

  return (
    <article className="catalog-quality-finding">
      <div className="catalog-quality-finding__identity">
        <span className={`catalog-quality-severity catalog-quality-severity--${finding.severity.toLowerCase()}`}>
          {formatAdminEnumLabel(finding.severity)}
        </span>
        <strong>{finding.title}</strong>
        {finding.code ? <small>{finding.code}</small> : null}
      </div>

      <div className="catalog-quality-finding__context">
        {finding.context.map((item) => <span key={item}>{item}</span>)}
        {finding.metricLabel ? <b>{finding.metricLabel}</b> : null}
      </div>

      <div className="catalog-quality-finding__actions">
        {action ? (
          <a className="button button--secondary" href={action.href}>
            {action.label}
          </a>
        ) : null}
        {finding.entityType === 'OE_COLLISION' &&
        (canReviewArticles || canReadAudit)
          ? finding.relatedEntityIds.slice(0, 3).map((articleId, index) => (
              <a
                className="button button--quiet"
                href={
                  canReviewArticles
                    ? articleInspectorHref(articleId)
                    : articleAuditHref(articleId)
                }
                key={articleId}
              >
                Article {index + 1} {canReviewArticles ? 'inspect' : 'audit'}
              </a>
            ))
          : null}
        {!canReviewArticles &&
        !canReadAudit &&
        (finding.entityType === 'ARTICLE' ||
          finding.entityType === 'OE_COLLISION') ? (
          <span className="catalog-quality-action-note">
            Article Review or Audit permission required
          </span>
        ) : null}
      </div>
    </article>
  );
}

function primaryAction(
  finding: CatalogQualityFinding,
  canReadAudit: boolean,
  canReviewArticles: boolean,
): { label: string; href: string } | null {
  if (finding.entityType === 'OE_COLLISION' && canReviewArticles) {
    return {
      label: 'Open OE review',
      href: oeReferenceReviewHref(finding.title),
    };
  }

  if (finding.entityType === 'PRODUCT_TYPE' && finding.entityId) {
    return {
      label: 'Open Product Type',
      href: `/admin/catalog/product-types?productTypeId=${encodeURIComponent(finding.entityId)}`,
    };
  }

  if (finding.entityType === 'ARTICLE' && finding.entityId) {
    if (canReviewArticles) {
      return {
        label: 'Open Article review',
        href: articleReviewHref(finding.entityId),
      };
    }
    if (canReadAudit) {
      return {
        label: 'Review Article audit',
        href: articleAuditHref(finding.entityId),
      };
    }
  }

  if (finding.entityType === 'VEHICLE_MODEL' && finding.entityId) {
    return {
      label: 'Build configuration',
      href: `/admin/vehicles/configurations?modelId=${encodeURIComponent(finding.entityId)}`,
    };
  }

  if (finding.entityType === 'VEHICLE_GENERATION' && finding.entityId) {
    const modelId = finding.relatedEntityIds[0];
    return {
      label: 'Build configuration',
      href: `/admin/vehicles/configurations?${new URLSearchParams({
        ...(modelId ? { modelId } : {}),
        generationId: finding.entityId,
      }).toString()}`,
    };
  }

  if (finding.entityType === 'VEHICLE_CONFIGURATION') {
    const modelId = finding.relatedEntityIds[0];
    const generationId = finding.relatedEntityIds[1];
    return {
      label: 'Open vehicle workflow',
      href: `/admin/vehicles/configurations?${new URLSearchParams({
        ...(modelId ? { modelId } : {}),
        ...(generationId ? { generationId } : {}),
      }).toString()}`,
    };
  }

  return null;
}

function articleInspectorHref(articleId: string): string {
  return `/admin/catalog/article-review/${articleId}#identifiers`;
}

function oeReferenceReviewHref(reference: string): string {
  return `/admin/catalog/oe-references?${new URLSearchParams({
    search: reference,
    view: 'COLLISIONS',
  }).toString()}`;
}

function articleReviewHref(articleId: string): string {
  return `/admin/catalog/article-review?${new URLSearchParams({
    articleId,
  }).toString()}`;
}

function articleAuditHref(articleId: string): string {
  return `/admin/audit?${new URLSearchParams({
    entityType: 'Product',
    entityId: articleId,
  }).toString()}`;
}
