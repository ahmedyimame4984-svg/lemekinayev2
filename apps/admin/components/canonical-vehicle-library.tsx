'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import {
  configuredVehicleHierarchy as buildConfiguredVehicleLibrary,
  configurationApplicabilityLabel,
  engineTechnicalLabel,
  transmissionTechnicalLabel,
} from '@/lib/vehicle-builder';
import type {
  VehicleConfigurationLibraryItem,
  VehicleConfigurationLibraryPage,
  VehicleConfigurationRecord,
  VehicleEngineRecord,
  VehicleGenerationRecord,
  VehicleMakeRecord,
  VehicleModelRecord,
  VehicleModelDerivativeRecord,
  VehicleNamedMasterRecord,
  VehicleTransmissionRecord,
  VehicleTrimRecord,
} from '@/lib/vehicle-contracts';
import { AdminSavedViewsToolbar } from './admin-saved-views-toolbar';
import {
  AdminLibraryPagination,
  normalizeAdminPageSize,
  type AdminPageSize,
} from './admin-library-shell';
import { AdminPageHeader } from './admin-page-header';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { VehicleAdminNav } from './vehicle-admin-nav';

type ConfiguredVehicleLibrarySortBy =
  | 'HIERARCHY'
  | 'UPDATED_AT'
  | 'CREATED_AT'
  | 'MAKE'
  | 'MODEL'
  | 'GENERATION'
  | 'TRIM'
  | 'MODEL_YEAR'
  | 'CODE'
  | 'STATUS';

type SortDirection = 'ASC' | 'DESC';

const CONFIGURED_VEHICLE_SAVED_VIEW_SCOPE = 'VEHICLE_CONFIGURED_VEHICLES';

const configuredVehicleSortOptions: Array<{
  value: ConfiguredVehicleLibrarySortBy;
  label: string;
}> = [
  { value: 'HIERARCHY', label: 'Vehicle hierarchy' },
  { value: 'UPDATED_AT', label: 'Updated time' },
  { value: 'CREATED_AT', label: 'Created date' },
  { value: 'MAKE', label: 'Make' },
  { value: 'MODEL', label: 'Model' },
  { value: 'GENERATION', label: 'Generation' },
  { value: 'TRIM', label: 'Trim' },
  { value: 'MODEL_YEAR', label: 'Model year' },
  { value: 'CODE', label: 'Configuration code' },
  { value: 'STATUS', label: 'Status' },
];

type DataState = {
  makes: VehicleMakeRecord[];
  models: VehicleModelRecord[];
  derivatives: VehicleModelDerivativeRecord[];
  generations: VehicleGenerationRecord[];
  trims: VehicleTrimRecord[];
  engines: VehicleEngineRecord[];
  transmissions: VehicleTransmissionRecord[];
  bodyTypes: VehicleNamedMasterRecord[];
  markets: VehicleNamedMasterRecord[];
  configurations: VehicleConfigurationRecord[];
};

const EMPTY_DATA: DataState = {
  makes: [],
  models: [],
  derivatives: [],
  generations: [],
  trims: [],
  engines: [],
  transmissions: [],
  bodyTypes: [],
  markets: [],
  configurations: [],
};

/** Original vehicle browsing layout, backed only by synchronized canonical reads.
 * Saved views are local administrator preferences, not canonical mutations. */
export function CanonicalVehicleLibrary({
  initialSearch = '',
  initialConfigurationId = '',
  initialModelId = '',
}: {
  initialSearch?: string;
  initialConfigurationId?: string;
  initialModelId?: string;
}) {
  const [data, setData] = useState<DataState>(EMPTY_DATA);
  const [referenceError, setReferenceError] = useState('');
  const [librarySearch, setLibrarySearch] = useState(initialSearch);
  const [libraryConfigurationId, setLibraryConfigurationId] = useState(
    initialConfigurationId,
  );
  const [libraryMakeFilter, setLibraryMakeFilter] = useState('');
  const [libraryModelFilter, setLibraryModelFilter] = useState(initialModelId);
  const [libraryStatusFilter, setLibraryStatusFilter] = useState<
    'ALL' | MasterDataStatus
  >('ALL');
  const [librarySortBy, setLibrarySortBy] =
    useState<ConfiguredVehicleLibrarySortBy>('HIERARCHY');
  const [librarySortDirection, setLibrarySortDirection] =
    useState<SortDirection>('ASC');
  const [savedViews, setSavedViews] = useState<AdminSavedViewRecord[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewSaving, setSavedViewSaving] = useState(false);
  const [savedViewError, setSavedViewError] = useState('');
  const [libraryModels, setLibraryModels] = useState<VehicleModelRecord[]>([]);
  const [libraryPage, setLibraryPage] =
    useState<VehicleConfigurationLibraryPage>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      pageCount: 0,
    });
  const [libraryPageNumber, setLibraryPageNumber] = useState(1);
  const [libraryPageSize, setLibraryPageSize] = useState<AdminPageSize>(25);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [libraryReloadKey, setLibraryReloadKey] = useState(0);
  const [exportError, setExportError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setReferenceError('');
    void fetchVehicleList<VehicleMakeRecord>('/api/admin/vehicles/makes')
      .then((makes) => {
        if (active) setData((current) => ({ ...current, makes }));
      })
      .catch(() => {
        if (active)
          setReferenceError(
            'Vehicle filters could not be loaded. Retry to load them again.',
          );
      });
    return () => {
      active = false;
    };
  }, [libraryReloadKey]);

  useEffect(() => {
    if (!initialModelId) return;
    let active = true;
    void fetchVehicleList<VehicleModelRecord>('/api/admin/vehicles/models')
      .then((models) => {
        if (active)
          setLibraryMakeFilter(
            models.find((model) => model.id === initialModelId)?.makeId ?? '',
          );
      })
      .catch(() => {
        if (active)
          setReferenceError(
            'The model filter could not be loaded. Search remains available.',
          );
      });
    return () => {
      active = false;
    };
  }, [initialModelId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setSavedViewsLoading(true);
        setSavedViewError('');
        const response = await fetch(
          `/api/admin/preferences/saved-views?scope=${CONFIGURED_VEHICLE_SAVED_VIEW_SCOPE}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load saved views');

        const records = (await response.json()) as AdminSavedViewRecord[];
        if (active) setSavedViews(records);
      } catch {
        if (active) {
          setSavedViewError(
            'Saved views could not be loaded. Configured Vehicles are still available.',
          );
        }
      } finally {
        if (active) setSavedViewsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setLibraryLoading(true);
        setLibraryError('');

        const query = new URLSearchParams({
          page: String(libraryPageNumber),
          pageSize: String(libraryPageSize),
        });
        const search = librarySearch.trim();
        if (search) query.set('search', search);
        if (libraryConfigurationId) {
          query.set('configurationId', libraryConfigurationId);
        }
        if (libraryMakeFilter) query.set('makeId', libraryMakeFilter);
        if (libraryModelFilter) query.set('modelId', libraryModelFilter);
        if (libraryStatusFilter !== 'ALL') {
          query.set('status', libraryStatusFilter);
        }
        query.set('sortBy', librarySortBy);
        query.set('sortDirection', librarySortDirection);

        const response = await fetch(
          `/api/admin/vehicles/configuration-library?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          throw new Error('Configured Vehicle library could not be loaded');
        }

        const page = (await response.json()) as VehicleConfigurationLibraryPage;
        if (!active) return;

        setLibraryPage(page);
        if (page.pageCount > 0 && libraryPageNumber > page.pageCount) {
          setLibraryPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setLibraryError(
            'Configured Vehicle library could not be loaded. Change the filters or retry.',
          );
        }
      } finally {
        if (active) setLibraryLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    libraryConfigurationId,
    libraryMakeFilter,
    libraryModelFilter,
    libraryPageNumber,
    libraryPageSize,
    libraryReloadKey,
    librarySearch,
    librarySortBy,
    librarySortDirection,
    libraryStatusFilter,
  ]);

  useEffect(() => {
    if (!libraryMakeFilter) {
      setLibraryModels([]);
      return;
    }

    let active = true;
    void fetchVehicleList<VehicleModelRecord>(
      `/api/admin/vehicles/models?makeId=${libraryMakeFilter}`,
    )
      .then((items) => {
        if (active) setLibraryModels(items);
      })
      .catch(() => {
        if (active) {
          setLibraryModels([]);
          setReferenceError(
            'Models for this make could not be loaded. Select the make again to retry.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [libraryMakeFilter]);

  const libraryModelOptions = libraryModels;

  const libraryPresentation = useMemo(
    () => configurationLibraryPresentation(libraryPage.items),
    [libraryPage.items],
  );

  const libraryGroups = useMemo(
    () =>
      buildConfiguredVehicleLibrary(
        libraryPresentation.configurations,
        libraryPresentation.makes,
        libraryPresentation.models,
        libraryPresentation.derivatives,
        libraryPresentation.generations,
        libraryPresentation.trims,
        {},
      ),
    [libraryPresentation],
  );

  const visibleConfigurationCount = libraryPage.total;

  async function exportConfiguredVehiclesCsv() {
    setExportBusy(true);
    setExportError('');
    try {
      const query = new URLSearchParams();
      if (librarySearch.trim()) query.set('search', librarySearch.trim());
      if (libraryConfigurationId) {
        query.set('configurationId', libraryConfigurationId);
      }
      if (libraryMakeFilter) query.set('makeId', libraryMakeFilter);
      if (libraryModelFilter) query.set('modelId', libraryModelFilter);
      if (libraryStatusFilter !== 'ALL') {
        query.set('status', libraryStatusFilter);
      }
      query.set('sortBy', librarySortBy);
      query.set('sortDirection', librarySortDirection);

      const response = await fetch(
        `/api/admin/vehicles/configuration-export?${query.toString()}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!response.ok) {
        throw new Error('Configured Vehicle export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lemekinaye-configured-vehicles.csv';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(
        'The filtered Configured Vehicle library could not be exported. Try again.',
      );
    } finally {
      setExportBusy(false);
    }
  }

  function currentConfiguredVehicleSavedViewState(): Record<string, unknown> {
    return {
      search: librarySearch,
      makeId: libraryMakeFilter,
      modelId: libraryModelFilter,
      status: libraryStatusFilter,
      sortBy: librarySortBy,
      sortDirection: librarySortDirection,
      pageSize: libraryPageSize,
    };
  }

  function applyConfiguredVehicleSavedView(view: AdminSavedViewRecord) {
    const state = view.state;
    const nextMakeId =
      typeof state.makeId === 'string' &&
      data.makes.some((item) => item.id === state.makeId)
        ? state.makeId
        : '';
    const nextModelId = typeof state.modelId === 'string' ? state.modelId : '';
    const nextStatus = isMasterStatusFilter(state.status)
      ? state.status
      : 'ALL';
    const nextSortBy = isConfiguredVehicleSortBy(state.sortBy)
      ? state.sortBy
      : 'HIERARCHY';
    const nextSortDirection = state.sortDirection === 'DESC' ? 'DESC' : 'ASC';

    setLibraryConfigurationId('');
    setLibrarySearch(typeof state.search === 'string' ? state.search : '');
    setLibraryMakeFilter(nextMakeId);
    setLibraryModelFilter(nextMakeId ? nextModelId : '');
    setLibraryStatusFilter(nextStatus);
    setLibrarySortBy(nextSortBy);
    setLibrarySortDirection(nextSortDirection);
    setLibraryPageSize(normalizeAdminPageSize(state.pageSize, 25));
    setLibraryPageNumber(1);
    setSelectedSavedViewId(view.id);
    setSavedViewName(view.name);
    setSavedViewError('');
  }

  async function saveConfiguredVehicleView() {
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
          scope: CONFIGURED_VEHICLE_SAVED_VIEW_SCOPE,
          name,
          state: currentConfiguredVehicleSavedViewState(),
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
          : 'The current Configured Vehicle view could not be saved.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function updateConfiguredVehicleSavedView() {
    const selected = savedViews.find((view) => view.id === selectedSavedViewId);
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
          state: currentConfiguredVehicleSavedViewState(),
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
          : 'The saved view could not be updated.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function deleteConfiguredVehicleSavedView() {
    const selected = savedViews.find((view) => view.id === selectedSavedViewId);
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
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
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
          : 'The saved view could not be deleted.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  function renderLibraryConfigurationRow(
    item: VehicleConfigurationRecord,
    showHierarchy = false,
  ) {
    const make = libraryPresentation.makes.find(
      (entry) => entry.id === item.makeId,
    );
    const model = libraryPresentation.models.find(
      (entry) => entry.id === item.modelId,
    );
    const generation = libraryPresentation.generations.find(
      (entry) => entry.id === item.generationId,
    );
    const trim = libraryPresentation.trims.find(
      (entry) => entry.id === item.trimId,
    );
    const hierarchyPath = [
      make?.name,
      model?.name,
      generation?.name,
      trim?.name,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' → ');

    return (
      <div className="vehicle-builder-existing__row" key={item.id}>
        <div>
          <strong>
            {showHierarchy ? hierarchyPath || item.code : item.code}
          </strong>
          {showHierarchy ? <span>{item.code}</span> : null}
          <span>{configurationApplicabilityLabel(item)}</span>
          <span>{configurationDescription(item, libraryPresentation)}</span>
          <small>{configurationVinReadiness(item)}</small>
        </div>
        <div className="vehicle-builder-step__actions">
          <span
            className={`category-status category-status--${item.status.toLowerCase()}`}
          >
            {formatAdminEnumLabel(item.status)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <section className="catalog-page vehicle-builder">
      <AdminPageHeader
        eyebrow="Vehicle management"
        title="Configured Vehicles Library"
        description="Browse vehicle data synchronized from Autotechdoc. Canonical vehicle records are read-only here."
      />
      <VehicleAdminNav active="configurations" />
      <div className="vehicle-builder__principle">
        <strong>Canonical path</strong>
        <span>Make → Model → Generation → Trim / Variant → Configuration</span>
        <small>
          Years are applicability metadata, not hierarchy levels. Derivative /
          Body Line remains optional metadata on the Generation; Engine,
          Transmission, Body Type, Market and steering stay at Configuration
          level.
        </small>
      </div>
      {referenceError ? (
        <div className="alert alert--error" role="alert">
          {referenceError}
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setLibraryReloadKey((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      <section className="vehicle-builder-existing">
        <div>
          <span className="eyebrow">Canonical library</span>
          <h2>Configured Vehicles Library</h2>
          <p>
            Make → Model → Generation → Trim → Configuration. Search the full
            master library by vehicle identity, code, engine, transmission,
            market or year, then narrow it with independent filters.
          </p>
        </div>

        <div className="vehicle-library-toolbar">
          <label className="field vehicle-library-toolbar__search">
            <span className="field__label">Search master vehicle library</span>
            <input
              type="search"
              value={librarySearch}
              onChange={(event) => {
                setLibraryConfigurationId('');
                setLibrarySearch(event.target.value);
                setLibraryPageNumber(1);
              }}
              placeholder="Search make, model, generation, trim, engine, code…"
            />
          </label>
          <SelectField
            label="Make"
            value={libraryMakeFilter}
            onChange={(value) => {
              setLibraryConfigurationId('');
              setLibraryMakeFilter(value);
              setLibraryModelFilter('');
              setLibraryPageNumber(1);
            }}
            options={data.makes.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            placeholder="All makes"
          />
          <SelectField
            label="Model"
            value={libraryModelFilter}
            onChange={(value) => {
              setLibraryConfigurationId('');
              setLibraryModelFilter(value);
              setLibraryPageNumber(1);
            }}
            options={libraryModelOptions.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            placeholder={
              libraryMakeFilter ? 'All models' : 'Select a Make first'
            }
            disabled={!libraryMakeFilter}
          />
          <label className="field">
            <span className="field__label">Status</span>
            <select
              className="category-form__select"
              value={libraryStatusFilter}
              onChange={(event) => {
                setLibraryConfigurationId('');
                setLibraryStatusFilter(
                  event.target.value as 'ALL' | MasterDataStatus,
                );
                setLibraryPageNumber(1);
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Sort by</span>
            <select
              className="category-form__select"
              value={librarySortBy}
              onChange={(event) => {
                setLibrarySortBy(
                  event.target.value as ConfiguredVehicleLibrarySortBy,
                );
                setLibraryPageNumber(1);
              }}
            >
              {configuredVehicleSortOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Direction</span>
            <select
              className="category-form__select"
              value={librarySortDirection}
              onChange={(event) => {
                setLibrarySortDirection(event.target.value as SortDirection);
                setLibraryPageNumber(1);
              }}
            >
              <option value="ASC">Ascending</option>
              <option value="DESC">Descending</option>
            </select>
          </label>
          <div className="vehicle-library-toolbar__actions">
            <div>
              <strong>{visibleConfigurationCount}</strong>
              <span>
                {visibleConfigurationCount === 1
                  ? ' configured vehicle'
                  : ' configured vehicles'}
              </span>
            </div>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => {
                setLibraryConfigurationId('');
                setLibrarySearch('');
                setLibraryMakeFilter('');
                setLibraryModelFilter('');
                setLibraryStatusFilter('ALL');
                setLibraryPageNumber(1);
              }}
              disabled={
                !libraryConfigurationId &&
                !librarySearch &&
                !libraryMakeFilter &&
                !libraryModelFilter &&
                libraryStatusFilter === 'ALL'
              }
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="admin-library-shell__toolbar">
          <div className="admin-library-shell__toolbar-actions">
            <button
              className="button button--quiet"
              type="button"
              disabled={exportBusy}
              onClick={() => void exportConfiguredVehiclesCsv()}
            >
              {exportBusy ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        <AdminSavedViewsToolbar
          idPrefix="configured-vehicles"
          savedViews={savedViews}
          loading={savedViewsLoading}
          saving={savedViewSaving}
          selectedId={selectedSavedViewId}
          name={savedViewName}
          namePlaceholder="Active Corolla"
          error={savedViewError}
          onSelect={(view) => {
            if (view) applyConfiguredVehicleSavedView(view);
            else {
              setSelectedSavedViewId('');
              setSavedViewName('');
            }
          }}
          onNameChange={setSavedViewName}
          onSaveAsNew={() => void saveConfiguredVehicleView()}
          onUpdate={() => void updateConfiguredVehicleSavedView()}
          onDelete={() => void deleteConfiguredVehicleSavedView()}
        />

        {exportError ? (
          <div className="alert alert--error" role="alert">
            {exportError}
          </div>
        ) : null}

        {libraryLoading ? (
          <div className="catalog-state" aria-live="polite">
            <span className="spinner spinner--dark" aria-hidden="true" />
            <p>Loading Configured Vehicle library…</p>
          </div>
        ) : null}

        {libraryError ? (
          <div className="alert alert--error" role="alert">
            {libraryError}
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setLibraryReloadKey((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}

        {!libraryLoading && !libraryError && libraryPage.items.length === 0 ? (
          <p>No configured vehicles match the current search and filters.</p>
        ) : !libraryError &&
          libraryPage.items.length > 0 &&
          librarySortBy === 'HIERARCHY' ? (
          <div className="configured-vehicle-library">
            {libraryGroups.map((makeGroup) => {
              const makeConfigurationCount = makeGroup.models.reduce(
                (makeTotal, modelGroup) =>
                  makeTotal +
                  modelGroup.generations.reduce(
                    (modelTotal, generationGroup) =>
                      modelTotal +
                      generationGroup.trims.reduce(
                        (generationTotal, trimGroup) =>
                          generationTotal + trimGroup.configurations.length,
                        0,
                      ),
                    0,
                  ),
                0,
              );

              return (
                <section
                  className="configured-vehicle-library__make"
                  key={makeGroup.make.id}
                >
                  <header className="configured-vehicle-library__make-heading">
                    <div>
                      <span>Make</span>
                      <h3>{makeGroup.make.name}</h3>
                    </div>
                    <small>
                      {makeGroup.models.length}{' '}
                      {makeGroup.models.length === 1 ? 'model' : 'models'} ·{' '}
                      {makeConfigurationCount}{' '}
                      {makeConfigurationCount === 1
                        ? 'configured vehicle'
                        : 'configured vehicles'}
                    </small>
                  </header>

                  <div className="configured-vehicle-library__models">
                    {makeGroup.models.map((modelGroup) => (
                      <section
                        className="configured-vehicle-library__model"
                        key={modelGroup.model.id}
                      >
                        <div className="configured-vehicle-library__model-heading">
                          <div>
                            <span>Model</span>
                            <h3>{modelGroup.model.name}</h3>
                          </div>
                          <small>
                            {modelGroup.generations.length}{' '}
                            {modelGroup.generations.length === 1
                              ? 'generation'
                              : 'generations'}
                          </small>
                        </div>

                        <div className="configured-vehicle-library__generations">
                          {modelGroup.generations.map(
                            (generationGroup, generationIndex) => {
                              const generation = generationGroup.generation;
                              const generationKey =
                                generation?.id ??
                                `${modelGroup.model.id}-unknown-generation-${generationIndex}`;

                              return (
                                <section
                                  className="configured-vehicle-library__generation"
                                  key={generationKey}
                                >
                                  <div className="configured-vehicle-library__generation-heading">
                                    <div>
                                      <strong>
                                        {generation?.name ??
                                          'Generation not specified'}
                                      </strong>
                                      <span>
                                        {generation
                                          ? `${generation.code ?? 'No code'}${generationYearRange(
                                              generation,
                                            )}`
                                          : 'Legacy / incomplete configuration'}
                                        {generationGroup.derivative
                                          ? ` · Body line: ${generationGroup.derivative.name}`
                                          : ''}
                                      </span>
                                    </div>
                                    <small>
                                      {generationGroup.trims.length}{' '}
                                      {generationGroup.trims.length === 1
                                        ? 'trim'
                                        : 'trims'}
                                    </small>
                                  </div>

                                  <div className="configured-vehicle-library__trims">
                                    {generationGroup.trims.map(
                                      (trimGroup, trimIndex) => {
                                        const trim = trimGroup.trim;
                                        const trimKey =
                                          trim?.id ??
                                          `${generationKey}-unknown-trim-${trimIndex}`;

                                        return (
                                          <section
                                            className="configured-vehicle-library__trim"
                                            key={trimKey}
                                          >
                                            <div className="configured-vehicle-library__trim-heading">
                                              <div>
                                                <strong>
                                                  {trim?.name ??
                                                    'Trim not specified'}
                                                </strong>
                                                <span>
                                                  {trim
                                                    ? `${trim.code ?? 'No code'}${yearRange(
                                                        trim.startYear,
                                                        trim.endYear,
                                                      )}`
                                                    : 'Legacy / incomplete configuration'}
                                                </span>
                                              </div>
                                              <small>
                                                {
                                                  trimGroup.configurations
                                                    .length
                                                }{' '}
                                                {trimGroup.configurations
                                                  .length === 1
                                                  ? 'configuration'
                                                  : 'configurations'}
                                              </small>
                                            </div>

                                            <div className="vehicle-builder-existing__list">
                                              {trimGroup.configurations.map(
                                                (item) =>
                                                  renderLibraryConfigurationRow(
                                                    item,
                                                  ),
                                              )}
                                            </div>
                                          </section>
                                        );
                                      },
                                    )}
                                  </div>
                                </section>
                              );
                            },
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : !libraryError && libraryPage.items.length > 0 ? (
          <div className="vehicle-builder-existing__list">
            {libraryPresentation.configurations.map((item) =>
              renderLibraryConfigurationRow(item, true),
            )}
          </div>
        ) : null}

        {!libraryError && libraryPage.total > 0 ? (
          <AdminLibraryPagination
            page={libraryPage.page}
            pageCount={libraryPage.pageCount}
            pageSize={libraryPageSize}
            total={libraryPage.total}
            disabled={libraryLoading}
            onPageChange={setLibraryPageNumber}
            onPageSizeChange={(nextPageSize) => {
              setLibraryPageSize(nextPageSize);
              setLibraryPageNumber(1);
            }}
          />
        ) : null}
      </section>
    </section>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  const controlId = useId();

  return (
    <div className="field">
      <label className="field__label" htmlFor={`vehicle-builder-${controlId}`}>
        {label}
      </label>
      <AdminSearchableCombobox
        id={`vehicle-builder-${controlId}`}
        value={value}
        options={[{ id: '', label: placeholder }, ...options]}
        placeholder={placeholder}
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function isConfiguredVehicleSortBy(
  value: unknown,
): value is ConfiguredVehicleLibrarySortBy {
  return (
    value === 'HIERARCHY' ||
    value === 'UPDATED_AT' ||
    value === 'CREATED_AT' ||
    value === 'MAKE' ||
    value === 'MODEL' ||
    value === 'GENERATION' ||
    value === 'TRIM' ||
    value === 'MODEL_YEAR' ||
    value === 'CODE' ||
    value === 'STATUS'
  );
}

function isMasterStatusFilter(
  value: unknown,
): value is 'ALL' | MasterDataStatus {
  return (
    value === 'ALL' ||
    value === 'DRAFT' ||
    value === 'ACTIVE' ||
    value === 'INACTIVE' ||
    value === 'ARCHIVED'
  );
}

async function fetchVehicleList<T>(path: string): Promise<T[]> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Vehicle request failed: ${response.status}`);
  }
  return (await response.json()) as T[];
}

function configurationLibraryPresentation(
  items: VehicleConfigurationLibraryItem[],
): DataState {
  const makes = new Map<string, VehicleMakeRecord>();
  const models = new Map<string, VehicleModelRecord>();
  const derivatives = new Map<string, VehicleModelDerivativeRecord>();
  const generations = new Map<string, VehicleGenerationRecord>();
  const trims = new Map<string, VehicleTrimRecord>();
  const engines = new Map<string, VehicleEngineRecord>();
  const transmissions = new Map<string, VehicleTransmissionRecord>();
  const bodyTypes = new Map<string, VehicleNamedMasterRecord>();
  const markets = new Map<string, VehicleNamedMasterRecord>();
  const configurations: VehicleConfigurationRecord[] = [];

  for (const item of items) {
    const presentationStatus = item.status;

    if (!makes.has(item.make.id)) {
      makes.set(item.make.id, {
        id: item.make.id,
        code: item.make.code ?? '',
        name: item.make.name,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (!models.has(item.model.id)) {
      models.set(item.model.id, {
        id: item.model.id,
        makeId: item.make.id,
        code: item.model.code ?? '',
        name: item.model.name,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.derivative && !derivatives.has(item.derivative.id)) {
      derivatives.set(item.derivative.id, {
        id: item.derivative.id,
        modelId: item.model.id,
        code: item.derivative.code ?? '',
        name: item.derivative.name,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.generation && !generations.has(item.generation.id)) {
      generations.set(item.generation.id, {
        id: item.generation.id,
        modelId: item.model.id,
        derivativeId: item.derivative?.id ?? null,
        code: item.generation.code,
        name: item.generation.name,
        startYear: item.generation.startYear,
        endYear: item.generation.endYear,
        endStatus: item.generation.endStatus,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.trim && !trims.has(item.trim.id)) {
      trims.set(item.trim.id, {
        id: item.trim.id,
        generationId: item.generation?.id ?? '',
        code: item.trim.code,
        name: item.trim.name,
        equipmentLevel: item.trim.equipmentLevel,
        startYear: item.trim.startYear,
        endYear: item.trim.endYear,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.engine && !engines.has(item.engine.id)) {
      engines.set(item.engine.id, {
        id: item.engine.id,
        code: item.engine.code,
        name: item.engine.name,
        family: item.engine.family,
        displacementCc: item.engine.displacementCc,
        fuelType: item.engine.fuelType,
        cylinderCount: item.engine.cylinderCount,
        aspiration: item.engine.aspiration,
        powerKw: item.engine.powerKw,
        torqueNm: item.engine.torqueNm,
        startYear: null,
        endYear: null,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.transmission && !transmissions.has(item.transmission.id)) {
      transmissions.set(item.transmission.id, {
        id: item.transmission.id,
        code: item.transmission.code,
        transmissionType: item.transmission.transmissionType,
        gearCount: item.transmission.gearCount,
        driveType: item.transmission.driveType,
        startYear: null,
        endYear: null,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.bodyType && !bodyTypes.has(item.bodyType.id)) {
      bodyTypes.set(item.bodyType.id, {
        id: item.bodyType.id,
        code: item.bodyType.code ?? '',
        name: item.bodyType.name,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    if (item.market && !markets.has(item.market.id)) {
      markets.set(item.market.id, {
        id: item.market.id,
        code: item.market.code ?? '',
        name: item.market.name,
        status: presentationStatus,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    configurations.push({
      id: item.id,
      identityCode: item.identityCode,
      code: item.code,
      makeId: item.make.id,
      modelId: item.model.id,
      generationId: item.generation?.id ?? null,
      trimId: item.trim?.id ?? null,
      engineId: item.engine?.id ?? null,
      transmissionId: item.transmission?.id ?? null,
      bodyTypeId: item.bodyType?.id ?? null,
      marketId: item.market?.id ?? null,
      modelYear: item.modelYear,
      productionStartYear: item.productionStartYear,
      productionStartMonth: item.productionStartMonth,
      productionEndYear: item.productionEndYear,
      productionEndMonth: item.productionEndMonth,
      productionEndStatus: item.productionEndStatus,
      steeringSide: item.steeringSide,
      status: item.status,
      version: item.version,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  return {
    makes: [...makes.values()],
    models: [...models.values()],
    derivatives: [...derivatives.values()],
    generations: [...generations.values()],
    trims: [...trims.values()],
    engines: [...engines.values()],
    transmissions: [...transmissions.values()],
    bodyTypes: [...bodyTypes.values()],
    markets: [...markets.values()],
    configurations,
  };
}

function generationYearRange(generation: VehicleGenerationRecord): string {
  if (generation.endStatus === 'CURRENT') {
    return generation.startYear === null
      ? ' · Present'
      : ` · ${generation.startYear}–present`;
  }
  if (generation.endStatus === 'ENDED') {
    return yearRange(generation.startYear, generation.endYear);
  }
  if (generation.startYear !== null) {
    return ` · From ${generation.startYear} · end not verified`;
  }
  return ' · End not verified';
}

function yearRange(startYear: number | null, endYear: number | null): string {
  if (startYear === null && endYear === null) return '';
  if (startYear !== null && endYear !== null) {
    return ` · ${startYear}–${endYear}`;
  }
  if (startYear !== null) {
    return ` · From ${startYear} · end not specified`;
  }
  return ` · Through ${endYear}`;
}

function configurationVinReadiness(item: VehicleConfigurationRecord): string {
  const missing = [
    !item.modelYear && !item.productionStartYear ? 'year identity' : null,
    !item.bodyTypeId ? 'body type' : null,
    !item.marketId ? 'market' : null,
    !item.steeringSide ? 'steering side' : null,
  ].filter((value): value is string => Boolean(value));

  return missing.length === 0
    ? 'VIN matching detail: complete'
    : `VIN matching detail: ${missing.join(', ')} not specified`;
}

function configurationDescription(
  item: VehicleConfigurationRecord,
  data: DataState,
): string {
  const engine = data.engines.find((entry) => entry.id === item.engineId);
  const transmission = data.transmissions.find(
    (entry) => entry.id === item.transmissionId,
  );
  const body = data.bodyTypes.find((entry) => entry.id === item.bodyTypeId);
  const market = data.markets.find((entry) => entry.id === item.marketId);

  return [
    `Engine: ${engineTechnicalLabel(engine)}`,
    `Transmission: ${transmissionTechnicalLabel(transmission)}`,
    body?.name ? `Body: ${body.name}` : null,
    market?.name ? `Market: ${market.name}` : null,
    item.steeringSide ? `Steering: ${item.steeringSide}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
