'use client';

import { type ComponentType, useEffect, useState } from 'react';
import type { CatalogHealthResponse } from '@/lib/catalog-health-contracts';
import type { ProductTypeAdminSummary } from '@/lib/catalog-contracts';
import type { SellerSummary } from '@/lib/marketplace-contracts';
import type { VehicleConfigurationSummary } from '@/lib/vehicle-contracts';
import type {
  AdminPlatformHealth,
  CatalogOverviewSummary,
  SellerOverviewSummary,
  VehicleOverviewSummary,
} from '@/lib/admin-overview';
import {
  ActivityIcon,
  CarIcon,
  KeyIcon,
  LayersIcon,
  ShieldIcon,
  StoreIcon,
} from './icons';
import { useAdminPrincipal } from './admin-session';
import { MasterDataInstaller } from './master-data-installer';

const moduleCards = [
  {
    title: 'Catalog management',
    description:
      'Categories, Part Groups, Product Types, technical attributes, Brand Master, schema publishing, and applicability governance.',
    permission: 'catalog.manage',
    href: '/admin/catalog/product-types',
    icon: LayersIcon,
  },
  {
    title: 'Vehicle master data',
    description:
      'Canonical makes, models, generations, trims, technical masters, and vehicle configurations.',
    permission: 'vehicle.manage',
    href: '/admin/vehicles/configurations',
    icon: CarIcon,
  },
  {
    title: 'Global sourcing',
    description:
      'Canonical Supplier Master records for manufacturers, distributors, wholesalers, exporters, and other sourcing organizations.',
    permission: 'sourcing.manage',
    href: '/admin/sourcing/suppliers',
    icon: ActivityIcon,
  },
  {
    title: 'Marketplace operations',
    description:
      'Seller applications, business verification, approval decisions, suspension, and marketplace operations.',
    permission: 'seller.manage',
    href: '/admin/marketplace/sellers',
    icon: StoreIcon,
  },
  {
    title: 'Admin access',
    description:
      'List, provision, activate, suspend, and reactivate privileged Admin accounts with audited controls.',
    permission: 'admin.accounts.manage',
    href: '/admin/accounts',
    icon: KeyIcon,
  },
];

type OperationalOverviewState = {
  loading: boolean;
  errors: string[];
  system: AdminPlatformHealth | null;
  catalog: CatalogOverviewSummary | null;
  vehicles: VehicleOverviewSummary | null;
  sellers: SellerOverviewSummary | null;
  health: CatalogHealthResponse | null;
};

export function DashboardOverview() {
  const principal = useAdminPrincipal();
  const granted = new Set(principal.permissions);
  const canCatalog = granted.has('catalog.manage');
  const canManageVehicles = granted.has('vehicle.manage');
  const canManageSellers = granted.has('seller.manage');
  const canCatalogHealth = canCatalog && canManageVehicles;
  const [reloadKey, setReloadKey] = useState(0);
  const [overview, setOverview] = useState<OperationalOverviewState>({
    loading: true,
    errors: [],
    system: null,
    catalog: null,
    vehicles: null,
    sellers: null,
    health: null,
  });

  useEffect(() => {
    let active = true;

    async function loadOperationalOverview() {
      setOverview((current) => ({ ...current, loading: true }));
      const errors: string[] = [];
      let system: AdminPlatformHealth | null = null;
      let catalog: CatalogOverviewSummary | null = null;
      let vehicles: VehicleOverviewSummary | null = null;
      let sellers: SellerOverviewSummary | null = null;
      let health: CatalogHealthResponse | null = null;

      const tasks: Promise<void>[] = [
        loadRecord<AdminPlatformHealth>('/api/admin/system/health')
          .then((summary) => {
            system = summary;
          })
          .catch(() => {
            errors.push('Platform readiness');
          }),
      ];

      if (canCatalog) {
        tasks.push(
          loadRecord<ProductTypeAdminSummary>(
            '/api/admin/catalog/product-types/summary',
          ).then((summary) => {
            catalog = summary;
          })
            .catch(() => {
              errors.push('Product Types');
            }),
        );
      }

      if (canManageVehicles) {
        tasks.push(
          loadRecord<VehicleConfigurationSummary>(
            '/api/admin/vehicles/configuration-summary',
          )
            .then((summary) => {
              vehicles = summary;
            })
            .catch(() => {
              errors.push('Configured Vehicles');
            }),
        );
      }

      if (canManageSellers) {
        tasks.push(
          loadRecord<SellerSummary>('/api/admin/sellers/summary')
            .then((summary) => {
              sellers = summary;
            })
            .catch(() => {
              errors.push('Seller governance');
            }),
        );
      }

      if (canCatalogHealth) {
        tasks.push(
          loadRecord<CatalogHealthResponse>('/api/admin/catalog/health')
            .then((summary) => {
              health = summary;
            })
            .catch(() => {
              errors.push('Catalog health');
            }),
        );
      }

      await Promise.all(tasks);

      if (active) {
        setOverview({
          loading: false,
          errors,
          system,
          catalog,
          vehicles,
          sellers,
          health,
        });
      }
    }

    void loadOperationalOverview();

    return () => {
      active = false;
    };
  }, [
    canCatalog,
    canCatalogHealth,
    canManageSellers,
    canManageVehicles,
    reloadKey,
  ]);

  return (
    <>
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">Command center</span>
          <h1>Good to see you.</h1>
          <p>
            Your secure Admin workspace is connected. Use the available
            management modules to maintain catalog, vehicle, marketplace, and
            privileged access configuration.
          </p>
        </div>
        <div className="welcome-panel__actions">
          <div className="welcome-panel__badge">
            <ShieldIcon />
            <span>
              <strong>Verified</strong>MFA-backed session
            </span>
          </div>
          <button
            className="button button--quiet"
            type="button"
            disabled={overview.loading}
            onClick={() => setReloadKey((current) => current + 1)}
          >
            {overview.loading ? 'Refreshing…' : 'Refresh overview'}
          </button>
        </div>
      </section>

      <section className="signal-grid" aria-label="Operational overview">
        <OverviewSignal
          icon={ActivityIcon}
          label="Platform readiness"
          value={
            overview.system
              ? `API ${overview.system.api.toLowerCase()} · database ${overview.system.database.toLowerCase()}`
              : overview.loading
                ? 'Checking…'
                : 'Unavailable'
          }
          status={
            overview.loading
              ? undefined
              : overview.system?.api === 'UP' && overview.system.database === 'UP'
                ? 'OK'
                : 'ATTENTION'
          }
        />
        {canCatalog ? (
          <OverviewSignal
            icon={LayersIcon}
            label="Product Type schemas"
            href="/admin/catalog/product-types"
            value={
              overview.catalog
                ? `${overview.catalog.published}/${overview.catalog.total} published · ${overview.catalog.draft} draft · ${overview.catalog.needsPublication} need first schema`
                : overview.loading
                  ? 'Checking…'
                  : 'Unavailable'
            }
          />
        ) : null}
        {canManageVehicles ? (
          <OverviewSignal
            icon={CarIcon}
            label="Configured vehicles"
            href="/admin/vehicles/configurations"
            value={
              overview.vehicles
                ? `${overview.vehicles.active}/${overview.vehicles.total} active · ${overview.vehicles.draft} draft`
                : overview.loading
                  ? 'Checking…'
                  : 'Unavailable'
            }
          />
        ) : null}
        {canManageSellers ? (
          <OverviewSignal
            icon={StoreIcon}
            label="Seller review queue"
            href="/admin/marketplace/sellers"
            value={
              overview.sellers
                ? `${overview.sellers.pendingReview} pending · ${overview.sellers.active} active`
                : overview.loading
                  ? 'Checking…'
                  : 'Unavailable'
            }
          />
        ) : null}
        <OverviewSignal
          icon={KeyIcon}
          label="Assigned roles"
          value={String(principal.roles.length)}
        />
      </section>

      {canCatalogHealth ? (
        <section className="module-section" aria-label="Catalog health">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Catalog intelligence</span>
              <h2>Data quality and review workload</h2>
            </div>
            <div className="section-heading__actions">
              <span className="roadmap-badge">
                {overview.health
                  ? `${overview.health.status} · ${overview.health.actionItems} action items`
                  : overview.loading
                    ? 'Checking…'
                    : 'Unavailable'}
              </span>
              {overview.health ? (
                <a className="button button--secondary" href="/admin/catalog/quality">
                  Open quality workbench
                </a>
              ) : null}
            </div>
          </div>
          <div className="signal-grid">
            <OverviewSignal
              icon={LayersIcon}
              label="Product Type quality"
              href="/admin/catalog/product-types"
              value={
                overview.health
                  ? `${overview.health.productTypes.withoutPublishedSchema} without schema · ${overview.health.productTypes.withoutRequiredCriteria} missing required criteria`
                  : overview.loading
                    ? 'Checking…'
                    : 'Unavailable'
              }
            />
            <OverviewSignal
              icon={ActivityIcon}
              label="Seller Article review"
              href={canManageSellers ? '/admin/catalog/article-review' : undefined}
              value={
                overview.health
                  ? `${overview.health.articles.sellerAwaitingReview} awaiting review · ${overview.health.articles.lowCompletenessInSample}/${overview.health.articles.completenessSampleEvaluated} low completeness`
                  : overview.loading
                    ? 'Checking…'
                    : 'Unavailable'
              }
            />
            <OverviewSignal
              icon={StoreIcon}
              label="Fitment & OE quality"
              href={canManageSellers ? '/admin/catalog/oe-references' : '/admin/catalog/quality'}
              value={
                overview.health
                  ? `${overview.health.articles.activeWithoutRequiredVerifiedFitment} fitment gaps · ${overview.health.oeReferences.collisionGroups} OE review groups`
                  : overview.loading
                    ? 'Checking…'
                    : 'Unavailable'
              }
            />
            <OverviewSignal
              icon={CarIcon}
              label="Vehicle quality"
              href="/admin/vehicles/configurations"
              value={
                overview.health
                  ? `${overview.health.vehicles.incompleteActiveConfigurations} incomplete configs · ${overview.health.vehicles.activeModelsWithoutConfigurations} models without configs`
                  : overview.loading
                    ? 'Checking…'
                    : 'Unavailable'
              }
            />
          </div>
        </section>
      ) : null}

      {overview.errors.length > 0 ? (
        <div className="alert alert--error" role="alert">
          Operational overview could not load: {overview.errors.join(', ')}.
          The affected management modules can still be opened directly.
        </div>
      ) : null}

      <section className="module-section" id="modules">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Administration</span>
            <h2>Administration modules</h2>
          </div>
          <span className="roadmap-badge">Core workflows available</span>
        </div>
        <div className="module-grid">
          {moduleCards.map(
            ({ title, description, permission, href, icon: Icon }) => {
              const hasPermission = granted.has(permission);
              const content = (
                <>
                  <div className="module-card__top">
                    <span className="module-card__icon">
                      <Icon />
                    </span>
                    <span
                      className={`permission-chip${hasPermission ? ' permission-chip--granted' : ''}`}
                    >
                      {hasPermission ? 'Access granted' : 'Not assigned'}
                    </span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className="module-card__footer">
                    <span>Management workspace</span>
                    <span>{hasPermission ? 'Open module →' : 'Permission required'}</span>
                  </div>
                </>
              );

              return hasPermission ? (
                <a className="module-card module-card--link" href={href} key={permission}>
                  {content}
                </a>
              ) : (
                <article className="module-card" key={permission}>
                  {content}
                </article>
              );
            },
          )}
        </div>
      </section>

      <MasterDataInstaller />

      <section className="security-summary">
        <div>
          <ShieldIcon />
          <span>
            <strong>Protected workspace</strong>Your account permissions are
            checked throughout your session.
          </span>
        </div>
        <p>Sign out when you finish, especially on a shared computer.</p>
      </section>
    </>
  );
}
type OverviewIcon = ComponentType;

function OverviewSignal({
  icon: Icon,
  label,
  value,
  href,
  status,
}: {
  icon: OverviewIcon;
  label: string;
  value: string;
  href?: string;
  status?: 'OK' | 'ATTENTION';
}) {
  const content = (
    <>
      <span className="signal-card__icon">
        <Icon />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      {status ? (
        <i
          className={`signal-card__status signal-card__status--${status.toLowerCase()}`}
          aria-label={status === 'OK' ? 'Healthy' : 'Needs attention'}
        />
      ) : null}
      {href ? <b className="signal-card__action">Open →</b> : null}
    </>
  );

  return href ? (
    <a className="signal-card signal-card--link" href={href}>
      {content}
    </a>
  ) : (
    <article className="signal-card">{content}</article>
  );
}

async function loadRecord<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Admin overview request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
