'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import {
  createVehicleCode,
  hasVehicleManagePermission,
  type VehicleStatusFilter,
} from '@/lib/vehicle-management';
import type {
  CreateVehicleMakeInput,
  CreateVehicleModelInput,
  UpdateVehicleMakeInput,
  UpdateVehicleModelInput,
  VehicleMakePage,
  VehicleMakeRecord,
  VehicleModelPage,
  VehicleModelRecord,
  VehicleRootSummary,
} from '@/lib/vehicle-contracts';
import { useAdminPrincipal } from './admin-session';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import {
  AdminLibraryCount,
  AdminLibraryPagination,
  AdminLibraryToolbar,
  type AdminPageSize,
} from './admin-library-shell';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { VehicleAdminNav } from './vehicle-admin-nav';

type VehicleView = 'makes' | 'models';

type Editor =
  | { kind: 'make'; record: VehicleMakeRecord | null }
  | { kind: 'model'; record: VehicleModelRecord | null }
  | null;

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

  const [editor, setEditor] = useState<Editor>(null);
  const [makeId, setMakeId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [recordStatus, setRecordStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const editorKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: Boolean(editor),
    saving,
    focusKey: editor
      ? `${editor.kind}:${editor.record?.id ?? 'create'}`
      : 'closed',
    onEscape: closeForm,
  });

  const duplicateSearchUrl =
    editor?.kind === 'make'
      ? '/api/admin/vehicles/makes/page'
      : editor?.kind === 'model' && makeId
        ? `/api/admin/vehicles/models/page?makeId=${makeId}`
        : '';
  const duplicate = useLikelyDuplicate({
    enabled: Boolean(editor && !editor.record && duplicateSearchUrl),
    name,
    code,
    searchUrl: duplicateSearchUrl,
  });

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
  }, [
    canManage,
    makeFilter,
    pageNumber,
    pageSize,
    reloadKey,
    search,
    status,
    view,
  ]);

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

  const selectedMake = makes.find((make) => make.id === makeId);
  const activeModelAllowed = selectedMake?.status === 'ACTIVE';

  function resetFilters() {
    setSearch('');
    setStatus('ALL');
    setMakeFilter('ALL');
    setPageNumber(1);
  }

  function resetForm() {
    setEditor(null);
    setMakeId('');
    setCode('');
    setName('');
    setRecordStatus('DRAFT');
    setFormError('');
  }

  function openCreateMake() {
    resetForm();
    setEditor({ kind: 'make', record: null });
  }

  function openEditMake(make: VehicleMakeRecord) {
    resetForm();
    setEditor({ kind: 'make', record: make });
    setCode(make.code);
    setName(make.name);
    setRecordStatus(make.status);
  }

  function openCreateModel() {
    resetForm();
    const defaultMakeId =
      makeFilter === 'ALL' ? sortedMakes[0]?.id ?? '' : makeFilter;
    setMakeId(defaultMakeId);
    setEditor({ kind: 'model', record: null });
  }

  function openEditModel(model: VehicleModelRecord) {
    resetForm();
    setEditor({ kind: 'model', record: model });
    setMakeId(model.makeId);
    setCode(model.code);
    setName(model.name);
    setRecordStatus(model.status);
  }

  function closeForm() {
    if (!saving) resetForm();
  }

  function handleNameChange(value: string) {
    const generatedCode = createVehicleCode(value);
    const previousGeneratedCode = createVehicleCode(name);

    if (!editor?.record && (!code || code === previousGeneratedCode)) {
      setCode(generatedCode);
    }

    setName(value);
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

    setSaving(true);
    setFormError('');

    try {
      if (editor.kind === 'make') {
        if (editor.record) {
          const input: UpdateVehicleMakeInput = {
            version: editor.record.version,
            name: name.trim(),
            status: recordStatus,
          };
          const updated = await patchJson<VehicleMakeRecord>(
            `/api/admin/vehicles/makes/${editor.record.id}`,
            input,
          );
          setMakes((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        } else {
          const input: CreateVehicleMakeInput = {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            status: recordStatus,
          };
          const created = await postJson<VehicleMakeRecord>(
            '/api/admin/vehicles/makes',
            input,
          );
          setMakes((current) => [...current, created]);
        }
      } else if (editor.record) {
        const input: UpdateVehicleModelInput = {
          version: editor.record.version,
          name: name.trim(),
          status: recordStatus,
        };
        const updated = await patchJson<VehicleModelRecord>(
          `/api/admin/vehicles/models/${editor.record.id}`,
          input,
        );
        setModels((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const input: CreateVehicleModelInput = {
          makeId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          status: recordStatus,
        };
        const created = await postJson<VehicleModelRecord>(
          '/api/admin/vehicles/models',
          input,
        );
        setModels((current) => [...current, created]);
        window.location.assign(
          `/admin/vehicles/configurations?modelId=${created.id}`,
        );
        return;
      }

      setReloadKey((current) => current + 1);
      resetForm();
    } catch (requestError) {
      if (requestError instanceof ClientApiError) {
        setFormError(requestError.message);
      } else {
        setFormError('The vehicle record could not be saved. Please try again.');
      }
    } finally {
      setSaving(false);
    }
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
            ? 'Manage canonical vehicle manufacturers used across Lemekinaye.'
            : 'Manage canonical models under their vehicle makes.'
        }
        actions={
          <button
            className="button button--primary"
            type="button"
            disabled={view === 'models' && makes.length === 0}
            onClick={view === 'makes' ? openCreateMake : openCreateModel}
          >
            + Add {view === 'makes' ? 'make' : 'model'}
          </button>
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
          active={Boolean(search.trim() || status !== 'ALL' || (view === 'models' && makeFilter !== 'ALL'))}
          onReset={resetFilters}
        />

        <AdminLibraryCount
          count={total}
          singular={view === 'makes' ? 'make' : 'model'}
          plural={view === 'makes' ? 'makes' : 'models'}
        />
      </AdminLibraryToolbar>

      {editor ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Vehicle editor"
            disabled={saving}
            onClick={closeForm}
          />
          <aside
            className="catalog-drawer catalog-drawer--compact vehicle-root-editor-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={editor.kind === 'make' ? 'Vehicle Make editor' : 'Vehicle Model editor'}
          >
            <form
                      className="catalog-drawer__form vehicle-root-editor-form"
                      ref={editorKeyboard.ref}
                      onKeyDown={editorKeyboard.onKeyDown}
                      onSubmit={saveRecord}
                    >
                      <div className="catalog-drawer__heading">
                        <div>
                          <span className="eyebrow">
                            {editor.record ? 'Edit' : 'New'}{' '}
                            {editor.kind === 'make' ? 'vehicle make' : 'vehicle model'}
                          </span>
                          <h2>
                            {editor.record?.name ??
                              (editor.kind === 'make'
                                ? 'Create vehicle make'
                                : 'Create vehicle model')}
                          </h2>
                        </div>
                        <button
                          className="button button--quiet"
                          type="button"
                          disabled={saving}
                          onClick={closeForm}
                        >
                          Close
                        </button>
                      </div>

                      {formError ? (
                        <div className="alert alert--error" role="alert">
                          {formError}
                        </div>
                      ) : null}

                      <div className="catalog-drawer__fields vehicle-root-editor-fields"><div className="category-form__grid">
                        {editor.kind === 'model' ? (
                          <div className="field">
                            <span className="field__label">Vehicle make</span>
                            <AdminSearchableCombobox
                              id="vehicle-model-make"
                              value={makeId}
                              options={sortedMakes.map((make) => ({
                                id: make.id,
                                label: make.name,
                                meta: formatAdminEnumLabel(make.status),
                              }))}
                              placeholder="Select make"
                              searchPlaceholder="Search vehicle makes…"
                              disabled={Boolean(editor.record)}
                              onChange={(nextMakeId) => {
                                setMakeId(nextMakeId);
                                const nextMake = makes.find(
                                  (make) => make.id === nextMakeId,
                                );
                                if (
                                  recordStatus === 'ACTIVE' &&
                                  nextMake?.status !== 'ACTIVE'
                                ) {
                                  setRecordStatus('DRAFT');
                                }
                              }}
                            />
                          </div>
                        ) : null}

                        <label className="field">
                          <span className="field__label">
                            {editor.kind === 'make' ? 'Make name' : 'Model name'}
                          </span>
                          <input
                            maxLength={120}
                            required
                            value={name}
                            placeholder={
                              editor.kind === 'make' ? 'Example: Toyota' : 'Example: Corolla'
                            }
                            onChange={(event) => handleNameChange(event.target.value)}
                          />
                        </label>

                        {editor.record ? (
                          <label className="field">
                            <span className="field__label">Lifecycle status</span>
                            <select
                              className="category-form__select"
                              value={recordStatus}
                              onChange={(event) =>
                                setRecordStatus(event.target.value as MasterDataStatus)
                              }
                            >
                              <option value="DRAFT">Draft</option>
                              <option
                                value="ACTIVE"
                                disabled={
                                  editor.kind === 'model' && !activeModelAllowed
                                }
                              >
                                Active
                              </option>
                              <option value="INACTIVE">Inactive</option>
                              <option value="ARCHIVED">Archived</option>
                            </select>
                          </label>
                        ) : null}
                      </div>

                      </div>

                      {!editor.record ? (
                        <LikelyDuplicateWarning
                          match={duplicate.match}
                          checking={duplicate.checking}
                        />
                      ) : null}

                      {!editor.record ? (
                        <div className="vehicle-form__context">
                          New {editor.kind === 'make' ? 'Makes' : 'Models'} are created as
                          Draft so they can be reviewed before activation.
                        </div>
                      ) : null}

                      {editor.kind === 'model' && selectedMake?.status !== 'ACTIVE' ? (
                        <div className="vehicle-form__context">
                          This Model can be maintained as Draft, but activation requires an
                          Active Vehicle Make.
                        </div>
                      ) : null}

                      <details className="catalog-workspace-advanced">
                        <summary>Advanced technical fields</summary>
                        <div className="category-form__grid">
                          <label className="field">
                            <span className="field__label">Canonical code</span>
                            <input
                              maxLength={50}
                              pattern="[A-Z][A-Z0-9_]{1,49}"
                              required
                              disabled={Boolean(editor.record)}
                              value={code}
                              onChange={(event) =>
                                setCode(
                                  event.target.value
                                    .toUpperCase()
                                    .replace(/[^A-Z0-9_]/g, '_'),
                                )
                              }
                            />
                            <small className="field__hint">
                              {editor.record
                                ? 'Stable identifier. It is immutable after creation.'
                                : 'Generated automatically from the name. Change only when governance or migration requires a specific identifier.'}
                            </small>
                          </label>
                        </div>
                      </details>

                      {editor.record ? (
                        <div className="vehicle-form__context">
                          {editor.kind === 'model'
                            ? 'The Model-to-Make relationship and canonical code are immutable after creation.'
                            : 'The canonical code is immutable after creation.'}{' '}
                          This update will use version {editor.record.version}.
                        </div>
                      ) : null}

                      <div className="catalog-drawer__actions vehicle-root-editor-actions">
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={
                            saving ||
                            !name.trim() ||
                            !code.trim() ||
                            (editor.kind === 'model' && !makeId)
                          }
                        >
                          {saving
                            ? 'Saving…'
                            : editor.record
                              ? 'Save changes'
                              : `Create draft ${editor.kind === 'make' ? 'Make' : 'Model'}`}
                        </button>
                      </div>
                    </form>
          </aside>
        </div>
      ) : null}

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
          canManage={canManage}
          onEdit={openEditMake}
          onLifecycleCompleted={() =>
            setReloadKey((current) => current + 1)
          }
        />
      ) : (
        <VehicleModelList
          models={visibleModels}
          makeNames={makeNames}
          canManage={canManage}
          onEdit={openEditModel}
          onLifecycleCompleted={() =>
            setReloadKey((current) => current + 1)
          }
        />
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
  canManage,
  onEdit,
  onLifecycleCompleted,
}: {
  makes: VehicleMakeRecord[];
  modelCountsByMake: Record<string, number>;
  canManage: boolean;
  onEdit: (make: VehicleMakeRecord) => void;
  onLifecycleCompleted: () => void;
}) {
  if (makes.length === 0) {
    return (
      <AdminEmptyState
        title="No vehicle makes found"
        description="Create a make or change the lifecycle filter."
      />
    );
  }

  return (
    <div className="vehicle-list" role="table" aria-label="Vehicle Makes library">
      <div className="vehicle-row vehicle-row--header" role="row">
        <span role="columnheader">Make</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Models</span>
        <span role="columnheader">Version</span>
        <span role="columnheader">Action</span>
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
            <span className="vehicle-row__version" role="cell">v{make.version}</span>
            <span role="cell">
              <button
                className="button button--quiet"
                type="button"
                onClick={() => onEdit(make)}
              >
                Edit
              </button>
              <AdminMasterLifecycleActions
                domain="VEHICLE"
                entityType="VEHICLE_MAKE"
                entityId={make.id}
                entityName={make.name}
                status={make.status}
                version={make.version}
                reactivatePath={`/api/admin/vehicles/makes/${make.id}`}
                disabled={!canManage}
                onCompleted={onLifecycleCompleted}
              />
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
  canManage,
  onEdit,
  onLifecycleCompleted,
}: {
  models: VehicleModelRecord[];
  makeNames: Map<string, string>;
  canManage: boolean;
  onEdit: (model: VehicleModelRecord) => void;
  onLifecycleCompleted: () => void;
}) {
  if (models.length === 0) {
    return (
      <AdminEmptyState
        title="No vehicle models found"
        description="Create a model or change the make and lifecycle filters."
      />
    );
  }

  return (
    <div className="vehicle-list" role="table" aria-label="Vehicle Models library">
      <div
        className="vehicle-row vehicle-row--model vehicle-row--header"
        role="row"
      >
        <span role="columnheader">Model</span>
        <span role="columnheader">Make</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Version</span>
        <span role="columnheader">Configure</span>
        <span role="columnheader">Action</span>
      </div>
      {models.map((model) => (
        <div className="vehicle-row vehicle-row--model" role="row" key={model.id}>
          <div className="vehicle-row__identity" role="cell">
            <strong>{model.name}</strong>
            <span>{model.code}</span>
          </div>
          <div className="vehicle-row__make" role="cell">
            <small>Make</small>
            <span>{makeNames.get(model.makeId) ?? 'Unknown make'}</span>
          </div>
          <AdminStatusBadge status={model.status} role="cell" />
          <span className="vehicle-row__version" role="cell">v{model.version}</span>
          <span role="cell">
            <a
              className="button button--secondary vehicle-row__build"
              href={`/admin/vehicles/configurations?modelId=${model.id}`}
            >
              Configure vehicle
            </a>
          </span>
          <span role="cell">
            <button
              className="button button--quiet"
              type="button"
              onClick={() => onEdit(model)}
            >
              Edit
            </button>
            <AdminMasterLifecycleActions
              domain="VEHICLE"
              entityType="VEHICLE_MODEL"
              entityId={model.id}
              entityName={model.name}
              status={model.status}
              version={model.version}
              reactivatePath={`/api/admin/vehicles/models/${model.id}`}
              disabled={!canManage}
              onCompleted={onLifecycleCompleted}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
