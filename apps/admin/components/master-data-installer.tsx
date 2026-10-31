'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  MasterReferenceStatus,
  MasterReferenceStatusCount,
} from '@/lib/reference-data-contracts';
import { isMasterReferenceStatusPayload, masterReferenceCountDisplay } from '@/lib/master-reference-status-display';
import { useAdminPrincipal } from './admin-session';
import { LayersIcon } from './icons';

const COUNT_LABELS: Array<
  [keyof MasterReferenceStatus['counts'], string]
> = [
  ['attributes', 'Attributes'],
  ['allowedValues', 'Allowed values'],
  ['categories', 'Categories'],
  ['productTypes', 'Product Types'],
  ['vehicleMakes', 'Vehicle makes'],
  ['vehicleModels', 'Vehicle models'],
  ['vehicleDerivatives', 'Derivatives / body lines'],
  ['vehicleGenerations', 'Generations'],
  ['vehicleTrims', 'Trims / variants'],
  ['vehicleEngines', 'Engine masters'],
  ['vehicleTransmissions', 'Transmission masters'],
  ['vehicleBodyTypes', 'Body types'],
  ['vehicleMarkets', 'Source markets / regions'],
  ['vehicleConfigurations', 'Configured vehicles'],
];

export function MasterDataInstaller() {
  const principal = useAdminPrincipal();
  const granted = new Set(principal.permissions);
  const canView =
    granted.has('catalog.manage') && granted.has('vehicle.manage');

  const [status, setStatus] = useState<MasterReferenceStatus | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    if (!canView) return;

    setLoading(true);
    setError('');
    setStatus(null);
    try {
      const response = await fetch('/api/admin/reference-data/status', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Canonical master-data status could not be loaded.');
      }

      const payload: unknown = await response.json();
      if (!isMasterReferenceStatusPayload(payload)) {
        throw new Error('Unexpected master-data status response.');
      }
      setStatus(payload);
    } catch {
      setError(
        'Canonical master-data status could not be loaded. Check that the API and database are running and that Admin and API use matching versions.',
      );
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const blockerTotal = status
    ? Object.values(status.blockers).reduce((total, value) => total + value, 0)
    : 0;
  const unavailableCounts = status
    ? COUNT_LABELS.filter(([key]) => !masterReferenceCountDisplay(status.counts[key]).available)
    : [];

  return (
    <section className="module-section" aria-labelledby="master-data-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Master data</span>
          <h2 id="master-data-heading">Reference-data overview</h2>
        </div>
        <span className="roadmap-badge">Admin-managed libraries</span>
      </div>

      <article className="module-card">
        <div className="module-card__top">
          <span className="module-card__icon">
            <LayersIcon />
          </span>
          <span
            className={
              status?.attributeLibraryReady
                ? 'permission-chip permission-chip--granted'
                : 'permission-chip'
            }
          >
            {!canView
              ? 'Permissions required'
              : loading
                ? 'Checking…'
                : error
                  ? 'Status unavailable'
                  : status?.attributeLibraryReady
                  ? 'Attribute baseline ready'
                  : 'Attribute baseline needs review'}
          </span>
        </div>

        <h3>Current master-data records</h3>
        <p>
          Vehicle masters and Catalog classifications are created and maintained
          by administrators. Starting or restarting the API does not rebuild or
          restore vehicle records. An empty library may be intentional.
        </p>
        <p>
          Only the shared Attribute baseline has a prescribed count. The vehicle
          and Catalog numbers below reflect current PostgreSQL records, not a
          required import or fixed dataset. Configuration counts do not certify
          the validity or activation status of individual vehicles.
        </p>

        {!canView ? (
          <p>
            Both <strong>catalog.manage</strong> and{' '}
            <strong>vehicle.manage</strong> are required to view canonical
            master-data status.
          </p>
        ) : null}

        {loading ? (
          <div className="catalog-state" aria-live="polite">
            <span className="spinner spinner--dark" aria-hidden="true" />
            <span>Checking canonical master data…</span>
          </div>
        ) : null}

        {error ? <p role="alert">{error}</p> : null}

        {status && !loading ? (
          <>
            <p role="status">
              {status.attributeLibraryReady
                ? 'The canonical Attribute baseline is available.'
                : 'The canonical Attribute baseline needs review. Vehicle and Catalog records are managed independently.'}
            </p>
            <p>
              {status.vehicleLibraryState === 'EMPTY'
                ? 'No Vehicle masters or Configured Vehicles are stored. Add records manually when needed.'
                : status.vehicleLibraryState === 'MASTERS_ONLY'
                  ? 'Vehicle masters are stored, but no Configured Vehicles exist yet.'
                  : 'Configured Vehicles are stored. Validate and activate each one through the Vehicle workflow.'}
            </p>
            {status.replacementInProgress ? (
              <p role="status">Attribute library maintenance is in progress.</p>
            ) : null}

            {unavailableCounts.length > 0 ? (
              <p role="alert">
                Some master-data counts are unavailable:{' '}
                {unavailableCounts.map(([, label]) => label).join(', ')}.
                The API may be running a different version from Admin. Restart
                the API from the same checkout, then refresh this page. No
                records have been changed.
              </p>
            ) : null}

            <div className="module-grid" aria-label="Canonical master-data counts">
              {COUNT_LABELS.map(([key, label]) => (
                <CountCard key={key} label={label} count={status.counts[key]} />
              ))}
            </div>

            {blockerTotal > 0 ? (
              <p>
                Linked operational records: {status.blockers.products} Products,{' '}
                {status.blockers.sellerListings} Seller Listings,{' '}
                {status.blockers.vehicleProfiles} saved Vehicle Profiles, and{' '}
                {status.blockers.vehicleCompatibilities} compatibility records.
              </p>
            ) : null}

            <button
              className="button button--quiet"
              type="button"
              disabled={loading}
              onClick={() => void loadStatus()}
            >
              Refresh status
            </button>
          </>
        ) : null}
      </article>
    </section>
  );
}

function CountCard({
  label,
  count,
}: {
  label: string;
  count: MasterReferenceStatusCount | undefined;
}) {
  const display = masterReferenceCountDisplay(count);

  return (
    <article className="module-card">
      <div className="module-card__top">
        <span>{label}</span>
        <span
          className={
            display.baselineMet
              ? 'permission-chip permission-chip--granted'
              : 'permission-chip'
          }
        >
          {display.badge}
        </span>
      </div>
      <h3>
        {display.value}
      </h3>
      <p>{display.description}</p>
    </article>
  );
}
