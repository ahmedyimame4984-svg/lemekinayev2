'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import {
  hasVehicleManagePermission,
  type VehicleStatusFilter,
} from '@/lib/vehicle-management';
import type {
  VehicleMakePage,
  VehicleMakeRecord,
  VehicleModelPage,
  VehicleModelRecord,
  VehicleRootSummary,
} from '@/lib/vehicle-contracts';
import { useAdminPrincipal } from './admin-session';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import {
  AdminLibraryCount,
  AdminLibraryPagination,
  AdminLibraryToolbar,
  type AdminPageSize,
} from './admin-library-shell';
import { AdminPageHeader } from './admin-page-header';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { VehicleAdminNav } from './vehicle-admin-nav';

type VehicleView = 'makes' | 'models';

export function VehiclesManagement({ view }: { view: VehicleView }) {
  const principal = useAdminPrincipal();
  const canManage = hasVehicleManagePermission(principal.permissions);

  const [makes, setMakes] = useState<VehicleMakeRecord[]>([]);
  const [models, setModels] = useState<VehicleModelRecord[]>([]);
  const [status, setStatus] = useState<VehicleStatusFilter>('ALL');
  const [makeFilter, setMakeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<VehicleRootSummary>({
    totalMakes: 0,
    totalModels: 0,
    modelCountsByMake: {},
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(50);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadVehicleIndex() {
      try {
        setLoading(true);
        setLoadError('');

        const summaryRequest = fetch('/api/admin/vehicles/summary', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const makeRequest =
          view === 'models'
            ? fetch('/api/admin/vehicles/makes', {
                credentials: 'same-origin',
                cache: 'no-store',
              })
            : Promise.resolve(null);

        const [summaryResponse, makeResponse] = await Promise.all([
          summaryRequest,
          makeRequest,
        ]);

        if (!summaryResponse.ok || (makeResponse && !makeResponse.ok)) {
          throw new Error('Could not load vehicle master index');
        }

        const summaryData =
          (await summaryResponse.json()) as VehicleRootSummary;
        const makeData = makeResponse
          ? ((await makeResponse.json()) as VehicleMakeRecord[])
          : null;

        if (!active) return;
        setSummary(summaryData);
        if (makeData) setMakes(makeData);
      } catch {
        if (active) {
          setLoadError(
            'Vehicle master data could not be loaded. Check that the API and database are running.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadVehicleIndex();

    return () => {
      active = false;
    };
  }, [canManage, reloadKey, view]);

  useEffect(() => {
    if (!canManage) {
      setListLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setListLoading(true);
        setListError('');

        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
        });
        const searchValue = search.trim();
        if (searchValue) query.set('search', searchValue);
        if (status !== 'ALL') query.set('status', status);
        if (view === 'models' && makeFilter !== 'ALL') {
          query.set('makeId', makeFilter);
        }

        const response = await fetch(
          `/api/admin/vehicles/${view}/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load vehicle page');

        if (view === 'makes') {
          const page = (await response.json()) as VehicleMakePage;
          if (!active) return;
          setMakes(page.items);
          setTotal(page.total);
          setPageCount(page.pageCount);
          if (page.pageCount > 0 && pageNumber > page.pageCount) {
            setPageNumber(page.pageCount);
          }
        } else {
          const page = (await response.json()) as VehicleModelPage;
          if (!active) return;
          setModels(page.items);
          setTotal(page.total);
          setPageCount(page.pageCount);
          if (page.pageCount > 0 && pageNumber > page.pageCount) {
            setPageNumber(page.pageCount);
          }
        }
      } catch {
        if (active) {
          setListError(
            `Vehicle ${view} could not be loaded. Change the filters or retry.`,
          );
        }
      } finally {
        if (active) setListLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [makeFilter, pageNumber, pageSize, reloadKey, search, status, view]);

  const sortedMakes = useMemo(
    () => [...makes].sort((a, b) => a.name.localeCompare(b.name)),
    [makes],
  );

  const visibleMakes = makes;
  const visibleModels = models;

  const makeNames = useMemo(
    () => new Map(makes.map((make) => [make.id, make.name])),
    [makes],
  );

  function resetFilters() {
    setSearch('');
    setStatus('ALL');
    setMakeFilter('ALL');
    setPageNumber(1);
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Vehicle management</span>
        <h1>{view === 'makes' ? 'Vehicle Makes' : 'Vehicle Models'}</h1>
        <div className="catalog-state" role="alert">
          <p>
            Your administrator account does not have the vehicle.manage
            permission.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <AdminPageHeader
        eyebrow="Vehicle management"
        title={view === 'makes' ? 'Vehicle Makes' : 'Vehicle Models'}
        description={
          view === 'makes'
            ? 'Browse vehicle manufacturers synchronized from Autotechdoc. Records are read-only.'
            : 'Browse synchronized models under their vehicle makes. Records are read-only.'
        }
      />

      <VehicleAdminNav active={view === 'makes' ? 'makes' : 'models'} />

      <AdminLibraryToolbar ariaLabel="Vehicle library filters">
        {view === 'models' ? (
          <div className="catalog-filter vehicle-make-filter">
            <label>Make</label>
            <AdminSearchableCombobox
              id="vehicle-make-filter"
              value={makeFilter}
              options={[
                { id: 'ALL', label: 'All makes' },
                ...sortedMakes.map((make) => ({
                  id: make.id,
                  label: make.name,
                  meta: formatAdminEnumLabel(make.status),
                })),
              ]}
              placeholder="All makes"
              searchPlaceholder="Search makes…"
              onChange={(value) => {
                setMakeFilter(value);
                setPageNumber(1);
              }}
            />
          </div>
        ) : null}

        <div className="catalog-filter">
          <label htmlFor="vehicle-search">Search</label>
          <input
            id="vehicle-search"
            type="search"
            value={search}
            placeholder={view === 'makes' ? 'Toyota, BMW…' : 'Corolla, Hilux…'}
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="vehicle-status-filter">Status</label>
          <select
            id="vehicle-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as VehicleStatusFilter);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="SUPERSEDED">Superseded</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <AdminFilterResetButton
          active={Boolean(
            search.trim() ||
              status !== 'ALL' ||
              (view === 'models' && makeFilter !== 'ALL'),
          )}
          onReset={resetFilters}
        />

        <AdminLibraryCount
          count={total}
          singular={view === 'makes' ? 'make' : 'model'}
          plural={view === 'makes' ? 'makes' : 'models'}
        />
      </AdminLibraryToolbar>

      {loading || listLoading ? (
        <AdminLoadingState message="Loading vehicle master data…" />
      ) : loadError || listError ? (
        <div className="catalog-state vehicle-state--error" role="alert">
          <div>
            <strong>Vehicle data unavailable</strong>
            <p>{loadError || listError}</p>
          </div>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Retry
          </button>
        </div>
      ) : view === 'makes' ? (
        <VehicleMakeList
          makes={visibleMakes}
          modelCountsByMake={summary.modelCountsByMake}
        />
      ) : (
        <VehicleModelList models={visibleModels} makeNames={makeNames} />
      )}

      {!loading && !listLoading && !loadError && !listError && total > 0 ? (
        <AdminLibraryPagination
          page={pageNumber}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          disabled={listLoading}
          onPageChange={setPageNumber}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPageNumber(1);
          }}
        />
      ) : null}
    </section>
  );
}

function VehicleMakeList({
  makes,
  modelCountsByMake,
}: {
  makes: VehicleMakeRecord[];
  modelCountsByMake: Record<string, number>;
}) {
  if (makes.length === 0) {
    return (
      <AdminEmptyState
        title="No vehicle makes found"
        description="Change the filters or check synchronization in Autotechdoc."
      />
    );
  }

  return (
    <div
      className="vehicle-list vehicle-list--read-only"
      role="table"
      aria-label="Vehicle Makes library"
    >
      <div className="vehicle-row vehicle-row--header" role="row">
        <span role="columnheader">Make</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Models</span>
        <span role="columnheader">Version</span>
      </div>
      {makes.map((make) => {
        const modelCount = modelCountsByMake[make.id] ?? 0;

        return (
          <div className="vehicle-row" role="row" key={make.id}>
            <div className="vehicle-row__identity" role="cell">
              <strong>{make.name}</strong>
              <span>{make.code}</span>
            </div>
            <AdminStatusBadge status={make.status} role="cell" />
            <span className="vehicle-row__meta" role="cell">
              {modelCount} {modelCount === 1 ? 'model' : 'models'}
            </span>
            <span className="vehicle-row__version" role="cell">
              v{make.version}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VehicleModelList({
  models,
  makeNames,
}: {
  models: VehicleModelRecord[];
  makeNames: Map<string, string>;
}) {
  if (models.length === 0) {
    return (
      <AdminEmptyState
        title="No vehicle models found"
        description="Change the make and status filters or check synchronization in Autotechdoc."
      />
    );
  }

  return (
    <div
      className="vehicle-list vehicle-list--read-only"
      role="table"
      aria-label="Vehicle Models library"
    >
      <div
        className="vehicle-row vehicle-row--model vehicle-row--header"
        role="row"
      >
        <span role="columnheader">Model</span>
        <span role="columnheader">Make</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Version</span>
        <span role="columnheader">Vehicles</span>
      </div>
      {models.map((model) => (
        <div
          className="vehicle-row vehicle-row--model"
          role="row"
          key={model.id}
        >
          <div className="vehicle-row__identity" role="cell">
            <strong>{model.name}</strong>
            <span>{model.code}</span>
          </div>
          <div className="vehicle-row__make" role="cell">
            <small>Make</small>
            <span>{makeNames.get(model.makeId) ?? 'Unknown make'}</span>
          </div>
          <AdminStatusBadge status={model.status} role="cell" />
          <span className="vehicle-row__version" role="cell">
            v{model.version}
          </span>
          <span role="cell">
            <a
              className="button button--secondary vehicle-row__build"
              href={`/admin/vehicles/configurations?modelId=${model.id}`}
            >
              View vehicles
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}
