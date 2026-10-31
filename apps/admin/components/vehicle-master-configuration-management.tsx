'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  MasterDataLifecycleEntityType,
  MasterDataStatus,
} from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import {
  engineTechnicalLabel,
  transmissionTechnicalLabel,
} from '@/lib/vehicle-builder';
import { hasVehicleManagePermission } from '@/lib/vehicle-management';
import type {
  CreateMasterDataProvenanceInput,
  CreateVehicleConfigurationInput,
  CreateVehicleEngineInput,
  CreateVehicleGenerationInput,
  CreateVehicleModelDerivativeInput,
  CreateVehicleNamedMasterInput,
  CreateVehicleTransmissionInput,
  CreateVehicleTrimInput,
  MasterDataProvenanceRecord,
  ProvenanceVerificationState,
  UpdateMasterDataProvenanceInput,
  UpdateVehicleConfigurationInput,
  UpdateVehicleEngineInput,
  UpdateVehicleGenerationInput,
  UpdateVehicleModelDerivativeInput,
  UpdateVehicleNamedMasterInput,
  UpdateVehicleTransmissionInput,
  UpdateVehicleTrimInput,
  VehicleConfigurationActivationValidation,
  VehicleConfigurationLibraryItem,
  VehicleConfigurationLibraryPage,
  VehicleConfigurationRecord,
  VehicleEngineRecord,
  VehicleGenerationRecord,
  VehicleMakeRecord,
  VehicleModelRecord,
  VehicleModelDerivativeRecord,
  VehicleNamedMasterRecord,
  VehicleSteeringSide,
  VehicleTransmissionRecord,
  VehicleTrimRecord,
} from '@/lib/vehicle-contracts';
import { useAdminPrincipal } from './admin-session';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import { useAdminOverlayKeyboard } from '@/lib/use-admin-overlay-keyboard';
import { VehicleAdminNav } from './vehicle-admin-nav';

type View =
  | 'derivatives'
  | 'generations'
  | 'trims'
  | 'engines'
  | 'transmissions'
  | 'body-types'
  | 'markets'
  | 'configurations';

type MasterPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type EditableRecord =
  | VehicleModelDerivativeRecord
  | VehicleGenerationRecord
  | VehicleTrimRecord
  | VehicleEngineRecord
  | VehicleTransmissionRecord
  | VehicleNamedMasterRecord
  | VehicleConfigurationRecord;

const PROVENANCE_STATES: ProvenanceVerificationState[] = [
  'UNVERIFIED',
  'REVIEWED',
  'VERIFIED',
  'REJECTED',
];

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'derivatives', label: 'Derivatives / Body Lines' },
  { value: 'generations', label: 'Generations' },
  { value: 'trims', label: 'Trims' },
  { value: 'engines', label: 'Engines' },
  { value: 'transmissions', label: 'Transmissions' },
  { value: 'body-types', label: 'Body Types' },
  { value: 'markets', label: 'Markets' },
  { value: 'configurations', label: 'Configuration records — Advanced' },
];

export function VehicleMasterConfigurationManagement() {
  const principal = useAdminPrincipal();
  const canManage = hasVehicleManagePermission(principal.permissions);

  const [view, setView] = useState<View>('generations');
  const [makes, setMakes] = useState<VehicleMakeRecord[]>([]);
  const [models, setModels] = useState<VehicleModelRecord[]>([]);
  const [derivatives, setDerivatives] = useState<VehicleModelDerivativeRecord[]>([]);
  const [generations, setGenerations] = useState<VehicleGenerationRecord[]>([]);
  const [trims, setTrims] = useState<VehicleTrimRecord[]>([]);
  const [engines, setEngines] = useState<VehicleEngineRecord[]>([]);
  const [transmissions, setTransmissions] = useState<VehicleTransmissionRecord[]>([]);
  const [bodyTypes, setBodyTypes] = useState<VehicleNamedMasterRecord[]>([]);
  const [markets, setMarkets] = useState<VehicleNamedMasterRecord[]>([]);
  const [configurations, setConfigurations] = useState<VehicleConfigurationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryStatus, setLibraryStatus] =
    useState<'ALL' | MasterDataStatus>('ALL');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [formReferenceLoading, setFormReferenceLoading] = useState(false);

  const [editing, setEditing] = useState<EditableRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<MasterDataStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [lifecycleWorkingId, setLifecycleWorkingId] = useState<string | null>(
    null,
  );
  const [validatedVersions, setValidatedVersions] = useState<
    Record<string, number>
  >({});
  const [lifecycleNotice, setLifecycleNotice] = useState('');
  const [lifecycleError, setLifecycleError] = useState('');
  const [provenanceTarget, setProvenanceTarget] =
    useState<VehicleConfigurationRecord | null>(null);
  const [provenanceRecords, setProvenanceRecords] = useState<
    MasterDataProvenanceRecord[]
  >([]);
  const [editingProvenance, setEditingProvenance] =
    useState<MasterDataProvenanceRecord | null>(null);
  const [provenanceForm, setProvenanceForm] = useState<Record<string, string>>({});
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [provenanceSaving, setProvenanceSaving] = useState(false);
  const [provenanceError, setProvenanceError] = useState('');

  const editorKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editing?.id ?? `${view}:create`,
    onEscape: resetEditor,
  });

  const provenanceDrawerRef = useAdminOverlayKeyboard<HTMLElement>({
    open: Boolean(provenanceTarget),
    closeDisabled: provenanceSaving,
    onClose: closeProvenance,
  });

  const duplicateName =
    view === 'transmissions'
      ? (form.transmissionType ?? '')
      : (form.name ?? '');
  const duplicateSearchUrl = (() => {
    if (view === 'configurations') {
      return '/api/admin/vehicles/configuration-library';
    }
    const base = `/api/admin/vehicles/master/${view}/page`;
    if (view === 'derivatives' && form.modelId) {
      return `${base}?modelId=${form.modelId}`;
    }
    if (view === 'generations' && form.modelId) {
      const derivative = form.derivativeId
        ? `&derivativeId=${form.derivativeId}`
        : '';
      return `${base}?modelId=${form.modelId}${derivative}`;
    }
    if (view === 'trims' && form.generationId) {
      return `${base}?generationId=${form.generationId}`;
    }
    return base;
  })();
  const duplicate = useLikelyDuplicate({
    enabled: formOpen && !editing && Boolean(duplicateSearchUrl),
    name: view === 'configurations' ? '' : duplicateName,
    code: form.code,
    searchUrl: duplicateSearchUrl,
  });

  useEffect(() => {
    if (!canManage) {
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
        const search = librarySearch.trim();
        if (search) query.set('search', search);
        if (libraryStatus !== 'ALL') query.set('status', libraryStatus);

        if (view === 'configurations') {
          const page = await fetchJson<VehicleConfigurationLibraryPage>(
            `/api/admin/vehicles/configuration-library?${query.toString()}`,
          );
          if (!active) return;

          const presentation = configurationLibraryPresentation(page.items);
          setMakes(presentation.makes);
          setModels(presentation.models);
          setDerivatives(presentation.derivatives);
          setGenerations(presentation.generations);
          setTrims(presentation.trims);
          setEngines(presentation.engines);
          setTransmissions(presentation.transmissions);
          setBodyTypes(presentation.bodyTypes);
          setMarkets(presentation.markets);
          setConfigurations(presentation.configurations);
          setValidatedVersions({});
          setLifecycleError('');
          setTotal(page.total);
          setPageCount(page.pageCount);
          if (page.pageCount > 0 && pageNumber > page.pageCount) {
            setPageNumber(page.pageCount);
          }
          return;
        }

        const page = await fetchJson<MasterPage<EditableRecord>>(
          `/api/admin/vehicles/master/${view}/page?${query.toString()}`,
        );
        if (!active) return;

        setRecordsForView(view, page.items);
        await hydrateVisibleContext(view, page.items, () => active);
        if (!active) return;

        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setLoadError(
            'This Vehicle Master library could not be loaded. Change the filters or retry.',
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
    canManage,
    librarySearch,
    libraryStatus,
    pageNumber,
    reloadKey,
    view,
  ]);

  function resetProvenanceForm(record?: MasterDataProvenanceRecord | null) {
    setEditingProvenance(record ?? null);
    setProvenanceForm(
      record
        ? {
            sourceName: record.sourceName,
            sourceReference: record.sourceReference ?? '',
            sourceUrl: record.sourceUrl ?? '',
            observedAt: record.observedAt?.slice(0, 10) ?? '',
            verificationState: record.verificationState,
            notes: record.notes ?? '',
          }
        : {
            sourceName: '',
            sourceReference: '',
            sourceUrl: '',
            observedAt: '',
            verificationState: 'UNVERIFIED',
            notes: '',
          },
    );
    setProvenanceError('');
  }

  async function loadProvenance(configurationId: string) {
    setProvenanceLoading(true);
    setProvenanceError('');
    try {
      const records = await fetchJson<MasterDataProvenanceRecord[]>(
        '/api/admin/vehicles/master/configurations/' +
          configurationId +
          '/provenance',
      );
      setProvenanceRecords(records);
    } catch {
      setProvenanceError(
        'Source provenance could not be loaded. Reload and try again.',
      );
    } finally {
      setProvenanceLoading(false);
    }
  }

  async function openProvenance(record: VehicleConfigurationRecord) {
    setProvenanceTarget(record);
    setProvenanceRecords([]);
    resetProvenanceForm();
    await loadProvenance(record.id);
  }

  function closeProvenance() {
    if (provenanceSaving) return;
    setProvenanceTarget(null);
    setProvenanceRecords([]);
    resetProvenanceForm();
  }

  async function saveProvenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provenanceTarget) return;

    const sourceName = provenanceForm.sourceName?.trim();
    if (!sourceName) {
      setProvenanceError('Source name is required.');
      return;
    }

    setProvenanceSaving(true);
    setProvenanceError('');
    try {
      const observedAt = provenanceForm.observedAt
        ? new Date(
            provenanceForm.observedAt + 'T00:00:00.000Z',
          ).toISOString()
        : undefined;
      if (editingProvenance) {
        await patchJson<MasterDataProvenanceRecord>(
          '/api/admin/vehicles/master/configurations/' +
            provenanceTarget.id +
            '/provenance/' +
            editingProvenance.id,
          {
            version: editingProvenance.version,
            sourceName,
            sourceReference: provenanceForm.sourceReference?.trim() || null,
            sourceUrl: provenanceForm.sourceUrl?.trim() || null,
            observedAt: observedAt ?? null,
            verificationState:
              (provenanceForm.verificationState as ProvenanceVerificationState) ??
              'UNVERIFIED',
            notes: provenanceForm.notes?.trim() || null,
          } satisfies UpdateMasterDataProvenanceInput,
        );
      } else {
        await postJson<MasterDataProvenanceRecord>(
          '/api/admin/vehicles/master/configurations/' +
            provenanceTarget.id +
            '/provenance',
          {
            sourceName,
            sourceReference: provenanceForm.sourceReference?.trim() || undefined,
            sourceUrl: provenanceForm.sourceUrl?.trim() || undefined,
            observedAt,
            verificationState:
              (provenanceForm.verificationState as ProvenanceVerificationState) ??
              'UNVERIFIED',
            notes: provenanceForm.notes?.trim() || undefined,
          } satisfies CreateMasterDataProvenanceInput,
        );
      }
      await loadProvenance(provenanceTarget.id);
      resetProvenanceForm();
      provenanceDrawerRef.markPristine();
    } catch (error) {
      setProvenanceError(
        error instanceof ClientApiError
          ? error.message
          : 'Source provenance could not be saved.',
      );
    } finally {
      setProvenanceSaving(false);
    }
  }

  function setRecordsForView(nextView: View, records: EditableRecord[]) {
    if (nextView === 'derivatives') {
      setDerivatives(records as VehicleModelDerivativeRecord[]);
    } else if (nextView === 'generations') {
      setGenerations(records as VehicleGenerationRecord[]);
    } else if (nextView === 'trims') {
      setTrims(records as VehicleTrimRecord[]);
    } else if (nextView === 'engines') {
      setEngines(records as VehicleEngineRecord[]);
    } else if (nextView === 'transmissions') {
      setTransmissions(records as VehicleTransmissionRecord[]);
    } else if (nextView === 'body-types') {
      setBodyTypes(records as VehicleNamedMasterRecord[]);
    } else if (nextView === 'markets') {
      setMarkets(records as VehicleNamedMasterRecord[]);
    }
  }

  async function hydrateVisibleContext(
    nextView: View,
    records: EditableRecord[],
    isActive: () => boolean,
  ) {
    if (nextView === 'derivatives') {
      const modelIds = uniqueIds(
        (records as VehicleModelDerivativeRecord[]).map((item) => item.modelId),
      );
      const visibleModels = await Promise.all(
        modelIds.map((id) =>
          fetchJson<VehicleModelRecord>(`/api/admin/vehicles/models/${id}`),
        ),
      );
      if (isActive()) setModels(visibleModels);
      return;
    }

    if (nextView === 'generations') {
      const generationRecords = records as VehicleGenerationRecord[];
      const modelIds = uniqueIds(generationRecords.map((item) => item.modelId));
      const derivativeIds = uniqueIds(
        generationRecords.map((item) => item.derivativeId),
      );
      const [visibleModels, visibleDerivatives] = await Promise.all([
        Promise.all(
          modelIds.map((id) =>
            fetchJson<VehicleModelRecord>(`/api/admin/vehicles/models/${id}`),
          ),
        ),
        Promise.all(
          derivativeIds.map((id) =>
            fetchJson<VehicleModelDerivativeRecord>(
              `/api/admin/vehicles/master/derivatives/${id}`,
            ),
          ),
        ),
      ]);
      if (isActive()) {
        setModels(visibleModels);
        setDerivatives(visibleDerivatives);
      }
      return;
    }

    if (nextView === 'trims') {
      const generationIds = uniqueIds(
        (records as VehicleTrimRecord[]).map((item) => item.generationId),
      );
      const visibleGenerations = await Promise.all(
        generationIds.map((id) =>
          fetchJson<VehicleGenerationRecord>(
            `/api/admin/vehicles/master/generations/${id}`,
          ),
        ),
      );
      if (isActive()) setGenerations(visibleGenerations);
    }
  }

  const names = useMemo(
    () => ({
      makes: new Map(makes.map((item) => [item.id, item.name])),
      models: new Map(models.map((item) => [item.id, item.name])),
      derivatives: new Map(derivatives.map((item) => [item.id, item.name])),
      generations: new Map(generations.map((item) => [item.id, item.name])),
      trims: new Map(trims.map((item) => [item.id, item.name])),
      engines: new Map(
        engines.map((item) => [item.id, engineTechnicalLabel(item)]),
      ),
      transmissions: new Map(
        transmissions.map((item) => [
          item.id,
          transmissionTechnicalLabel(item),
        ]),
      ),
      bodyTypes: new Map(bodyTypes.map((item) => [item.id, item.name])),
      markets: new Map(markets.map((item) => [item.id, item.name])),
    }),
    [makes, models, derivatives, generations, trims, engines, transmissions, bodyTypes, markets],
  );

  function resetEditor() {
    setEditing(null);
    setFormOpen(false);
    setForm({});
    setStatus('DRAFT');
    setFormError('');
  }

  async function loadFormReferences(nextView: View) {
    setFormReferenceLoading(true);
    try {
      if (nextView === 'derivatives') {
        setModels(
          await fetchJson<VehicleModelRecord[]>('/api/admin/vehicles/models'),
        );
      } else if (nextView === 'generations') {
        const [modelData, derivativeData] = await Promise.all([
          fetchJson<VehicleModelRecord[]>('/api/admin/vehicles/models'),
          fetchJson<VehicleModelDerivativeRecord[]>(
            '/api/admin/vehicles/master/derivatives',
          ),
        ]);
        setModels(modelData);
        setDerivatives(derivativeData);
      } else if (nextView === 'trims') {
        setGenerations(
          await fetchJson<VehicleGenerationRecord[]>(
            '/api/admin/vehicles/master/generations',
          ),
        );
      } else if (nextView === 'configurations') {
        const [
          makeData,
          modelData,
          derivativeData,
          generationData,
          trimData,
          engineData,
          transmissionData,
          bodyTypeData,
          marketData,
        ] = await Promise.all([
          fetchJson<VehicleMakeRecord[]>('/api/admin/vehicles/makes'),
          fetchJson<VehicleModelRecord[]>('/api/admin/vehicles/models'),
          fetchJson<VehicleModelDerivativeRecord[]>(
            '/api/admin/vehicles/master/derivatives',
          ),
          fetchJson<VehicleGenerationRecord[]>(
            '/api/admin/vehicles/master/generations',
          ),
          fetchJson<VehicleTrimRecord[]>('/api/admin/vehicles/master/trims'),
          fetchJson<VehicleEngineRecord[]>('/api/admin/vehicles/master/engines'),
          fetchJson<VehicleTransmissionRecord[]>(
            '/api/admin/vehicles/master/transmissions',
          ),
          fetchJson<VehicleNamedMasterRecord[]>(
            '/api/admin/vehicles/master/body-types',
          ),
          fetchJson<VehicleNamedMasterRecord[]>(
            '/api/admin/vehicles/master/markets',
          ),
        ]);
        setMakes(makeData);
        setModels(modelData);
        setDerivatives(derivativeData);
        setGenerations(generationData);
        setTrims(trimData);
        setEngines(engineData);
        setTransmissions(transmissionData);
        setBodyTypes(bodyTypeData);
        setMarkets(marketData);
      }
    } finally {
      setFormReferenceLoading(false);
    }
  }

  async function openCreate() {
    setEditing(null);
    setForm({});
    setStatus('DRAFT');
    setFormError('');
    try {
      await loadFormReferences(view);
      setFormOpen(true);
    } catch {
      setFormOpen(true);
      setFormError(
        'Reference choices for this form could not be loaded. Retry before saving.',
      );
    }
  }

  async function openEdit(record: EditableRecord) {
    setEditing(record);
    setStatus(record.status);
    setForm(recordToForm(view, record));
    setFormError('');
    try {
      await loadFormReferences(view);
      setFormOpen(true);
    } catch {
      setFormOpen(true);
      setFormError(
        'Reference choices for this form could not be loaded. Retry before saving.',
      );
    }
  }

  function switchView(next: View) {
    resetEditor();
    setLibrarySearch('');
    setLibraryStatus('ALL');
    setPageNumber(1);
    setPageCount(0);
    setTotal(0);
    setView(next);
  }

  function setField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function validateConfiguration(
    record: VehicleConfigurationRecord,
  ) {
    setLifecycleWorkingId(record.id);
    setLifecycleError('');
    setLifecycleNotice('');

    try {
      const result = await fetchJson<VehicleConfigurationActivationValidation>(
        `/api/admin/vehicles/master/configurations/${record.id}/validate-activation`,
      );
      setValidatedVersions((current) => ({
        ...current,
        [record.id]: result.version,
      }));
      setLifecycleNotice(
        `${record.identityCode} passed activation validation at version ${result.version}.`,
      );
    } catch (error) {
      setValidatedVersions((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      setLifecycleError(
        error instanceof Error
          ? error.message
          : 'This configured vehicle is not ready for activation.',
      );
    } finally {
      setLifecycleWorkingId(null);
    }
  }

  async function validateAndActivateConfiguration(
    record: VehicleConfigurationRecord,
  ) {
    setLifecycleWorkingId(record.id);
    setLifecycleError('');
    setLifecycleNotice('');

    try {
      const validation =
        await fetchJson<VehicleConfigurationActivationValidation>(
          `/api/admin/vehicles/master/configurations/${record.id}/validate-activation`,
        );

      const updated = await patchJson<VehicleConfigurationRecord>(
        `/api/admin/vehicles/master/configurations/${record.id}`,
        {
          version: validation.version,
          status: 'ACTIVE',
        } satisfies UpdateVehicleConfigurationInput,
      );

      setValidatedVersions((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      setLifecycleNotice(`${updated.identityCode} validated and activated.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setLifecycleError(
        error instanceof ClientApiError
          ? error.message
          : 'The configured vehicle could not be validated and activated.',
      );
    } finally {
      setLifecycleWorkingId(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const referenceError = requiredVehicleReferenceError(
      view,
      form,
      editing,
      status,
    );
    if (referenceError) {
      setFormError(referenceError);
      return;
    }

    setSaving(true);
    try {
      const resource = view;
      const body = buildPayload(view, form, status, editing);
      if (editing) {
        await patchJson<EditableRecord>(
          `/api/admin/vehicles/master/${resource}/${editing.id}`,
          body,
        );
      } else {
        await postJson<EditableRecord>(
          `/api/admin/vehicles/master/${resource}`,
          body,
        );
      }
      resetEditor();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(
        error instanceof ClientApiError
          ? error.message
          : 'The vehicle master record could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Vehicle management</span>
        <h1>Advanced Vehicle Master Libraries</h1>
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have the vehicle.manage permission.</p>
        </div>
      </section>
    );
  }

  const records = recordsForView(view, {
    derivatives,
    generations,
    trims,
    engines,
    transmissions,
    bodyTypes,
    markets,
    configurations,
  });
  const pageStart = total === 0 ? 0 : (pageNumber - 1) * 50 + 1;
  const pageEnd = total === 0 ? 0 : Math.min(total, pageNumber * 50);
  const filtersActive =
    librarySearch.trim().length > 0 || libraryStatus !== 'ALL';

  return (
    <section className="catalog-page">
      <AdminPageHeader
        eyebrow="Vehicle management"
        title="Advanced Vehicle Master Libraries"
        description="Deep maintenance for reusable hierarchy, technical and reference masters. Configured Vehicles remains the primary guided workspace; the advanced configuration subview is for record-level maintenance only."
        actions={
          <button
            className="button button--primary"
            type="button"
            disabled={formReferenceLoading}
            onClick={() => void openCreate()}
          >
            {formReferenceLoading
              ? 'Loading…'
              : `+ Add ${labelForView(view, false)}`}
          </button>
        }
      />

      <VehicleAdminNav active="advanced-masters" />

      <div className="vehicle-master-subtabs" role="tablist" aria-label="Advanced vehicle master libraries">
        {VIEWS.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={view === item.value}
            className={view === item.value ? 'vehicle-master-subtabs__active' : undefined}
            onClick={() => switchView(item.value)}
            key={item.value}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="catalog-toolbar catalog-toolbar--filters">
        <div className="catalog-filter">
          <label htmlFor="vehicle-master-search">Search</label>
          <input
            id="vehicle-master-search"
            type="search"
            value={librarySearch}
            placeholder={searchPlaceholderForView(view)}
            onChange={(event) => {
              setLibrarySearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>
        <div className="catalog-filter">
          <label htmlFor="vehicle-master-status">Status</label>
          <select
            id="vehicle-master-status"
            value={libraryStatus}
            onChange={(event) => {
              setLibraryStatus(
                event.target.value as 'ALL' | MasterDataStatus,
              );
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
        <span className="catalog-count" aria-live="polite">
          {total === 0
            ? 'No matching records'
            : `Showing ${pageStart}–${pageEnd} of ${total}`}
        </span>
        {filtersActive ? (
          <button
            className="button button--quiet"
            type="button"
            onClick={() => {
              setLibrarySearch('');
              setLibraryStatus('ALL');
              setPageNumber(1);
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Vehicle Master editor"
            disabled={saving}
            onClick={editorKeyboard.requestClose}
          />
          <aside
            className="catalog-drawer vehicle-master-editor-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-master-editor-title"
          >
            <form
              className="catalog-drawer__form vehicle-master-form"
              ref={editorKeyboard.ref}
              onKeyDown={editorKeyboard.onKeyDown}
              onSubmit={save}
            >
              <div className="catalog-drawer__heading">
                <div>
                  <span className="eyebrow">
                    {editing ? 'Edit' : 'New'} vehicle master record
                  </span>
                  <h2 id="vehicle-master-editor-title">
                    {editing
                      ? labelForView(view, true)
                      : `Create ${labelForView(view, false)}`}
                  </h2>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={saving}
                  onClick={editorKeyboard.requestClose}
                >
                  Close
                </button>
              </div>

              <div className="catalog-drawer__fields vehicle-master-editor-drawer__fields">
                {formError ? (
                  <div className="alert alert--error" role="alert">
                    {formError}
                  </div>
                ) : null}

                <div className="category-form__grid">
                  <EditorFields
                    view={view}
                    form={form}
                    setField={setField}
                    editing={Boolean(editing)}
                    status={status}
                    makes={makes}
                    models={models}
                    derivatives={derivatives}
                    generations={generations}
                    trims={trims}
                    engines={engines}
                    transmissions={transmissions}
                    bodyTypes={bodyTypes}
                    markets={markets}
                  />
                  {view === 'configurations' && !editing ? (
                    <div className="vehicle-form__context">
                      <strong>Lifecycle: Draft</strong>
                      <span>
                        New configured vehicles are saved as Draft. Validate and
                        activate them from the library after review.
                      </span>
                    </div>
                  ) : (
                    <label className="field">
                      <span className="field__label">Status</span>
                      <select
                        className="category-form__select"
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as MasterDataStatus)
                        }
                      >
                        <option value="DRAFT">Draft</option>
                        {view !== 'configurations' || status === 'ACTIVE' ? (
                          <option
                            value="ACTIVE"
                            disabled={view === 'configurations'}
                          >
                            Active
                          </option>
                        ) : null}
                        <option value="INACTIVE">Inactive</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                      {view === 'configurations' ? (
                        <small className="field__hint">
                          Activation is a validated action from the Configured
                          Vehicles library, not a raw status edit.
                        </small>
                      ) : null}
                    </label>
                  )}
                </div>

                {!editing ? (
                  <LikelyDuplicateWarning
                    match={duplicate.match}
                    checking={duplicate.checking}
                  />
                ) : null}

                {editing ? (
                  <div className="vehicle-form__context">
                    Canonical codes and immutable hierarchy parents stay fixed
                    after creation. This update uses optimistic version{' '}
                    {editing.version}.
                  </div>
                ) : null}
              </div>

              <div className="catalog-drawer__actions vehicle-master-editor-drawer__actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {lifecycleNotice ? (
        <div className="alert alert--success" role="status">
          {lifecycleNotice}
        </div>
      ) : null}

      {lifecycleError ? (
        <div className="alert alert--error" role="alert">
          {lifecycleError}
        </div>
      ) : null}

      {loading ? (
        <AdminLoadingState message="Loading Vehicle Master configuration…" />
      ) : loadError ? (
        <div className="catalog-state vehicle-state--error" role="alert">
          <div><strong>Vehicle data unavailable</strong><p>{loadError}</p></div>
          <button className="button button--quiet" type="button" onClick={() => setReloadKey((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : records.length === 0 ? (
        <AdminEmptyState
          title={`No ${labelForView(view, true).toLowerCase()} yet`}
          description="Create the first canonical record for this Vehicle Master layer."
        />
      ) : view === 'configurations' ? (
        <ConfiguredVehicleMasterTable
          records={configurations}
          names={names}
          onEdit={(record) => void openEdit(record)}
          onValidate={(record) => void validateConfiguration(record)}
          onActivate={(record) =>
            void validateAndActivateConfiguration(record)
          }
          onSources={(record) => void openProvenance(record)}
          lifecycleWorkingId={lifecycleWorkingId}
          validatedVersions={validatedVersions}
          canManage={canManage}
          onLifecycleCompleted={() =>
            setReloadKey((value) => value + 1)
          }
        />
      ) : (
        <div className="vehicle-master-list" role="table" aria-label={`${labelForView(view, true)} library`}>
          <div
            className="vehicle-master-row vehicle-master-row--header"
            role="row"
          >
            <span role="columnheader">{labelForView(view, false)}</span>
            <span role="columnheader">Context</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Action</span>
          </div>
          {records.map((record) => (
            <VehicleMasterRow
              key={record.id}
              view={view}
              record={record}
              names={names}
              canManage={canManage}
              onEdit={() => void openEdit(record)}
              onLifecycleCompleted={() =>
                setReloadKey((value) => value + 1)
              }
            />
          ))}
        </div>
      )}

      {provenanceTarget ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close source provenance"
            disabled={provenanceSaving}
            onClick={provenanceDrawerRef.requestClose}
          />
          <aside
            ref={provenanceDrawerRef}
            className="catalog-drawer vehicle-provenance-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-provenance-title"
            tabIndex={-1}
          >
            <div className="catalog-drawer__heading">
              <div>
                <span className="eyebrow">Automotive source traceability</span>
                <h2 id="vehicle-provenance-title">{provenanceTarget.code}</h2>
                <p>Record where this configured vehicle identity was verified.</p>
              </div>
              <button
                className="button button--quiet"
                type="button"
                disabled={provenanceSaving}
                onClick={provenanceDrawerRef.requestClose}
              >
                Close
              </button>
            </div>

            <div className="vehicle-provenance-list">
              {provenanceLoading ? (
                <div className="catalog-state">
                  <span className="spinner spinner--dark" aria-hidden="true" />
                  <span>Loading sources…</span>
                </div>
              ) : provenanceRecords.length === 0 ? (
                <div className="catalog-empty">
                  <strong>No source records yet</strong>
                  <p>Add the first manufacturer, distributor, catalog, or technical reference.</p>
                </div>
              ) : (
                provenanceRecords.map((record) => (
                  <button
                    className={
                      editingProvenance?.id === record.id
                        ? 'vehicle-provenance-record is-selected'
                        : 'vehicle-provenance-record'
                    }
                    type="button"
                    key={record.id}
                    onClick={() => {
                      if (provenanceDrawerRef.confirmDiscard()) {
                        resetProvenanceForm(record);
                      }
                    }}
                  >
                    <span>
                      <strong>{record.sourceName}</strong>
                      <small>
                        {record.sourceReference || record.sourceUrl || 'No external reference'}
                      </small>
                    </span>
                    <span>
                      <b>{formatAdminEnumLabel(record.verificationState)}</b>
                      <small>
                        {record.observedAt
                          ? 'Observed ' + record.observedAt.slice(0, 10)
                          : 'Observation date not set'}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </div>

            <form className="catalog-drawer__form" onSubmit={saveProvenance}>
              <div className="catalog-drawer__fields">
                <div className="vehicle-provenance-form-heading">
                  <strong>
                    {editingProvenance ? 'Edit source record' : 'Add source record'}
                  </strong>
                  {editingProvenance ? (
                    <button
                      className="button button--quiet"
                      type="button"
                      disabled={provenanceSaving}
                      onClick={() => {
                        if (provenanceDrawerRef.confirmDiscard()) {
                          resetProvenanceForm();
                        }
                      }}
                    >
                      New source
                    </button>
                  ) : null}
                </div>

                {provenanceError ? (
                  <div className="alert alert--error" role="alert">
                    {provenanceError}
                  </div>
                ) : null}

                <label className="field">
                  <span className="field__label">Source name</span>
                  <input
                    data-admin-autofocus
                    required
                    maxLength={160}
                    value={provenanceForm.sourceName ?? ''}
                    placeholder="Toyota EPC, manufacturer bulletin, official distributor…"
                    onChange={(event) =>
                      setProvenanceForm((current) => ({
                        ...current,
                        sourceName: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="catalog-drawer__two">
                  <label className="field">
                    <span className="field__label">Source reference</span>
                    <input
                      maxLength={255}
                      value={provenanceForm.sourceReference ?? ''}
                      placeholder="Document / catalog / bulletin ID"
                      onChange={(event) =>
                        setProvenanceForm((current) => ({
                          ...current,
                          sourceReference: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Observed date</span>
                    <input
                      type="date"
                      value={provenanceForm.observedAt ?? ''}
                      onChange={(event) =>
                        setProvenanceForm((current) => ({
                          ...current,
                          observedAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Source URL</span>
                  <input
                    type="url"
                    maxLength={1000}
                    value={provenanceForm.sourceUrl ?? ''}
                    placeholder="https://…"
                    onChange={(event) =>
                      setProvenanceForm((current) => ({
                        ...current,
                        sourceUrl: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span className="field__label">Verification state</span>
                  <select
                    className="category-form__select"
                    value={provenanceForm.verificationState ?? 'UNVERIFIED'}
                    onChange={(event) =>
                      setProvenanceForm((current) => ({
                        ...current,
                        verificationState: event.target.value,
                      }))
                    }
                  >
                    {PROVENANCE_STATES.map((item) => (
                      <option value={item} key={item}>
                        {formatAdminEnumLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Verification notes</span>
                  <textarea
                    className="catalog-drawer__textarea"
                    maxLength={2000}
                    value={provenanceForm.notes ?? ''}
                    placeholder="What was checked, regional caveats, conflicting evidence…"
                    onChange={(event) =>
                      setProvenanceForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="catalog-drawer__actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={provenanceSaving}
                >
                  {provenanceSaving
                    ? 'Saving…'
                    : editingProvenance
                      ? 'Save source changes'
                      : 'Add source'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {!loading && !loadError && total > 0 ? (
        <div className="catalog-pagination">
          <button
            className="button button--quiet"
            type="button"
            disabled={pageNumber <= 1}
            onClick={() =>
              setPageNumber((value) => Math.max(1, value - 1))
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
            onClick={() => setPageNumber((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ConfiguredVehicleMasterTable({
  records,
  names,
  onEdit,
  onValidate,
  onActivate,
  onSources,
  lifecycleWorkingId,
  validatedVersions,
  canManage,
  onLifecycleCompleted,
}: {
  records: VehicleConfigurationRecord[];
  names: {
    makes: Map<string, string>;
    models: Map<string, string>;
    derivatives: Map<string, string>;
    generations: Map<string, string>;
    trims: Map<string, string>;
    engines: Map<string, string>;
    transmissions: Map<string, string>;
    bodyTypes: Map<string, string>;
    markets: Map<string, string>;
  };
  onEdit: (record: VehicleConfigurationRecord) => void;
  onValidate: (record: VehicleConfigurationRecord) => void;
  onActivate: (record: VehicleConfigurationRecord) => void;
  onSources: (record: VehicleConfigurationRecord) => void;
  lifecycleWorkingId: string | null;
  validatedVersions: Record<string, number>;
  canManage: boolean;
  onLifecycleCompleted: () => void;
}) {
  return (
    <div
      className="admin-library-table vehicle-configuration-table"
      role="table"
      aria-label="Advanced configured vehicle records"
    >
      <div
        className="admin-library-table__row admin-library-table__row--header vehicle-configuration-table__row"
        role="row"
      >
        <span role="columnheader">Vehicle</span>
        <span role="columnheader">Generation / Trim</span>
        <span role="columnheader">Powertrain</span>
        <span role="columnheader">Body / Market</span>
        <span role="columnheader">Year / Production</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Actions</span>
      </div>

      {records.map((configuration) => {
        const working = lifecycleWorkingId === configuration.id;
        const validated =
          validatedVersions[configuration.id] === configuration.version;

        return (
          <div
            className="admin-library-table__row vehicle-configuration-table__row"
            role="row"
            key={configuration.id}
          >
            <span className="admin-library-table__primary" role="cell">
              <strong>
                {names.makes.get(configuration.makeId) ?? 'Unknown make'}{' '}
                {names.models.get(configuration.modelId) ?? 'Unknown model'}
              </strong>
              <small>{configuration.identityCode}</small>
            </span>

            <span className="vehicle-configuration-table__stack" role="cell">
              <strong>
                {configuration.generationId
                  ? names.generations.get(configuration.generationId) ??
                    'Unknown generation'
                  : 'Generation not specified'}
              </strong>
              <small>
                {configuration.trimId
                  ? names.trims.get(configuration.trimId) ?? 'Unknown trim'
                  : 'Trim not specified'}
              </small>
            </span>

            <span className="vehicle-configuration-table__stack" role="cell">
              <strong>
                {configuration.engineId
                  ? names.engines.get(configuration.engineId) ?? 'Unknown engine'
                  : 'Engine not specified'}
              </strong>
              <small>
                {configuration.transmissionId
                  ? names.transmissions.get(configuration.transmissionId) ??
                    'Unknown transmission'
                  : 'Transmission not specified'}
              </small>
            </span>

            <span className="vehicle-configuration-table__stack" role="cell">
              <strong>
                {configuration.bodyTypeId
                  ? names.bodyTypes.get(configuration.bodyTypeId) ??
                    'Unknown body type'
                  : 'Body not specified'}
              </strong>
              <small>
                {configuration.marketId
                  ? names.markets.get(configuration.marketId) ?? 'Unknown market'
                  : 'Market not specified'}
                {configuration.steeringSide
                  ? ` · ${configuration.steeringSide}`
                  : ''}
              </small>
            </span>

            <span className="vehicle-configuration-table__stack" role="cell">
              <strong>
                {configuration.modelYear
                  ? `MY ${configuration.modelYear}`
                  : 'Model year not set'}
              </strong>
              <small>{configurationProductionLabel(configuration)}</small>
            </span>

            <span role="cell">
              <AdminStatusBadge status={configuration.status} />
            </span>

            <span className="vehicle-configuration-table__actions" role="cell">
              {configuration.status !== 'ACTIVE' ? (
                <>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={working}
                    onClick={() => onValidate(configuration)}
                  >
                    {working ? 'Checking…' : validated ? 'Validated' : 'Validate'}
                  </button>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={working}
                    onClick={() => onActivate(configuration)}
                  >
                    {working ? 'Working…' : 'Activate'}
                  </button>
                </>
              ) : null}
              <button
                className="button button--quiet"
                type="button"
                disabled={working}
                onClick={() => onSources(configuration)}
              >
                Sources
              </button>
              <button
                className="button button--quiet"
                type="button"
                disabled={working}
                onClick={() => onEdit(configuration)}
              >
                Edit
              </button>
              <AdminMasterLifecycleActions
                domain="VEHICLE"
                entityType="VEHICLE_CONFIGURATION"
                entityId={configuration.id}
                entityName={configuration.identityCode}
                status={configuration.status}
                version={configuration.version}
                disabled={!canManage || working}
                onCompleted={onLifecycleCompleted}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function configurationProductionLabel(
  item: VehicleConfigurationRecord,
): string {
  const start = item.productionStartYear
    ? `${item.productionStartMonth ? String(item.productionStartMonth).padStart(2, '0') + '/' : ''}${item.productionStartYear}`
    : 'start not set';
  const end =
    item.productionEndStatus === 'CURRENT'
      ? 'present'
      : item.productionEndYear
        ? `${item.productionEndMonth ? String(item.productionEndMonth).padStart(2, '0') + '/' : ''}${item.productionEndYear}`
        : 'end not set';

  return `${start}–${end}`;
}

function EditorFields(props: {
  view: View;
  form: Record<string, string>;
  setField: (name: string, value: string) => void;
  editing: boolean;
  status: MasterDataStatus;
  makes: VehicleMakeRecord[];
  models: VehicleModelRecord[];
  derivatives: VehicleModelDerivativeRecord[];
  generations: VehicleGenerationRecord[];
  trims: VehicleTrimRecord[];
  engines: VehicleEngineRecord[];
  transmissions: VehicleTransmissionRecord[];
  bodyTypes: VehicleNamedMasterRecord[];
  markets: VehicleNamedMasterRecord[];
}) {
  const { view, form, setField, editing, status } = props;
  const text = (name: string, label: string, required = false, disabled = false) => (
    <label className="field" key={name}>
      <span className="field__label">{label}</span>
      <input
        value={form[name] ?? ''}
        required={required}
        disabled={disabled}
        onChange={(event) => setField(name, event.target.value)}
      />
    </label>
  );
  const number = (name: string, label: string, required = false) => (
    <label className="field" key={name}>
      <span className="field__label">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        type="number"
        value={form[name] ?? ''}
        min={name.toLowerCase().includes('year') ? 1886 : undefined}
        max={name.toLowerCase().includes('year') ? 2200 : undefined}
        required={required}
        onChange={(event) => setField(name, event.target.value)}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: Array<{ id: string; name: string }>,
    required = false,
    disabled = false,
  ) => (
    <div className="field" key={name}>
      <span className="field__label">
        {label}
        {required ? ' *' : ''}
      </span>
      <AdminSearchableCombobox
        id={`vehicle-master-${view}-${name}`}
        value={form[name] ?? ''}
        options={[
          ...(!required ? [{ id: '', label: 'Not specified' }] : []),
          ...options.map((item) => ({
            id: item.id,
            label: item.name,
          })),
        ]}
        placeholder={required ? `Choose ${label}` : 'Not specified'}
        searchPlaceholder={`Search ${label}…`}
        disabled={disabled}
        onChange={(value) => setField(name, value)}
      />
    </div>
  );

  if (view === 'derivatives') {
    return <>
      {select('modelId', 'Model', props.models, true, editing)}
      {text('code', 'Derivative code', true, editing)}
      {text('name', 'Derivative / Body Line name', true)}
    </>;
  }
  if (view === 'generations') {
    const selectedModel = form.modelId ?? '';
    const derivativeOptions = props.derivatives.filter(
      (item) => !selectedModel || item.modelId === selectedModel,
    );
    return <>
      {select('modelId', 'Model', props.models, true, editing)}
      {select('derivativeId', 'Derivative / Body Line', derivativeOptions, false)}
      {text('code', 'Generation code', false, editing)}
      {text('name', 'Generation name', true)}
      {number('startYear', 'Start year')}
      {number('endYear', 'End year')}
    </>;
  }
  if (view === 'trims') {
    return <>
      {select('generationId', 'Generation', props.generations, true, editing)}
      {text('code', 'Trim code', false, editing)}
      {text('name', 'Trim name', true)}
      {text('equipmentLevel', 'Equipment level')}
      {number('startYear', 'Start year')}
      {number('endYear', 'End year')}
    </>;
  }
  if (view === 'engines') {
    return <>
      {text('code', 'Engine code', false, editing)}
      {text('name', 'Engine name', true)}
      {text('family', 'Engine family')}
      {number('displacementCc', 'Displacement (cc)')}
      {text('fuelType', 'Fuel type')}
      {number('cylinderCount', 'Cylinder count')}
      {text('aspiration', 'Aspiration')}
      {number('powerKw', 'Power (kW)')}
      {number('torqueNm', 'Torque (Nm)')}
      {number('startYear', 'Start year')}
      {number('endYear', 'End year')}
    </>;
  }
  if (view === 'transmissions') {
    return <>
      {text('code', 'Transmission code', false, editing)}
      {text('transmissionType', 'Transmission type', true)}
      {number('gearCount', 'Gear count')}
      {text('driveType', 'Drive type')}
      {number('startYear', 'Start year')}
      {number('endYear', 'End year')}
    </>;
  }
  if (view === 'body-types' || view === 'markets') {
    return <>
      {text('code', 'Code', true, editing)}
      {text('name', 'Name', true)}
    </>;
  }

  const selectedMake = form.makeId ?? '';
  const modelOptions = props.models.filter((item) => !selectedMake || item.makeId === selectedMake);
  const selectedModel = form.modelId ?? '';
  const generationOptions = props.generations.filter((item) => !selectedModel || item.modelId === selectedModel);
  const selectedGeneration = form.generationId ?? '';
  const trimOptions = props.trims.filter((item) => !selectedGeneration || item.generationId === selectedGeneration);

  const activeConfiguration = status === 'ACTIVE';

  return <>
    {editing ? (
      <div className="field">
        <span className="field__label">Internal vehicle ID</span>
        <strong>{form.identityCode ?? 'Unavailable'}</strong>
      </div>
    ) : (
      <div className="field">
        <span className="field__label">Internal vehicle ID</span>
        <span>Generated automatically when saved</span>
      </div>
    )}
    {select('makeId', 'Make', props.makes, true, editing)}
    {select('modelId', 'Model', modelOptions, true, editing)}
    {select('generationId', 'Generation', generationOptions, true)}
    {select('trimId', 'Trim / Variant', trimOptions, true)}
    {select('engineId', 'Engine', props.engines, true)}
    {select(
      'transmissionId',
      'Transmission',
      props.transmissions.map((item) => ({
        id: item.id,
        name: item.code ? `${item.code} · ${item.transmissionType}` : item.transmissionType,
      })),
      true,
    )}
    {select('bodyTypeId', 'Body type', props.bodyTypes, activeConfiguration)}
    {select('marketId', 'Market', props.markets, activeConfiguration)}
    {number('modelYear', 'Model year')}
    {number('productionStartYear', 'Production start', activeConfiguration)}
    {number('productionEndYear', 'Production end')}
    <label className="field">
      <span className="field__label">
        Steering side
        {activeConfiguration ? ' *' : ''}
      </span>
      <select
        className="category-form__select"
        value={form.steeringSide ?? ''}
        required={activeConfiguration}
        onChange={(event) => setField('steeringSide', event.target.value)}
      >
        {!activeConfiguration ? <option value="">Not specified</option> : null}
        <option value="LHD">Left-hand drive</option>
        <option value="RHD">Right-hand drive</option>
      </select>
    </label>
  </>;
}

function VehicleMasterRow({
  view,
  record,
  names,
  canManage,
  onEdit,
  onLifecycleCompleted,
}: {
  view: Exclude<View, 'configurations'>;
  record: EditableRecord;
  names: {
    makes: Map<string, string>;
    models: Map<string, string>;
    derivatives: Map<string, string>;
    generations: Map<string, string>;
    trims: Map<string, string>;
    engines: Map<string, string>;
    transmissions: Map<string, string>;
    bodyTypes: Map<string, string>;
    markets: Map<string, string>;
  };
  canManage: boolean;
  onEdit: () => void;
  onLifecycleCompleted: () => void;
}) {
  const identity = identityForRecord(view, record);
  const context = contextForRecord(view, record, names);
  return (
    <div className="vehicle-master-row" role="row">
      <div className="vehicle-row__identity" role="cell">
        <strong>{identity.title}</strong>
        <span>{identity.code}</span>
      </div>
      <div className="vehicle-master-row__context" role="cell">
        <small>{context.label}</small>
        <span>{context.value}</span>
      </div>
      <AdminStatusBadge status={record.status} role="cell" />
      <span className="vehicle-row__version" role="cell">v{record.version}</span>
      <span role="cell">
        <button className="button button--quiet" type="button" onClick={onEdit}>Edit</button>
        <AdminMasterLifecycleActions
          domain="VEHICLE"
          entityType={lifecycleEntityTypeForView(view)}
          entityId={record.id}
          entityName={identity.title}
          status={record.status}
          version={record.version}
          reactivatePath={`/api/admin/vehicles/master/${view}/${record.id}`}
          disabled={!canManage}
          onCompleted={onLifecycleCompleted}
        />
      </span>
    </div>
  );
}

function lifecycleEntityTypeForView(
  view: Exclude<View, 'configurations'>,
): MasterDataLifecycleEntityType {
  switch (view) {
    case 'derivatives':
      return 'VEHICLE_MODEL_DERIVATIVE';
    case 'generations':
      return 'VEHICLE_GENERATION';
    case 'trims':
      return 'VEHICLE_TRIM';
    case 'engines':
      return 'VEHICLE_ENGINE';
    case 'transmissions':
      return 'VEHICLE_TRANSMISSION';
    case 'body-types':
      return 'VEHICLE_BODY_TYPE';
    case 'markets':
      return 'VEHICLE_MARKET';
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      body?.error?.message ?? `Vehicle request failed: ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function searchPlaceholderForView(view: View): string {
  if (view === 'derivatives') return 'Search body line name or code';
  if (view === 'generations') return 'Search generation name or code';
  if (view === 'trims') return 'Search trim, code or equipment level';
  if (view === 'engines') return 'Search engine, family, fuel or code';
  if (view === 'transmissions') return 'Search transmission type, code or drive';
  if (view === 'body-types') return 'Search body type name or code';
  if (view === 'markets') return 'Search market or region';
  return 'Search configured vehicle identity';
}

function configurationLibraryPresentation(
  items: VehicleConfigurationLibraryItem[],
) {
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

function recordsForView(
  view: View,
  data: {
    derivatives: VehicleModelDerivativeRecord[];
    generations: VehicleGenerationRecord[];
    trims: VehicleTrimRecord[];
    engines: VehicleEngineRecord[];
    transmissions: VehicleTransmissionRecord[];
    bodyTypes: VehicleNamedMasterRecord[];
    markets: VehicleNamedMasterRecord[];
    configurations: VehicleConfigurationRecord[];
  },
): EditableRecord[] {
  if (view === 'derivatives') return data.derivatives;
  if (view === 'generations') return data.generations;
  if (view === 'trims') return data.trims;
  if (view === 'engines') return data.engines;
  if (view === 'transmissions') return data.transmissions;
  if (view === 'body-types') return data.bodyTypes;
  if (view === 'markets') return data.markets;
  return data.configurations;
}

function identityForRecord(view: View, record: EditableRecord) {
  if (view === 'transmissions') {
    const item = record as VehicleTransmissionRecord;
    return { title: item.transmissionType, code: item.code ?? 'No code' };
  }
  if (view === 'configurations') {
    const item = record as VehicleConfigurationRecord;
    return {
      title: item.identityCode,
      code: item.modelYear ? `Model year ${item.modelYear}` : 'Partial configuration',
    };
  }
  const item = record as VehicleModelDerivativeRecord | VehicleGenerationRecord | VehicleTrimRecord | VehicleEngineRecord | VehicleNamedMasterRecord;
  return { title: item.name, code: item.code ?? 'No code' };
}

function contextForRecord(
  view: View,
  record: EditableRecord,
  names: {
    makes: Map<string, string>;
    models: Map<string, string>;
    derivatives: Map<string, string>;
    generations: Map<string, string>;
    trims: Map<string, string>;
    engines: Map<string, string>;
    transmissions: Map<string, string>;
    bodyTypes: Map<string, string>;
    markets: Map<string, string>;
  },
) {
  if (view === 'derivatives') {
    const item = record as VehicleModelDerivativeRecord;
    return { label: 'Model', value: names.models.get(item.modelId) ?? 'Unknown model' };
  }
  if (view === 'generations') {
    const item = record as VehicleGenerationRecord;
    const modelName = names.models.get(item.modelId) ?? 'Unknown model';
    const derivativeName = item.derivativeId
      ? names.derivatives.get(item.derivativeId) ?? 'Unknown derivative'
      : 'Unassigned derivative';
    return { label: 'Model → Derivative', value: `${modelName} → ${derivativeName}` };
  }
  if (view === 'trims') {
    const item = record as VehicleTrimRecord;
    return { label: 'Generation', value: names.generations.get(item.generationId) ?? 'Unknown generation' };
  }
  if (view === 'engines') {
    const item = record as VehicleEngineRecord;
    return { label: 'Engine', value: [item.displacementCc ? `${item.displacementCc} cc` : null, item.fuelType].filter(Boolean).join(' · ') || 'Technical master' };
  }
  if (view === 'transmissions') {
    const item = record as VehicleTransmissionRecord;
    return { label: 'Transmission', value: [item.gearCount ? `${item.gearCount} gears` : null, item.driveType].filter(Boolean).join(' · ') || 'Technical master' };
  }
  if (view === 'body-types') return { label: 'Reference master', value: 'Vehicle body type' };
  if (view === 'markets') return { label: 'Reference master', value: 'Vehicle market / region' };
  const item = record as VehicleConfigurationRecord;
  const parts = [
    item.engineId ? `Engine: ${names.engines.get(item.engineId) ?? 'Unknown'}` : null,
    item.transmissionId
      ? `Transmission: ${names.transmissions.get(item.transmissionId) ?? 'Unknown'}`
      : null,
    item.bodyTypeId ? `Body: ${names.bodyTypes.get(item.bodyTypeId) ?? 'Unknown'}` : null,
    item.marketId ? `Market: ${names.markets.get(item.marketId) ?? 'Unknown'}` : null,
    item.steeringSide ? `Steering: ${item.steeringSide}` : null,
  ].filter(Boolean);
  return {
    label: 'Technical configuration',
    value: parts.join(' · ') || 'Technical details not specified',
  };
}

function labelForView(view: View, plural: boolean): string {
  const labels: Record<View, [string, string]> = {
    derivatives: ['derivative / body line', 'Derivatives / Body Lines'],
    generations: ['generation', 'Generations'],
    trims: ['trim', 'Trims'],
    engines: ['engine', 'Engines'],
    transmissions: ['transmission', 'Transmissions'],
    'body-types': ['body type', 'Body Types'],
    markets: ['market', 'Markets'],
    configurations: ['configuration record', 'Configuration records — Advanced'],
  };
  return plural ? labels[view][1] : labels[view][0];
}

function recordToForm(view: View, record: EditableRecord): Record<string, string> {
  if (view === 'derivatives') {
    const item = record as VehicleModelDerivativeRecord;
    return stringFields(item, ['modelId', 'code', 'name']);
  }
  if (view === 'generations') {
    const item = record as VehicleGenerationRecord;
    return stringFields(item, ['modelId', 'derivativeId', 'code', 'name', 'startYear', 'endYear']);
  }
  if (view === 'trims') {
    const item = record as VehicleTrimRecord;
    return stringFields(item, ['generationId', 'code', 'name', 'equipmentLevel', 'startYear', 'endYear']);
  }
  if (view === 'engines') {
    const item = record as VehicleEngineRecord;
    return stringFields(item, ['code', 'name', 'family', 'displacementCc', 'fuelType', 'cylinderCount', 'aspiration', 'powerKw', 'torqueNm', 'startYear', 'endYear']);
  }
  if (view === 'transmissions') {
    const item = record as VehicleTransmissionRecord;
    return stringFields(item, ['code', 'transmissionType', 'gearCount', 'driveType', 'startYear', 'endYear']);
  }
  if (view === 'body-types' || view === 'markets') {
    const item = record as VehicleNamedMasterRecord;
    return { code: item.code, name: item.name };
  }
  const item = record as VehicleConfigurationRecord;
  return stringFields(item, ['identityCode', 'code', 'makeId', 'modelId', 'generationId', 'trimId', 'engineId', 'transmissionId', 'bodyTypeId', 'marketId', 'modelYear', 'productionStartYear', 'productionEndYear', 'steeringSide']);
}

function stringFields(record: object, keys: string[]): Record<string, string> {
  const source = record as Record<string, unknown>;
  return Object.fromEntries(
    keys.map((key) => [key, source[key] === null || source[key] === undefined ? '' : String(source[key])]),
  );
}

function requiredVehicleReferenceError(
  view: View,
  form: Record<string, string>,
  editing: EditableRecord | null,
  status: MasterDataStatus,
): string {
  const requiredByView: Partial<Record<View, Array<[string, string]>>> = {
    derivatives: [['modelId', 'Model']],
    generations: [['modelId', 'Model']],
    trims: [['generationId', 'Generation']],
    configurations: [
      ['makeId', 'Make'],
      ['modelId', 'Model'],
      ['generationId', 'Generation'],
      ['trimId', 'Trim / Variant'],
      ['engineId', 'Engine'],
      ['transmissionId', 'Transmission'],
    ],
  };

  const baseRequired =
    editing && view !== 'configurations' ? [] : requiredByView[view] ?? [];
  const activeConfigurationRequired: Array<[string, string]> =
    view === 'configurations' && status === 'ACTIVE'
      ? [
          ['bodyTypeId', 'Body type'],
          ['marketId', 'Market'],
          ['productionStartYear', 'Production start year'],
          ['steeringSide', 'Steering side'],
        ]
      : [];
  const missing = [...baseRequired, ...activeConfigurationRequired].find(
    ([field]) => !form[field]?.trim(),
  );
  return missing ? `Choose ${missing[1]} before saving.` : '';
}

function buildPayload(
  view: View,
  form: Record<string, string>,
  status: MasterDataStatus,
  editing: EditableRecord | null,
): object {
  const version = editing?.version;
  const optionalNumber = (name: string) =>
    form[name]?.trim() ? Number(form[name]) : undefined;
  const nullableNumber = (name: string) =>
    form[name]?.trim() ? Number(form[name]) : null;
  const optionalText = (name: string) => form[name]?.trim() || undefined;
  const nullableText = (name: string) => form[name]?.trim() || null;

  if (view === 'derivatives') {
    return editing
      ? ({
          version: version!,
          name: form.name.trim(),
          status,
        } satisfies UpdateVehicleModelDerivativeInput)
      : ({
          modelId: form.modelId,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          status,
        } satisfies CreateVehicleModelDerivativeInput);
  }
  if (view === 'generations') {
    return editing
      ? ({
          version: version!,
          derivativeId: nullableText('derivativeId'),
          name: form.name.trim(),
          startYear: nullableNumber('startYear'),
          endYear: nullableNumber('endYear'),
          status,
        } satisfies UpdateVehicleGenerationInput)
      : ({
          modelId: form.modelId,
          derivativeId: optionalText('derivativeId'),
          code: optionalText('code'),
          name: form.name.trim(),
          startYear: optionalNumber('startYear'),
          endYear: optionalNumber('endYear'),
          status,
        } satisfies CreateVehicleGenerationInput);
  }
  if (view === 'trims') {
    return editing
      ? ({
          version: version!,
          name: form.name.trim(),
          equipmentLevel: nullableText('equipmentLevel'),
          startYear: nullableNumber('startYear'),
          endYear: nullableNumber('endYear'),
          status,
        } satisfies UpdateVehicleTrimInput)
      : ({
          generationId: form.generationId,
          code: optionalText('code'),
          name: form.name.trim(),
          equipmentLevel: optionalText('equipmentLevel'),
          startYear: optionalNumber('startYear'),
          endYear: optionalNumber('endYear'),
          status,
        } satisfies CreateVehicleTrimInput);
  }
  if (view === 'engines') {
    return editing
      ? ({
          version: version!,
          name: form.name.trim(),
          family: nullableText('family'),
          displacementCc: nullableNumber('displacementCc'),
          fuelType: nullableText('fuelType'),
          cylinderCount: nullableNumber('cylinderCount'),
          aspiration: nullableText('aspiration'),
          powerKw: nullableNumber('powerKw'),
          torqueNm: nullableNumber('torqueNm'),
          startYear: nullableNumber('startYear'),
          endYear: nullableNumber('endYear'),
          status,
        } satisfies UpdateVehicleEngineInput)
      : ({
          code: optionalText('code'),
          name: form.name.trim(),
          family: optionalText('family'),
          displacementCc: optionalNumber('displacementCc'),
          fuelType: optionalText('fuelType'),
          cylinderCount: optionalNumber('cylinderCount'),
          aspiration: optionalText('aspiration'),
          powerKw: optionalNumber('powerKw'),
          torqueNm: optionalNumber('torqueNm'),
          startYear: optionalNumber('startYear'),
          endYear: optionalNumber('endYear'),
          status,
        } satisfies CreateVehicleEngineInput);
  }
  if (view === 'transmissions') {
    return editing
      ? ({
          version: version!,
          transmissionType: form.transmissionType.trim(),
          gearCount: nullableNumber('gearCount'),
          driveType: nullableText('driveType'),
          startYear: nullableNumber('startYear'),
          endYear: nullableNumber('endYear'),
          status,
        } satisfies UpdateVehicleTransmissionInput)
      : ({
          code: optionalText('code'),
          transmissionType: form.transmissionType.trim(),
          gearCount: optionalNumber('gearCount'),
          driveType: optionalText('driveType'),
          startYear: optionalNumber('startYear'),
          endYear: optionalNumber('endYear'),
          status,
        } satisfies CreateVehicleTransmissionInput);
  }
  if (view === 'body-types' || view === 'markets') {
    return editing
      ? ({
          version: version!,
          name: form.name.trim(),
          status,
        } satisfies UpdateVehicleNamedMasterInput)
      : ({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          status,
        } satisfies CreateVehicleNamedMasterInput);
  }
  return editing
    ? ({
        version: version!,
        generationId: optionalText('generationId'),
        trimId: optionalText('trimId'),
        engineId: optionalText('engineId'),
        transmissionId: optionalText('transmissionId'),
        bodyTypeId: nullableText('bodyTypeId'),
        marketId: nullableText('marketId'),
        modelYear: nullableNumber('modelYear'),
        productionStartYear: nullableNumber('productionStartYear'),
        productionEndYear: nullableNumber('productionEndYear'),
        steeringSide: (nullableText('steeringSide') as VehicleSteeringSide | null),
        status,
      } satisfies UpdateVehicleConfigurationInput)
    : ({
        makeId: form.makeId,
        modelId: form.modelId,
        generationId: form.generationId,
        trimId: form.trimId,
        engineId: form.engineId,
        transmissionId: form.transmissionId,
        bodyTypeId: optionalText('bodyTypeId'),
        marketId: optionalText('marketId'),
        modelYear: optionalNumber('modelYear'),
        productionStartYear: optionalNumber('productionStartYear'),
        productionEndYear: optionalNumber('productionEndYear'),
        steeringSide: optionalText('steeringSide') as VehicleSteeringSide | undefined,
        status,
      } satisfies CreateVehicleConfigurationInput);
}
