'use client';

import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import {
  configuredVehicleHierarchy as buildConfiguredVehicleLibrary,
  configurationApplicabilityLabel,
  configurationYearBounds,
  createVehicleConfigurationCode,
  engineTechnicalLabel,
  generationsForModel,
  technicalMastersForSelection,
  transmissionTechnicalLabel,
  trimsForGeneration,
} from '@/lib/vehicle-builder';
import { createVehicleCode, hasVehicleManagePermission } from '@/lib/vehicle-management';
import type {
  CreateVehicleConfigurationInput,
  CreateVehicleEngineInput,
  CreateVehicleGenerationInput,
  CreateVehicleMakeInput,
  CreateVehicleModelInput,
  CreateVehicleModelDerivativeInput,
  CreateVehicleNamedMasterInput,
  CreateVehicleTransmissionInput,
  CreateVehicleTrimInput,
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
  VehicleProductionEndStatus,
  VehicleSteeringSide,
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
import { useAdminPrincipal } from './admin-session';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import { VehicleAdminNav } from './vehicle-admin-nav';

type TechnicalMasterEditor =
  | 'engine'
  | 'transmission'
  | 'body-type'
  | 'market'
  | null;

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

export function VehicleBuilder({
  initialModelId = '',
  initialGenerationId = '',
  initialTrimId = '',
  initialLibrarySearch = '',
  initialLibraryConfigurationId = '',
}: {
  initialModelId?: string;
  initialGenerationId?: string;
  initialTrimId?: string;
  initialLibrarySearch?: string;
  initialLibraryConfigurationId?: string;
}) {
  const principal = useAdminPrincipal();
  const canManage = hasVehicleManagePermission(principal.permissions);
  const [data, setData] = useState<DataState>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState(initialModelId);
  const [derivativeId, setDerivativeId] = useState('');
  const [generationId, setGenerationId] = useState(initialGenerationId);
  const [trimId, setTrimId] = useState(initialTrimId);

  const [makeFormOpen, setMakeFormOpen] = useState(false);
  const [makeName, setMakeName] = useState('');
  const [makeCode, setMakeCode] = useState('');
  const [makeStatus, setMakeStatus] = useState<MasterDataStatus>('DRAFT');

  const [modelFormOpen, setModelFormOpen] = useState(false);
  const [modelName, setModelName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [modelStatus, setModelStatus] = useState<MasterDataStatus>('DRAFT');

  const [derivativeFormOpen, setDerivativeFormOpen] = useState(false);
  const [derivativeName, setDerivativeName] = useState('');
  const [derivativeCode, setDerivativeCode] = useState('');
  const [derivativeStatus, setDerivativeStatus] =
    useState<MasterDataStatus>('DRAFT');

  const [generationFormOpen, setGenerationFormOpen] = useState(false);
  const [generationName, setGenerationName] = useState('');
  const [generationCode, setGenerationCode] = useState('');
  const [generationStartYear, setGenerationStartYear] = useState('');
  const [generationEndYear, setGenerationEndYear] = useState('');
  const [generationEndStatus, setGenerationEndStatus] =
    useState<VehicleProductionEndStatus>('UNKNOWN');
  const [generationStatus, setGenerationStatus] = useState<MasterDataStatus>('DRAFT');

  const [trimFormOpen, setTrimFormOpen] = useState(false);
  const [trimName, setTrimName] = useState('');
  const [trimCode, setTrimCode] = useState('');
  const [trimEquipmentLevel, setTrimEquipmentLevel] = useState('');
  const [trimStartYear, setTrimStartYear] = useState('');
  const [trimEndYear, setTrimEndYear] = useState('');
  const [trimStatus, setTrimStatus] = useState<MasterDataStatus>('DRAFT');

  const [technicalEditor, setTechnicalEditor] =
    useState<TechnicalMasterEditor>(null);
  const [technicalForm, setTechnicalForm] = useState<Record<string, string>>({});
  const [technicalStatus, setTechnicalStatus] =
    useState<MasterDataStatus>('DRAFT');

  const [engineId, setEngineId] = useState('');
  const [transmissionId, setTransmissionId] = useState('');
  const [engineSearch, setEngineSearch] = useState('');
  const [transmissionSearch, setTransmissionSearch] = useState('');
  const [technicalMasterLoading, setTechnicalMasterLoading] = useState(false);
  const [technicalMasterError, setTechnicalMasterError] = useState('');
  const [bodyTypeId, setBodyTypeId] = useState('');
  const [marketId, setMarketId] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [productionStartYear, setProductionStartYear] = useState('');
  const [productionStartMonth, setProductionStartMonth] = useState('');
  const [productionEndYear, setProductionEndYear] = useState('');
  const [productionEndMonth, setProductionEndMonth] = useState('');
  const [productionEndStatus, setProductionEndStatus] =
    useState<VehicleProductionEndStatus>('UNKNOWN');
  const [steeringSide, setSteeringSide] = useState<VehicleSteeringSide | ''>('');
  const [configurationStatus, setConfigurationStatus] =
    useState<MasterDataStatus>('DRAFT');

  const [saving, setSaving] = useState<
    | 'make'
    | 'model'
    | 'derivative'
    | 'generation'
    | 'trim'
    | 'technical'
    | 'configuration'
    | null
  >(null);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const [librarySearch, setLibrarySearch] = useState(initialLibrarySearch);
  const [libraryConfigurationId, setLibraryConfigurationId] = useState(
    initialLibraryConfigurationId,
  );
  const [libraryMakeFilter, setLibraryMakeFilter] = useState('');
  const [libraryModelFilter, setLibraryModelFilter] = useState('');
  const [libraryStatusFilter, setLibraryStatusFilter] =
    useState<'ALL' | MasterDataStatus>('ALL');
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
  const [libraryPage, setLibraryPage] = useState<VehicleConfigurationLibraryPage>({
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
  const [libraryLifecycleWorkingId, setLibraryLifecycleWorkingId] =
    useState<string | null>(null);
  const [libraryValidatedVersions, setLibraryValidatedVersions] = useState<
    Record<string, number>
  >({});
  const [libraryValidationResults, setLibraryValidationResults] = useState<
    Record<string, { version: number; valid: boolean; message: string }>
  >({});
  const [libraryLifecycleNotice, setLibraryLifecycleNotice] = useState('');
  const [libraryLifecycleError, setLibraryLifecycleError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const makeFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: makeFormOpen,
    saving: saving === 'make',
    focusKey: 'make',
    onEscape: () => setMakeFormOpen(false),
  });
  const modelFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: modelFormOpen,
    saving: saving === 'model',
    focusKey: `model:${makeId}`,
    onEscape: () => setModelFormOpen(false),
  });
  const derivativeFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: derivativeFormOpen,
    saving: saving === 'derivative',
    focusKey: `derivative:${modelId}`,
    onEscape: () => setDerivativeFormOpen(false),
  });
  const generationFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: generationFormOpen,
    saving: saving === 'generation',
    focusKey: `generation:${modelId}:${derivativeId}`,
    onEscape: () => setGenerationFormOpen(false),
  });
  const trimFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: trimFormOpen,
    saving: saving === 'trim',
    focusKey: `trim:${generationId}`,
    onEscape: () => setTrimFormOpen(false),
  });

  const makeDuplicate = useLikelyDuplicate({
    enabled: makeFormOpen,
    name: makeName,
    code: makeCode,
    searchUrl: '/api/admin/vehicles/makes/page',
  });

  const modelDuplicate = useLikelyDuplicate({
    enabled: modelFormOpen && Boolean(makeId),
    name: modelName,
    code: modelCode,
    searchUrl: makeId
      ? `/api/admin/vehicles/models/page?makeId=${makeId}`
      : '',
  });

  const derivativeDuplicate = useLikelyDuplicate({
    enabled: derivativeFormOpen && Boolean(modelId),
    name: derivativeName,
    code: derivativeCode,
    searchUrl: modelId
      ? `/api/admin/vehicles/master/derivatives/page?modelId=${modelId}`
      : '',
  });

  const generationDuplicate = useLikelyDuplicate({
    enabled: generationFormOpen && Boolean(modelId),
    name: generationName,
    code: generationCode,
    searchUrl: modelId
      ? `/api/admin/vehicles/master/generations/page?modelId=${modelId}${
          derivativeId ? `&derivativeId=${derivativeId}` : ''
        }`
      : '',
  });

  const trimDuplicate = useLikelyDuplicate({
    enabled: trimFormOpen && Boolean(generationId),
    name: trimName,
    code: trimCode,
    searchUrl: generationId
      ? `/api/admin/vehicles/master/trims/page?generationId=${generationId}`
      : '',
  });

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setLoadError('');

      try {
        const [makes, bodyTypes, markets] = await Promise.all([
          fetchVehicleList<VehicleMakeRecord>('/api/admin/vehicles/makes'),
          fetchVehicleList<VehicleNamedMasterRecord>(
            '/api/admin/vehicles/master/body-types',
          ),
          fetchVehicleList<VehicleNamedMasterRecord>(
            '/api/admin/vehicles/master/markets',
          ),
        ]);

        let preferredTrim: VehicleTrimRecord | null = null;
        let preferredGeneration: VehicleGenerationRecord | null = null;
        let preferredModel: VehicleModelRecord | null = null;
        let preferredDerivative: VehicleModelDerivativeRecord | null = null;

        if (initialTrimId) {
          preferredTrim = await fetchVehicleRecord<VehicleTrimRecord>(
            `/api/admin/vehicles/master/trims/${initialTrimId}`,
          );
        }

        const preferredGenerationId =
          preferredTrim?.generationId || initialGenerationId;
        if (preferredGenerationId) {
          preferredGeneration =
            await fetchVehicleRecord<VehicleGenerationRecord>(
              `/api/admin/vehicles/master/generations/${preferredGenerationId}`,
            );
        }

        const preferredModelId =
          preferredGeneration?.modelId || initialModelId;
        if (preferredModelId) {
          preferredModel = await fetchVehicleRecord<VehicleModelRecord>(
            `/api/admin/vehicles/models/${preferredModelId}`,
          );
        }

        if (preferredGeneration?.derivativeId) {
          preferredDerivative =
            await fetchVehicleRecord<VehicleModelDerivativeRecord>(
              `/api/admin/vehicles/master/derivatives/${preferredGeneration.derivativeId}`,
            );
        }

        let models: VehicleModelRecord[] = [];
        let derivatives: VehicleModelDerivativeRecord[] = [];
        let generations: VehicleGenerationRecord[] = [];
        let trims: VehicleTrimRecord[] = [];
        let configurations: VehicleConfigurationRecord[] = [];

        if (preferredModel) {
          [models, derivatives, generations, trims, configurations] =
            await Promise.all([
              fetchVehicleList<VehicleModelRecord>(
                `/api/admin/vehicles/models?makeId=${preferredModel.makeId}`,
              ),
              fetchVehicleList<VehicleModelDerivativeRecord>(
                `/api/admin/vehicles/master/derivatives?modelId=${preferredModel.id}`,
              ),
              fetchVehicleList<VehicleGenerationRecord>(
                `/api/admin/vehicles/master/generations?modelId=${preferredModel.id}`,
              ),
              preferredGeneration
                ? fetchVehicleList<VehicleTrimRecord>(
                    `/api/admin/vehicles/master/trims?generationId=${preferredGeneration.id}`,
                  )
                : Promise.resolve([] as VehicleTrimRecord[]),
              preferredGeneration
                ? fetchVehicleList<VehicleConfigurationRecord>(
                    `/api/admin/vehicles/master/configurations?generationId=${preferredGeneration.id}`,
                  )
                : Promise.resolve([] as VehicleConfigurationRecord[]),
            ]);
        }

        if (!active) return;

        setData({
          makes,
          models,
          derivatives: includeRecord(derivatives, preferredDerivative),
          generations: includeRecord(generations, preferredGeneration),
          trims: includeRecord(trims, preferredTrim),
          engines: [],
          transmissions: [],
          bodyTypes,
          markets,
          configurations,
        });

        if (preferredModel) {
          setMakeId(preferredModel.makeId);
          setModelId(preferredModel.id);
          setDerivativeId(preferredGeneration?.derivativeId ?? '');
          setGenerationId(preferredGeneration?.id ?? '');
          setTrimId(preferredTrim?.id ?? '');
        } else {
          setMakeId('');
          setModelId('');
          setDerivativeId('');
          setGenerationId('');
          setTrimId('');
        }
      } catch {
        if (active) {
          setLoadError(
            'Vehicle Master data could not be loaded. Check that the API and database are running.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    canManage,
    initialGenerationId,
    initialModelId,
    initialTrimId,
    reloadKey,
  ]);

  useEffect(() => {
    if (!canManage) {
      setSavedViewsLoading(false);
      return;
    }

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
  }, [canManage]);

  useEffect(() => {
    if (!canManage) {
      setLibraryLoading(false);
      return;
    }

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
        setLibraryValidatedVersions({});
        setLibraryValidationResults({});
        setLibraryLifecycleError('');
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
    canManage,
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
    if (!canManage || !trimId) {
      setTechnicalMasterLoading(false);
      setTechnicalMasterError('');
      setData((current) => ({
        ...current,
        engines: [],
        transmissions: [],
      }));
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setTechnicalMasterLoading(true);
        setTechnicalMasterError('');

        const engineQuery = new URLSearchParams({
          page: '1',
          pageSize: '50',
        });
        const transmissionQuery = new URLSearchParams({
          page: '1',
          pageSize: '50',
        });
        const normalizedEngineSearch = engineSearch.trim();
        const normalizedTransmissionSearch = transmissionSearch.trim();
        if (normalizedEngineSearch) {
          engineQuery.set('search', normalizedEngineSearch);
        }
        if (normalizedTransmissionSearch) {
          transmissionQuery.set('search', normalizedTransmissionSearch);
        }

        const [enginePage, transmissionPage] = await Promise.all([
          fetchVehiclePage<VehicleEngineRecord>(
            `/api/admin/vehicles/master/engines/page?${engineQuery.toString()}`,
          ),
          fetchVehiclePage<VehicleTransmissionRecord>(
            `/api/admin/vehicles/master/transmissions/page?${transmissionQuery.toString()}`,
          ),
        ]);

        const relevantConfigurations = data.configurations.filter(
          (item) =>
            item.modelId === modelId &&
            item.generationId === generationId &&
            item.trimId === trimId,
        );

        const engineIds = new Set(
          relevantConfigurations
            .map((item) => item.engineId)
            .filter((id): id is string => Boolean(id)),
        );
        if (engineId) engineIds.add(engineId);

        const transmissionIds = new Set(
          relevantConfigurations
            .map((item) => item.transmissionId)
            .filter((id): id is string => Boolean(id)),
        );
        if (transmissionId) transmissionIds.add(transmissionId);

        const loadedEngineIds = new Set(enginePage.items.map((item) => item.id));
        const loadedTransmissionIds = new Set(
          transmissionPage.items.map((item) => item.id),
        );

        const [extraEngines, extraTransmissions] = await Promise.all([
          Promise.all(
            [...engineIds]
              .filter((id) => !loadedEngineIds.has(id))
              .map((id) =>
                fetchVehicleRecord<VehicleEngineRecord>(
                  `/api/admin/vehicles/master/engines/${id}`,
                ),
              ),
          ),
          Promise.all(
            [...transmissionIds]
              .filter((id) => !loadedTransmissionIds.has(id))
              .map((id) =>
                fetchVehicleRecord<VehicleTransmissionRecord>(
                  `/api/admin/vehicles/master/transmissions/${id}`,
                ),
              ),
          ),
        ]);

        if (!active) return;
        setData((current) => ({
          ...current,
          engines: mergeRecords(enginePage.items, extraEngines),
          transmissions: mergeRecords(
            transmissionPage.items,
            extraTransmissions,
          ),
        }));
      } catch {
        if (active) {
          setTechnicalMasterError(
            'Engine and Transmission choices could not be loaded. Search again or retry.',
          );
        }
      } finally {
        if (active) setTechnicalMasterLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    canManage,
    data.configurations,
    engineId,
    engineSearch,
    generationId,
    modelId,
    transmissionId,
    transmissionSearch,
    trimId,
  ]);

  useEffect(() => {
    if (!canManage || !libraryMakeFilter) {
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
        if (active) setLibraryModels([]);
      });

    return () => {
      active = false;
    };
  }, [canManage, libraryMakeFilter]);

  const selectedModel = data.models.find((item) => item.id === modelId) ?? null;
  const selectedMake =
    data.makes.find((item) => item.id === (selectedModel?.makeId ?? makeId)) ?? null;
  const modelOptions = useMemo(
    () => data.models.filter((item) => !makeId || item.makeId === makeId),
    [data.models, makeId],
  );
  const derivativeOptions = useMemo(
    () => data.derivatives
      .filter((item) => item.modelId === modelId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [data.derivatives, modelId],
  );
  const generationOptions = useMemo(
    () =>
      generationsForModel(data.generations, modelId).filter(
        (item) => item.derivativeId === (derivativeId || null),
      ),
    [data.generations, derivativeId, modelId],
  );
  const trimOptions = useMemo(
    () => (generationId ? trimsForGeneration(data.trims, generationId) : []),
    [data.trims, generationId],
  );
  const selectedDerivative =
    data.derivatives.find((item) => item.id === derivativeId) ?? null;
  const selectedGeneration =
    data.generations.find((item) => item.id === generationId) ?? null;
  const selectedTrim = data.trims.find((item) => item.id === trimId) ?? null;
  const selectedEngine = data.engines.find((item) => item.id === engineId) ?? null;
  const selectedTransmission =
    data.transmissions.find((item) => item.id === transmissionId) ?? null;
  const selectedBodyType =
    data.bodyTypes.find((item) => item.id === bodyTypeId) ?? null;
  const selectedMarket =
    data.markets.find((item) => item.id === marketId) ?? null;

  const technicalOptions = useMemo(
    () =>
      modelId
        ? technicalMastersForSelection(
            data.configurations,
            data.models,
            data.generations,
            data.trims,
            data.engines,
            data.transmissions,
            {
              modelId,
              generationId: generationId || undefined,
              trimId: trimId || undefined,
            },
          )
        : {
            engines: [],
            transmissions: [],
            bodyTypeIds: [],
            marketIds: [],
            steeringSides: [],
            relatedConfigurationCount: 0,
          },
    [
      data.configurations,
      data.engines,
      data.generations,
      data.models,
      data.transmissions,
      data.trims,
      generationId,
      modelId,
      trimId,
    ],
  );

  const selectedYearBounds = useMemo(
    () => configurationYearBounds(selectedGeneration, selectedTrim),
    [selectedGeneration, selectedTrim],
  );

  const configurationCanBeCurrent =
    selectedGeneration?.endStatus === 'CURRENT' &&
    selectedYearBounds?.max === null;

  const bodyTypeOptions = useMemo(() => {
    if (technicalOptions.bodyTypeIds.length === 0) return data.bodyTypes;
    const allowed = new Set(technicalOptions.bodyTypeIds);
    return data.bodyTypes.filter(
      (item) => allowed.has(item.id) || item.id === bodyTypeId,
    );
  }, [bodyTypeId, data.bodyTypes, technicalOptions.bodyTypeIds]);

  const marketOptions = useMemo(() => {
    if (technicalOptions.marketIds.length === 0) return data.markets;
    const allowed = new Set(technicalOptions.marketIds);
    return data.markets.filter(
      (item) => allowed.has(item.id) || item.id === marketId,
    );
  }, [data.markets, marketId, technicalOptions.marketIds]);

  const suggestedConfigurationCode = useMemo(
    () =>
      createVehicleConfigurationCode([
        selectedMake?.code ?? selectedMake?.name ?? '',
        selectedModel?.code ?? selectedModel?.name ?? '',
        selectedDerivative?.code ?? selectedDerivative?.name ?? '',
        selectedGeneration?.code ?? selectedGeneration?.name ?? '',
        selectedTrim?.code ?? selectedTrim?.name ?? '',
        selectedEngine?.code ?? selectedEngine?.name ?? '',
        selectedTransmission?.code ?? selectedTransmission?.transmissionType ?? '',
        selectedBodyType?.code ?? selectedBodyType?.name ?? '',
        selectedMarket?.code ?? selectedMarket?.name ?? '',
        steeringSide,
      ]),
    [
      selectedMake,
      selectedModel,
      selectedDerivative,
      selectedGeneration,
      selectedTrim,
      selectedEngine,
      selectedTransmission,
      selectedBodyType,
      selectedMarket,
      steeringSide,
    ],
  );

  const configurationDuplicate = useLikelyDuplicate({
    enabled: Boolean(suggestedConfigurationCode),
    name: '',
    code: suggestedConfigurationCode,
    searchUrl: '/api/admin/vehicles/configuration-library',
  });

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

  async function loadModelsForMake(nextMakeId: string) {
    if (!nextMakeId) {
      setData((current) => ({
        ...current,
        models: [],
        derivatives: [],
        generations: [],
        trims: [],
        configurations: [],
      }));
      return;
    }

    try {
      const models = await fetchVehicleList<VehicleModelRecord>(
        `/api/admin/vehicles/models?makeId=${nextMakeId}`,
      );
      setData((current) => ({
        ...current,
        models,
        derivatives: [],
        generations: [],
        trims: [],
        configurations: [],
      }));
    } catch {
      setFormError('Models for the selected Make could not be loaded.');
    }
  }

  async function loadModelHierarchy(nextModelId: string) {
    if (!nextModelId) return;

    try {
      const [derivatives, generations] = await Promise.all([
        fetchVehicleList<VehicleModelDerivativeRecord>(
          `/api/admin/vehicles/master/derivatives?modelId=${nextModelId}`,
        ),
        fetchVehicleList<VehicleGenerationRecord>(
          `/api/admin/vehicles/master/generations?modelId=${nextModelId}`,
        ),
      ]);
      setData((current) => ({
        ...current,
        derivatives,
        generations,
        trims: [],
        configurations: [],
      }));
    } catch {
      setFormError(
        'Derivatives and Generations for the selected Model could not be loaded.',
      );
    }
  }

  async function loadGenerationChildren(nextGenerationId: string) {
    if (!nextGenerationId) return;

    try {
      const [trims, configurations] = await Promise.all([
        fetchVehicleList<VehicleTrimRecord>(
          `/api/admin/vehicles/master/trims?generationId=${nextGenerationId}`,
        ),
        fetchVehicleList<VehicleConfigurationRecord>(
          `/api/admin/vehicles/master/configurations?generationId=${nextGenerationId}`,
        ),
      ]);
      setData((current) => ({
        ...current,
        trims,
        configurations,
      }));
    } catch {
      setFormError(
        'Trims and saved Configurations for the selected Generation could not be loaded.',
      );
    }
  }

  function chooseMake(nextMakeId: string) {
    setMakeId(nextMakeId);
    setModelId('');
    setDerivativeId('');
    setGenerationId('');
    setTrimId('');
    setModelFormOpen(false);
    setDerivativeFormOpen(false);
    setGenerationFormOpen(false);
    setTrimFormOpen(false);
    setData((current) => ({
      ...current,
      models: [],
      derivatives: [],
      generations: [],
      trims: [],
      configurations: [],
    }));
    resetConfigurationDetails();
    resetMessages();
    void loadModelsForMake(nextMakeId);
  }

  function chooseModel(nextModelId: string) {
    const model = data.models.find((item) => item.id === nextModelId);
    setModelId(nextModelId);
    setMakeId(model?.makeId ?? makeId);
    setDerivativeId('');
    setGenerationId('');
    setTrimId('');
    setDerivativeFormOpen(false);
    setGenerationFormOpen(false);
    setTrimFormOpen(false);
    setData((current) => ({
      ...current,
      derivatives: [],
      generations: [],
      trims: [],
      configurations: [],
    }));
    resetConfigurationDetails();
    resetMessages();
    void loadModelHierarchy(nextModelId);
  }

  function chooseDerivative(nextDerivativeId: string) {
    setDerivativeId(nextDerivativeId);
    setGenerationId('');
    setTrimId('');
    setGenerationFormOpen(false);
    setData((current) => ({
      ...current,
      trims: [],
      configurations: [],
    }));
    resetConfigurationDetails();
    resetMessages();
  }

  function chooseGeneration(nextGenerationId: string) {
    setGenerationId(nextGenerationId);
    setTrimId('');
    setData((current) => ({
      ...current,
      trims: [],
      configurations: [],
    }));
    resetConfigurationDetails();
    resetMessages();
    void loadGenerationChildren(nextGenerationId);
  }

  function chooseTrim(nextTrimId: string) {
    setTrimId(nextTrimId);
    resetConfigurationDetails();

    const existing = data.configurations.find(
      (item) =>
        item.modelId === modelId &&
        item.generationId === generationId &&
        item.trimId === nextTrimId,
    );
    if (existing) {
      setBodyTypeId(existing.bodyTypeId ?? '');
      setMarketId(existing.marketId ?? '');
      setSteeringSide(existing.steeringSide ?? '');
    }

    resetMessages();
  }

  function resetConfigurationDetails() {
    setTechnicalEditor(null);
    setTechnicalForm({});
    setTechnicalStatus('DRAFT');
    setEngineId('');
    setTransmissionId('');
    setEngineSearch('');
    setTransmissionSearch('');
    setTechnicalMasterError('');
    setBodyTypeId('');
    setMarketId('');
    setModelYear('');
    setProductionStartYear('');
    setProductionStartMonth('');
    setProductionEndYear('');
    setProductionEndMonth('');
    setProductionEndStatus('UNKNOWN');
    setSteeringSide('');
    setConfigurationStatus('DRAFT');
  }

  function resetMessages() {
    setFormError('');
    setSuccess('');
  }

  async function validateLibraryConfiguration(
    item: Pick<VehicleConfigurationRecord, 'id' | 'code' | 'status' | 'version'>,
  ) {
    setLibraryLifecycleWorkingId(item.id);
    setLibraryLifecycleError('');
    setLibraryLifecycleNotice('');

    try {
      const validation =
        await fetchVehicleValidation(item.id);
      setLibraryValidatedVersions((current) => ({
        ...current,
        [item.id]: validation.version,
      }));
      setLibraryValidationResults((current) => ({
        ...current,
        [item.id]: {
          version: validation.version,
          valid: validation.valid,
          message: validation.message,
        },
      }));
      setLibraryLifecycleNotice(
        `${item.code} passed activation validation at version ${validation.version}.`,
      );
    } catch (error) {
      setLibraryValidatedVersions((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      const message =
        error instanceof Error
          ? error.message
          : 'This configured vehicle is not ready for activation.';
      setLibraryValidationResults((current) => ({
        ...current,
        [item.id]: {
          version: item.version,
          valid: false,
          message,
        },
      }));
      setLibraryLifecycleError(message);
    } finally {
      setLibraryLifecycleWorkingId(null);
    }
  }

  async function activateLibraryConfiguration(
    item: Pick<VehicleConfigurationRecord, 'id' | 'code' | 'status' | 'version'>,
  ) {
    setLibraryLifecycleWorkingId(item.id);
    setLibraryLifecycleError('');
    setLibraryLifecycleNotice('');

    try {
      const validation = await fetchVehicleValidation(item.id);
      const updated = await patchJson<VehicleConfigurationRecord>(
        `/api/admin/vehicles/master/configurations/${item.id}`,
        {
          version: validation.version,
          status: 'ACTIVE',
        },
      );

      setLibraryValidatedVersions((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setLibraryValidationResults((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setLibraryLifecycleNotice(`${updated.code} validated and activated.`);
      setLibraryReloadKey((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof ClientApiError || error instanceof Error
          ? error.message
          : 'The configured vehicle could not be validated and activated.';
      setLibraryValidationResults((current) => ({
        ...current,
        [item.id]: {
          version: item.version,
          valid: false,
          message,
        },
      }));
      setLibraryLifecycleError(message);
    } finally {
      setLibraryLifecycleWorkingId(null);
    }
  }

  async function exportConfiguredVehiclesCsv() {
    setExportBusy(true);
    setLibraryLifecycleError('');
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
      setLibraryLifecycleError(
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
    const nextModelId =
      typeof state.modelId === 'string' ? state.modelId : '';
    const nextStatus = isMasterStatusFilter(state.status)
      ? state.status
      : 'ALL';
    const nextSortBy = isConfiguredVehicleSortBy(state.sortBy)
      ? state.sortBy
      : 'HIERARCHY';
    const nextSortDirection =
      state.sortDirection === 'DESC' ? 'DESC' : 'ASC';

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
    const selected = savedViews.find(
      (view) => view.id === selectedSavedViewId,
    );
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
    const selected = savedViews.find(
      (view) => view.id === selectedSavedViewId,
    );
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
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
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

  function openMakeForm() {
    setMakeName('');
    setMakeCode('');
    setMakeStatus('DRAFT');
    setMakeFormOpen(true);
    setModelFormOpen(false);
    resetMessages();
  }

  function openModelForm() {
    if (!makeId) return;
    setModelName('');
    setModelCode('');
    setModelStatus('DRAFT');
    setModelFormOpen(true);
    setMakeFormOpen(false);
    resetMessages();
  }

  async function createMake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('make');
    resetMessages();

    try {
      const input: CreateVehicleMakeInput = {
        code: makeCode.trim().toUpperCase(),
        name: makeName.trim(),
        status: makeStatus,
      };
      const created = await postJson<VehicleMakeRecord>(
        '/api/admin/vehicles/makes',
        input,
      );

      setData((current) => ({
        ...current,
        makes: [...current.makes, created],
      }));
      setMakeId(created.id);
      setModelId('');
      setDerivativeId('');
      setGenerationId('');
      setTrimId('');
      setMakeFormOpen(false);
      setModelName('');
      setModelCode('');
      setModelStatus('DRAFT');
      setModelFormOpen(true);
      resetConfigurationDetails();
      setSuccess(`${created.name} added. Create or select its Model next.`);
    } catch (error) {
      setFormError(messageFor(error, 'The vehicle make could not be created.'));
    } finally {
      setSaving(null);
    }
  }

  async function createModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!makeId) return;
    setSaving('model');
    resetMessages();

    try {
      const input: CreateVehicleModelInput = {
        makeId,
        code: modelCode.trim().toUpperCase(),
        name: modelName.trim(),
        status: modelStatus,
      };
      const created = await postJson<VehicleModelRecord>(
        '/api/admin/vehicles/models',
        input,
      );

      setData((current) => ({
        ...current,
        models: [...current.models, created],
      }));
      setModelId(created.id);
      setDerivativeId('');
      setGenerationId('');
      setTrimId('');
      setModelFormOpen(false);
      resetConfigurationDetails();
      setSuccess(
        `${created.name} added. Choose an optional Derivative / Body Line, or continue directly with Generation.`,
      );
    } catch (error) {
      setFormError(messageFor(error, 'The vehicle model could not be created.'));
    } finally {
      setSaving(null);
    }
  }

  function openDerivativeForm() {
    if (!modelId) return;
    setDerivativeName('');
    setDerivativeCode('');
    setDerivativeStatus('DRAFT');
    setDerivativeFormOpen(true);
    resetMessages();
  }

  function openGenerationForm() {
    if (!modelId) return;
    setGenerationName('');
    setGenerationCode('');
    setGenerationStartYear('');
    setGenerationEndYear('');
    setGenerationEndStatus('UNKNOWN');
    setGenerationStatus('DRAFT');
    setGenerationFormOpen(true);
    resetMessages();
  }

  function openTrimForm() {
    setTrimName('');
    setTrimCode('');
    setTrimEquipmentLevel('');
    setTrimStartYear('');
    setTrimEndYear('');
    setTrimStatus('DRAFT');
    setTrimFormOpen(true);
    resetMessages();
  }

  async function createDerivative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modelId) return;
    setSaving('derivative');
    resetMessages();
    try {
      const input: CreateVehicleModelDerivativeInput = {
        modelId,
        code: derivativeCode.trim().toUpperCase(),
        name: derivativeName.trim(),
        status: derivativeStatus,
      };
      const created = await postJson<VehicleModelDerivativeRecord>(
        '/api/admin/vehicles/master/derivatives',
        input,
      );
      setData((current) => ({
        ...current,
        derivatives: [...current.derivatives, created],
      }));
      setDerivativeId(created.id);
      setGenerationId('');
      setTrimId('');
      setDerivativeFormOpen(false);
      setSuccess(`${created.name} added under ${selectedModel?.name ?? 'model'}. Continue with Generation.`);
    } catch (error) {
      setFormError(messageFor(error, 'The model derivative could not be created.'));
    } finally {
      setSaving(null);
    }
  }

  async function createGeneration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modelId) return;

    const startYear = optionalNumber(generationStartYear);
    const endYear = optionalNumber(generationEndYear);

    if (generationStatus === 'ACTIVE' && startYear === undefined) {
      setFormError('An active generation needs a verified production start year.');
      return;
    }
    if (generationEndStatus === 'ENDED' && endYear === undefined) {
      setFormError('Choose the verified Generation end year.');
      return;
    }
    if (
      generationEndStatus !== 'ENDED' &&
      endYear !== undefined
    ) {
      setFormError(
        'Present or End not verified cannot carry a Generation end year.',
      );
      return;
    }
    if (endYear !== undefined && startYear === undefined) {
      setFormError('Choose a generation start year before the end year.');
      return;
    }
    if (
      startYear !== undefined &&
      endYear !== undefined &&
      startYear > endYear
    ) {
      setFormError('Generation start year cannot be after its end year.');
      return;
    }

    setSaving('generation');
    resetMessages();
    try {
      const input: CreateVehicleGenerationInput = {
        modelId,
        derivativeId: derivativeId || undefined,
        code: generationCode.trim() || undefined,
        name: generationName.trim(),
        startYear,
        endYear,
        endStatus: generationEndStatus,
        status: generationStatus,
      };
      const created = await postJson<VehicleGenerationRecord>(
        '/api/admin/vehicles/master/generations',
        input,
      );
      setData((current) => ({
        ...current,
        generations: [...current.generations, created],
      }));
      setGenerationId(created.id);
      setTrimId('');
      setGenerationFormOpen(false);
      setSuccess(`${created.name} added. Continue with Trim / Variant.`);
    } catch (error) {
      setFormError(messageFor(error, 'The generation could not be created.'));
    } finally {
      setSaving(null);
    }
  }

  async function createTrim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!generationId) return;

    const startYear = optionalNumber(trimStartYear);
    const endYear = optionalNumber(trimEndYear);

    if (endYear !== undefined && startYear === undefined) {
      setFormError('Choose a Trim applicability start year before the end year.');
      return;
    }
    if (
      startYear !== undefined &&
      endYear !== undefined &&
      startYear > endYear
    ) {
      setFormError('Trim applicability start year cannot be after its end year.');
      return;
    }

    setSaving('trim');
    resetMessages();
    try {
      const input: CreateVehicleTrimInput = {
        generationId,
        code: trimCode.trim() || undefined,
        name: trimName.trim(),
        equipmentLevel: trimEquipmentLevel.trim() || undefined,
        startYear,
        endYear,
        status: trimStatus,
      };
      const created = await postJson<VehicleTrimRecord>(
        '/api/admin/vehicles/master/trims',
        input,
      );
      setData((current) => ({ ...current, trims: [...current.trims, created] }));
      setTrimId(created.id);
      setTrimFormOpen(false);
      setSuccess(`${created.name} added. Complete the canonical vehicle configuration.`);
    } catch (error) {
      setFormError(messageFor(error, 'The trim could not be created.'));
    } finally {
      setSaving(null);
    }
  }

  function openTechnicalEditor(editor: Exclude<TechnicalMasterEditor, null>) {
    setTechnicalEditor(editor);
    setTechnicalForm({});
    setTechnicalStatus('DRAFT');
    resetMessages();
  }

  function setTechnicalField(name: string, value: string) {
    setTechnicalForm((current) => ({ ...current, [name]: value }));
  }

  function closeTechnicalEditor() {
    if (saving === 'technical') return;
    setTechnicalEditor(null);
    setTechnicalForm({});
    setTechnicalStatus('DRAFT');
  }

  async function createTechnicalMaster() {
    if (!technicalEditor) return;

    const name = technicalForm.name?.trim() ?? '';
    const code = technicalForm.code?.trim().toUpperCase() ?? '';
    const transmissionType = technicalForm.transmissionType?.trim() ?? '';

    if (technicalEditor === 'engine' && !name) {
      setFormError('Engine name is required.');
      return;
    }
    if (technicalEditor === 'transmission' && !transmissionType) {
      setFormError('Transmission type is required.');
      return;
    }
    if (
      (technicalEditor === 'body-type' || technicalEditor === 'market') &&
      (!name || !code)
    ) {
      setFormError('Name and code are required for this master record.');
      return;
    }

    setSaving('technical');
    resetMessages();

    try {
      if (technicalEditor === 'engine') {
        const input: CreateVehicleEngineInput = {
          code: code || undefined,
          name,
          family: optionalText(technicalForm.family),
          displacementCc: optionalNumber(technicalForm.displacementCc ?? ''),
          fuelType: optionalText(technicalForm.fuelType),
          cylinderCount: optionalNumber(technicalForm.cylinderCount ?? ''),
          aspiration: optionalText(technicalForm.aspiration),
          powerKw: optionalNumber(technicalForm.powerKw ?? ''),
          torqueNm: optionalNumber(technicalForm.torqueNm ?? ''),
          startYear: optionalNumber(technicalForm.startYear ?? ''),
          endYear: optionalNumber(technicalForm.endYear ?? ''),
          status: technicalStatus,
        };
        const created = await postJson<VehicleEngineRecord>(
          '/api/admin/vehicles/master/engines',
          input,
        );
        setData((current) => ({
          ...current,
          engines: [...current.engines, created],
        }));
        setEngineId(created.id);
        setSuccess(`${created.name} added and selected for this configuration.`);
      } else if (technicalEditor === 'transmission') {
        const input: CreateVehicleTransmissionInput = {
          code: code || undefined,
          transmissionType,
          gearCount: optionalNumber(technicalForm.gearCount ?? ''),
          driveType: optionalText(technicalForm.driveType),
          startYear: optionalNumber(technicalForm.startYear ?? ''),
          endYear: optionalNumber(technicalForm.endYear ?? ''),
          status: technicalStatus,
        };
        const created = await postJson<VehicleTransmissionRecord>(
          '/api/admin/vehicles/master/transmissions',
          input,
        );
        setData((current) => ({
          ...current,
          transmissions: [...current.transmissions, created],
        }));
        setTransmissionId(created.id);
        setSuccess(
          `${created.code ? `${created.code} · ` : ''}${created.transmissionType} added and selected.`,
        );
      } else {
        const input: CreateVehicleNamedMasterInput = {
          code,
          name,
          status: technicalStatus,
        };
        const resource =
          technicalEditor === 'body-type' ? 'body-types' : 'markets';
        const created = await postJson<VehicleNamedMasterRecord>(
          `/api/admin/vehicles/master/${resource}`,
          input,
        );
        if (technicalEditor === 'body-type') {
          setData((current) => ({
            ...current,
            bodyTypes: [...current.bodyTypes, created],
          }));
          setBodyTypeId(created.id);
        } else {
          setData((current) => ({
            ...current,
            markets: [...current.markets, created],
          }));
          setMarketId(created.id);
        }
        setSuccess(`${created.name} added and selected.`);
      }

      setTechnicalEditor(null);
      setTechnicalForm({});
      setTechnicalStatus('DRAFT');
    } catch (error) {
      setFormError(
        messageFor(error, 'The technical master record could not be created.'),
      );
    } finally {
      setSaving(null);
    }
  }

  async function createConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedMake ||
      !selectedModel ||
      !selectedGeneration ||
      !selectedTrim ||
      !engineId ||
      !transmissionId
    ) {
      setFormError(
        'Complete Make → Model → Generation → Trim, then select Engine and Transmission.',
      );
      return;
    }

    const exactYear = optionalNumber(modelYear);
    const rangeStart = optionalNumber(productionStartYear);
    const startMonth = optionalNumber(productionStartMonth);
    const rangeEnd = optionalNumber(productionEndYear);
    const endMonth = optionalNumber(productionEndMonth);

    if (configurationStatus === 'ACTIVE' && rangeStart === undefined) {
      setFormError(
        'An active configured vehicle needs a verified production start year.',
      );
      return;
    }

    if (startMonth !== undefined && rangeStart === undefined) {
      setFormError('A production start month requires a production start year.');
      return;
    }

    if (
      productionEndStatus === 'CURRENT' &&
      !configurationCanBeCurrent
    ) {
      setFormError(
        'This Configuration cannot be Present because its Generation/Trim applicability is not explicitly current.',
      );
      return;
    }

    if (productionEndStatus === 'ENDED' && rangeEnd === undefined) {
      setFormError('Ended production requires a verified production end year.');
      return;
    }

    if (
      productionEndStatus !== 'ENDED' &&
      (rangeEnd !== undefined || endMonth !== undefined)
    ) {
      setFormError(
        'Current or unknown production cannot have an end date. Choose Ended first.',
      );
      return;
    }

    if (endMonth !== undefined && rangeEnd === undefined) {
      setFormError('A production end month requires a production end year.');
      return;
    }

    if (rangeEnd !== undefined && rangeStart === undefined) {
      setFormError(
        'Choose a production start year before setting an end year.',
      );
      return;
    }

    if (
      rangeStart !== undefined &&
      rangeEnd !== undefined &&
      rangeStart > rangeEnd
    ) {
      setFormError('Production start year cannot be after end year.');
      return;
    }

    if (
      rangeStart !== undefined &&
      rangeEnd !== undefined &&
      rangeStart === rangeEnd &&
      startMonth !== undefined &&
      endMonth !== undefined &&
      startMonth > endMonth
    ) {
      setFormError(
        'Production start month cannot be after end month in the same year.',
      );
      return;
    }

    if (
      exactYear !== undefined &&
      rangeStart !== undefined &&
      exactYear < rangeStart
    ) {
      setFormError('Exact model year cannot be before the production period.');
      return;
    }

    if (
      exactYear !== undefined &&
      rangeEnd !== undefined &&
      exactYear > rangeEnd
    ) {
      setFormError('Exact model year cannot be after the production period.');
      return;
    }

    if (selectedYearBounds) {
      const outsideBounds = [exactYear, rangeStart, rangeEnd].some(
        (value) =>
          value !== undefined &&
          (value < selectedYearBounds.min ||
            (selectedYearBounds.max !== null &&
              value > selectedYearBounds.max)),
      );
      if (outsideBounds) {
        setFormError(
          `Configured-vehicle years must stay within ${selectedYearBounds.min}–${selectedYearBounds.max ?? 'present'} for the selected Generation/Trim.`,
        );
        return;
      }
    }

    setSaving('configuration');
    resetMessages();
    try {
      const input: CreateVehicleConfigurationInput = {
        code: suggestedConfigurationCode.toUpperCase(),
        makeId: selectedMake.id,
        modelId: selectedModel.id,
        generationId,
        trimId,
        engineId,
        transmissionId,
        bodyTypeId: bodyTypeId || undefined,
        marketId: marketId || undefined,
        modelYear: exactYear,
        productionStartYear: rangeStart,
        productionStartMonth: startMonth,
        productionEndYear:
          productionEndStatus === 'ENDED' ? rangeEnd : undefined,
        productionEndMonth:
          productionEndStatus === 'ENDED' ? endMonth : undefined,
        productionEndStatus,
        steeringSide: steeringSide || undefined,
        status: configurationStatus,
      };
      const created = await postJson<VehicleConfigurationRecord>(
        '/api/admin/vehicles/master/configurations',
        input,
      );
      setData((current) => ({
        ...current,
        configurations: [...current.configurations, created],
      }));
      setLibraryReloadKey((current) => current + 1);
      setSuccess(`${created.code} saved as a configured vehicle.`);
    } catch (error) {
      setFormError(messageFor(error, 'The configured vehicle could not be saved.'));
    } finally {
      setSaving(null);
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
    const hierarchyPath = [make?.name, model?.name, generation?.name, trim?.name]
      .filter((value): value is string => Boolean(value))
      .join(' → ');

    const validationResult = libraryValidationResults[item.id];
    const currentValidation =
      validationResult?.version === item.version ? validationResult : null;

    return (
      <div className="vehicle-builder-existing__row" key={item.id}>
        <div>
          <strong>{showHierarchy ? hierarchyPath || item.code : item.code}</strong>
          {showHierarchy ? <span>{item.code}</span> : null}
          <span>{configurationApplicabilityLabel(item)}</span>
          <span>{configurationDescription(item, libraryPresentation)}</span>
          <small>{configurationVinReadiness(item)}</small>
          {item.status !== 'ACTIVE' && currentValidation ? (
            <small
              className={
                currentValidation.valid
                  ? 'vehicle-library-readiness vehicle-library-readiness--ready'
                  : 'vehicle-library-readiness vehicle-library-readiness--blocked'
              }
              role={currentValidation.valid ? 'status' : 'alert'}
            >
              {currentValidation.valid
                ? `Ready to activate · ${currentValidation.message}`
                : `Activation blocker · ${currentValidation.message}`}
            </small>
          ) : null}
        </div>
        <div className="vehicle-builder-step__actions">
          <span
            className={`category-status category-status--${item.status.toLowerCase()}`}
          >
            {formatAdminEnumLabel(item.status)}
          </span>
          {item.status !== 'ACTIVE' ? (
            <>
              <button
                className="button button--quiet"
                type="button"
                disabled={libraryLifecycleWorkingId === item.id}
                onClick={() => void validateLibraryConfiguration(item)}
              >
                {libraryLifecycleWorkingId === item.id
                  ? 'Checking…'
                  : libraryValidatedVersions[item.id] === item.version
                    ? 'Validated'
                    : 'Validate'}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={libraryLifecycleWorkingId === item.id}
                onClick={() => void activateLibraryConfiguration(item)}
              >
                {libraryLifecycleWorkingId === item.id
                  ? 'Validating…'
                  : 'Validate & activate'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Vehicle management</span>
        <h1>Configured Vehicles</h1>
        <div className="catalog-state" role="alert">
          <p>Your administrator account does not have the vehicle.manage permission.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page vehicle-builder">
      <AdminPageHeader
        eyebrow="Vehicle management"
        title="Configured Vehicles Library"
        description="Build canonical vehicles once and keep every completed configuration in one searchable library. Derivative / Body Line remains optional; the canonical path is Make → Model → Generation → Trim / Variant → Configuration."
        actions={
          <a
            className="button button--secondary"
            href="/admin/vehicles/configurations/masters"
          >
            Advanced masters
          </a>
        }
      />

      <VehicleAdminNav active="configurations" />

      <div className="vehicle-builder__principle">
        <strong>Canonical path</strong>
        <span>Make → Model → Generation → Trim / Variant → Configuration</span>
        <small>Years are applicability metadata, not hierarchy levels. Derivative / Body Line remains optional metadata on the Generation; Engine, Transmission, Body Type, Market and steering stay at Configuration level.</small>
      </div>

      {loading ? (
        <div className="catalog-state" aria-live="polite">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <span>Loading Vehicle Master…</span>
        </div>
      ) : loadError ? (
        <div className="catalog-state vehicle-state--error" role="alert">
          <div><strong>Vehicle data unavailable</strong><p>{loadError}</p></div>
          <button className="button button--quiet" type="button" onClick={() => setReloadKey((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {formError ? <div className="alert alert--error" role="alert">{formError}</div> : null}
          {success ? <div className="vehicle-builder__success" role="status">{success}</div> : null}

          <div className="vehicle-builder-record-heading">
            <div>
              <span className="eyebrow">New vehicle master record</span>
              <h2>Create configured vehicle</h2>
              <p>
                Build the canonical identity step by step. Quick-added master
                records stay in Draft and internal codes are generated
                automatically; use Advanced masters for activation and advanced
                maintenance.
              </p>
            </div>
            <span className="vehicle-builder-record-heading__badge">
              Codes generated automatically
            </span>
          </div>

          <div className="vehicle-builder__steps">
            <section className="vehicle-builder-step vehicle-builder-step--active">
              <StepNumber value="1" />
              <div className="vehicle-builder-step__body">
                <div className="vehicle-builder-step__heading">
                  <div>
                    <span>Start here</span>
                    <h2>Build Make and Model</h2>
                    <p>
                      Select existing master records or create them inline. After
                      the Model, a Derivative / Body Line is optional.
                    </p>
                  </div>
                  <div className="vehicle-builder-step__actions">
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={openMakeForm}
                    >
                      + Add make
                    </button>
                    <button
                      className="button button--quiet"
                      type="button"
                      disabled={!makeId}
                      onClick={openModelForm}
                    >
                      + Add model
                    </button>
                  </div>
                </div>

                <div className="vehicle-builder-grid vehicle-builder-grid--2">
                  <SelectField
                    label="Make"
                    value={makeId}
                    onChange={chooseMake}
                    options={data.makes.map((item) => ({ id: item.id, label: item.name }))}
                    placeholder="Select make"
                  />
                  <SelectField
                    label="Model"
                    value={modelId}
                    onChange={chooseModel}
                    options={modelOptions.map((item) => ({ id: item.id, label: item.name }))}
                    placeholder={makeId ? 'Select model' : 'Select a make first'}
                    disabled={!makeId}
                  />
                </div>

                {makeFormOpen ? (
                  <form
                    className="vehicle-builder-inline-form"
                    ref={makeFormKeyboard.ref}
                    onKeyDown={makeFormKeyboard.onKeyDown}
                    onSubmit={createMake}
                  >
                    <div className="vehicle-builder-grid">
                      <TextField
                        label="Make name"
                        value={makeName}
                        onChange={(value) => {
                          const previousGeneratedCode = createVehicleCode(makeName);
                          if (!makeCode || makeCode === previousGeneratedCode) {
                            setMakeCode(createVehicleCode(value));
                          }
                          setMakeName(value);
                        }}
                        required
                      />
                    </div>
                    <LikelyDuplicateWarning
                      match={makeDuplicate.match}
                      checking={makeDuplicate.checking}
                    />
                    <InlineActions
                      saving={saving === 'make'}
                      saveLabel="Create make"
                      onCancel={() => setMakeFormOpen(false)}
                    />
                  </form>
                ) : null}

                {modelFormOpen ? (
                  <form
                    className="vehicle-builder-inline-form"
                    ref={modelFormKeyboard.ref}
                    onKeyDown={modelFormKeyboard.onKeyDown}
                    onSubmit={createModel}
                  >
                    <div className="vehicle-builder-grid">
                      <TextField
                        label="Model name"
                        value={modelName}
                        onChange={(value) => {
                          const previousGeneratedCode = createVehicleCode(modelName);
                          if (!modelCode || modelCode === previousGeneratedCode) {
                            setModelCode(createVehicleCode(value));
                          }
                          setModelName(value);
                        }}
                        required
                      />
                    </div>
                    <LikelyDuplicateWarning
                      match={modelDuplicate.match}
                      checking={modelDuplicate.checking}
                    />
                    <InlineActions
                      saving={saving === 'model'}
                      saveLabel="Create model"
                      onCancel={() => setModelFormOpen(false)}
                    />
                  </form>
                ) : null}

                {selectedModel ? (
                  <IdentitySummary
                    title={`${selectedMake?.name ?? 'Unknown make'} → ${selectedModel.name}`}
                    meta={`${selectedModel.code} · ${formatAdminEnumLabel(selectedModel.status)}`}
                  />
                ) : makeId ? (
                  <StepBlocked text="Select or create a Model under this Make." />
                ) : (
                  <StepBlocked text="Select or create a Make to begin the hierarchy." />
                )}
              </div>
            </section>

            <section className={`vehicle-builder-step ${modelId ? 'vehicle-builder-step--active' : ''}`}>
              <StepNumber value="2" />
              <div className="vehicle-builder-step__body">
                <div className="vehicle-builder-step__heading">
                  <div>
                    <span>Under the model</span>
                    <h2>Choose optional Derivative / Body Line, then Generation</h2>
                    <p>
                      Use Saloon, Verso, Hatchback or Wagon when the model family
                      has derivatives. For models such as bZ4X, leave Derivative
                      blank and add the Generation directly under the Model.
                    </p>
                  </div>
                  <div className="vehicle-builder-step__actions">
                    <button className="button button--quiet" type="button" disabled={!modelId} onClick={openDerivativeForm}>
                      + Add derivative
                    </button>
                    <button className="button button--quiet" type="button" disabled={!modelId} onClick={openGenerationForm}>
                      + Add generation
                    </button>
                  </div>
                </div>
                {modelId ? (
                  <>
                    <SelectField
                      label="Derivative / Body Line"
                      value={derivativeId}
                      onChange={chooseDerivative}
                      options={derivativeOptions.map((item) => ({
                        id: item.id,
                        label: item.name,
                      }))}
                      placeholder="No derivative — generation belongs directly to model"
                    />
                    {derivativeFormOpen ? (
                      <form
                        className="vehicle-builder-inline-form"
                        ref={derivativeFormKeyboard.ref}
                        onKeyDown={derivativeFormKeyboard.onKeyDown}
                        onSubmit={createDerivative}
                      >
                        <div className="vehicle-builder-grid">
                          <TextField label="Derivative name" value={derivativeName} onChange={(value) => {
                            const previousGeneratedCode = createVehicleCode(derivativeName);
                            if (!derivativeCode || derivativeCode === previousGeneratedCode) {
                              setDerivativeCode(createVehicleCode(value));
                            }
                            setDerivativeName(value);
                          }} required />
                        </div>
                        <LikelyDuplicateWarning
                          match={derivativeDuplicate.match}
                          checking={derivativeDuplicate.checking}
                        />
                        <InlineActions
                          saving={saving === 'derivative'}
                          saveLabel="Save derivative"
                          onCancel={() => setDerivativeFormOpen(false)}
                        />
                      </form>
                    ) : null}
                    <SelectField
                      label="Generation"
                      value={generationId}
                      onChange={chooseGeneration}
                      options={generationOptions.map((item) => ({
                        id: item.id,
                        label: `${item.name}${generationYearRange(item)}`,
                      }))}
                      placeholder={
                        derivativeId
                          ? 'Select generation under this derivative'
                          : 'Select generation directly under this model'
                      }
                    />
                    {generationFormOpen ? (
                      <form
                        className="vehicle-builder-inline-form"
                        ref={generationFormKeyboard.ref}
                        onKeyDown={generationFormKeyboard.onKeyDown}
                        onSubmit={createGeneration}
                      >
                        <div className="vehicle-builder-grid vehicle-builder-grid--4">
                          <TextField label="Generation name" value={generationName} onChange={(value) => {
                            const previousGeneratedCode = createVehicleCode(generationName);
                            if (!generationCode || generationCode === previousGeneratedCode) {
                              setGenerationCode(createVehicleCode(value));
                            }
                            setGenerationName(value);
                          }} required />
                          <YearSelectField
                            label="Production from year"
                            value={generationStartYear}
                            onChange={(value) => {
                              setGenerationStartYear(value);
                              if (
                                generationEndYear &&
                                value &&
                                Number(generationEndYear) < Number(value)
                              ) {
                                setGenerationEndYear('');
                              }
                            }}
                            placeholder="Select start year"
                            hint="Optional during quick entry; verify before activation in Advanced masters."
                          />
                          <ProductionEndYearField
                            label="Production to"
                            value={
                              generationEndStatus === 'CURRENT'
                                ? 'CURRENT'
                                : generationEndStatus === 'UNKNOWN'
                                  ? 'UNKNOWN'
                                  : generationEndYear
                            }
                            onChange={(value) => {
                              if (value === 'CURRENT') {
                                setGenerationEndStatus('CURRENT');
                                setGenerationEndYear('');
                                return;
                              }
                              if (value === 'UNKNOWN') {
                                setGenerationEndStatus('UNKNOWN');
                                setGenerationEndYear('');
                                return;
                              }
                              setGenerationEndStatus('ENDED');
                              setGenerationEndYear(value);
                            }}
                            min={optionalNumber(generationStartYear)}
                            allowCurrent
                            hint="Choose a verified end year, Present, or End not verified."
                          />
                        </div>
                        <LikelyDuplicateWarning
                          match={generationDuplicate.match}
                          checking={generationDuplicate.checking}
                        />
                        <InlineActions
                          saving={saving === 'generation'}
                          saveLabel="Save generation"
                          onCancel={() => setGenerationFormOpen(false)}
                        />
                      </form>
                    ) : null}
                  </>
                ) : <StepBlocked text="Choose a model first." />}
              </div>
            </section>

            <section className={`vehicle-builder-step ${generationId ? 'vehicle-builder-step--active' : ''}`}>
              <StepNumber value="3" />
              <div className="vehicle-builder-step__body">
                <div className="vehicle-builder-step__heading">
                  <div>
                    <span>Under the generation</span>
                    <h2>Add or select Trim / Variant</h2>
                    <p>Select the trim / variant that the configured vehicle belongs to.</p>
                  </div>
                  <button className="button button--quiet" type="button" disabled={!generationId} onClick={openTrimForm}>
                    + Add trim
                  </button>
                </div>
                {generationId ? (
                  <>
                    <SelectField
                      label="Trim / Variant"
                      value={trimId}
                      onChange={chooseTrim}
                      options={trimOptions.map((item) => ({ id: item.id, label: item.name }))}
                      placeholder="Select trim / variant"
                    />
                    {trimFormOpen ? (
                      <form
                        className="vehicle-builder-inline-form"
                        ref={trimFormKeyboard.ref}
                        onKeyDown={trimFormKeyboard.onKeyDown}
                        onSubmit={createTrim}
                      >
                        <div className="vehicle-builder-grid vehicle-builder-grid--4">
                          <TextField label="Trim name" value={trimName} onChange={(value) => {
                            const previousGeneratedCode = createVehicleCode(trimName);
                            if (!trimCode || trimCode === previousGeneratedCode) {
                              setTrimCode(createVehicleCode(value));
                            }
                            setTrimName(value);
                          }} required />
                          <TextField label="Equipment level" value={trimEquipmentLevel} onChange={setTrimEquipmentLevel} />
                          <YearSelectField
                            label="Applicable from year (optional)"
                            value={trimStartYear}
                            onChange={(value) => {
                              setTrimStartYear(value);
                              if (
                                trimEndYear &&
                                value &&
                                Number(trimEndYear) < Number(value)
                              ) {
                                setTrimEndYear('');
                              }
                            }}
                            min={selectedGeneration?.startYear ?? undefined}
                            max={selectedGeneration?.endYear ?? undefined}
                            placeholder="Not specified"
                            hint="Only store Trim dates when they are independently verified."
                          />
                          <YearSelectField
                            label="Applicable to year (optional)"
                            value={trimEndYear}
                            onChange={setTrimEndYear}
                            min={
                              optionalNumber(trimStartYear) ??
                              selectedGeneration?.startYear ??
                              undefined
                            }
                            max={selectedGeneration?.endYear ?? undefined}
                            placeholder="Not specified"
                            hint="Leave blank when Trim applicability is not verified."
                          />
                        </div>
                        <LikelyDuplicateWarning
                          match={trimDuplicate.match}
                          checking={trimDuplicate.checking}
                        />
                        <InlineActions
                          saving={saving === 'trim'}
                          saveLabel="Save trim"
                          onCancel={() => setTrimFormOpen(false)}
                        />
                      </form>
                    ) : null}
                  </>
                ) : <StepBlocked text="Select a generation before creating or selecting its trim." />}
              </div>
            </section>

            <section className={`vehicle-builder-step ${trimId ? 'vehicle-builder-step--active' : ''}`}>
              <StepNumber value="4" />
              <div className="vehicle-builder-step__body">
                <div className="vehicle-builder-step__heading">
                  <div>
                    <span>Final configured vehicle</span>
                    <h2>Select Engine and Transmission</h2>
                    <p>The selected Trim is the hierarchy anchor. Engine and Transmission complete the configured vehicle.</p>
                  </div>
                  <a className="button button--quiet" href="/admin/vehicles/configurations/masters">
                    Advanced masters
                  </a>
                </div>
                {selectedMake && selectedModel && selectedGeneration && selectedTrim ? (
                  <form className="vehicle-builder-configuration" onSubmit={createConfiguration}>
                    <div className="vehicle-builder-breadcrumb">
                      <span>{selectedMake.name}</span><b>›</b>
                      <span>{selectedModel.name}</span>
                      {selectedDerivative ? <><b>›</b><span>{selectedDerivative.name}</span></> : null}
                      {selectedGeneration ? <><b>›</b><span>{selectedGeneration.name}</span></> : null}
                      {selectedTrim ? <><b>›</b><span>{selectedTrim.name}</span></> : null}
                    </div>

                    <section className="vehicle-config-section">
                      <div className="vehicle-config-section__heading">
                        <div className="vehicle-config-section__title">
                          <span className="vehicle-config-section__index">1</span>
                          <div>
                            <strong>Technical specification</strong>
                            <small>
                              Choose the main technical identity first. Create a
                              missing master record only when needed.
                            </small>
                          </div>
                        </div>
                        <div className="vehicle-builder-step__actions">
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={saving !== null}
                            onClick={() => openTechnicalEditor('engine')}
                          >
                            + Add engine
                          </button>
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={saving !== null}
                            onClick={() => openTechnicalEditor('transmission')}
                          >
                            + Add transmission
                          </button>
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={saving !== null}
                            onClick={() => openTechnicalEditor('body-type')}
                          >
                            + Add body type
                          </button>
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={saving !== null}
                            onClick={() => openTechnicalEditor('market')}
                          >
                            + Add market
                          </button>
                        </div>
                      </div>

                      {technicalEditor ? (
                        <TechnicalMasterInlineEditor
                          editor={technicalEditor}
                          form={technicalForm}
                          setField={setTechnicalField}
                          saving={saving === 'technical'}
                          onSave={() => void createTechnicalMaster()}
                          onCancel={closeTechnicalEditor}
                        />
                      ) : null}

                      {technicalMasterError ? (
                        <div className="alert alert--error" role="alert">
                          {technicalMasterError}
                        </div>
                      ) : null}

                      <div className="vehicle-builder-grid vehicle-builder-grid--2 vehicle-config-technical-grid">
                        <SearchableSelectField
                          label="Engine"
                          value={engineId}
                          onChange={setEngineId}
                          onSearchChange={setEngineSearch}
                          options={technicalOptions.engines.map((item) => ({
                            id: item.id,
                            label: item.code
                              ? `${item.code} · ${engineTechnicalLabel(item)}`
                              : engineTechnicalLabel(item),
                          }))}
                          placeholder={
                            technicalMasterLoading
                              ? 'Loading engines…'
                              : technicalOptions.engines.length > 0
                                ? 'Select engine'
                                : 'Search or add an engine'
                          }
                          searchPlaceholder="Search code, family, fuel or engine name"
                        />
                        <SearchableSelectField
                          label="Transmission"
                          value={transmissionId}
                          onChange={setTransmissionId}
                          onSearchChange={setTransmissionSearch}
                          options={technicalOptions.transmissions.map((item) => ({
                            id: item.id,
                            label: transmissionTechnicalLabel(item),
                          }))}
                          placeholder={
                            technicalMasterLoading
                              ? 'Loading transmissions…'
                              : technicalOptions.transmissions.length > 0
                                ? 'Select transmission'
                                : 'Search or add a transmission'
                          }
                          searchPlaceholder="Search type, code or drive type"
                        />
                        <SelectField
                          label="Body type"
                          value={bodyTypeId}
                          onChange={setBodyTypeId}
                          options={bodyTypeOptions.map((item) => ({
                            id: item.id,
                            label: item.name,
                          }))}
                          placeholder="Unknown / not specified"
                        />
                        <SelectField
                          label="Market / region"
                          value={marketId}
                          onChange={setMarketId}
                          options={marketOptions.map((item) => ({
                            id: item.id,
                            label: item.name,
                          }))}
                          placeholder="Unknown / not specified"
                        />
                      </div>
                    </section>

                    <section className="vehicle-config-section">
                      <div className="vehicle-config-section__heading">
                        <div className="vehicle-config-section__title">
                          <span className="vehicle-config-section__index">2</span>
                          <div>
                            <strong>Production period</strong>
                            <small>
                              Enter years first. Months are optional when the
                              source gives more precise production dates.
                            </small>
                          </div>
                        </div>
                      </div>

                      <div className="vehicle-builder-period vehicle-builder-period--clean">
                        <div className="vehicle-builder-period__range">
                          <div className="vehicle-builder-period__group">
                            <span className="vehicle-builder-period__group-label">
                              Production starts
                            </span>
                            <div className="vehicle-builder-period__pair">
                              <YearSelectField
                                label="From year"
                                value={productionStartYear}
                                onChange={setProductionStartYear}
                                min={selectedYearBounds?.min}
                                max={selectedYearBounds?.max ?? undefined}
                                placeholder="Select start year"
                                hint="Authoritative start of this exact configuration."
                              />
                              <MonthSelectField
                                label="Month (optional)"
                                value={productionStartMonth}
                                onChange={setProductionStartMonth}
                              />
                            </div>
                          </div>

                          <div className="vehicle-builder-period__arrow" aria-hidden="true">
                            →
                          </div>

                          <div className="vehicle-builder-period__group">
                            <span className="vehicle-builder-period__group-label">
                              Production ends
                            </span>
                            <div className="vehicle-builder-period__pair">
                              <ProductionEndYearField
                                label="To year"
                                value={
                                  productionEndStatus === 'CURRENT'
                                    ? 'CURRENT'
                                    : productionEndStatus === 'UNKNOWN'
                                      ? 'UNKNOWN'
                                      : productionEndYear
                                }
                                onChange={(value) => {
                                  if (value === 'CURRENT') {
                                    setProductionEndStatus('CURRENT');
                                    setProductionEndYear('');
                                    setProductionEndMonth('');
                                    return;
                                  }
                                  if (value === 'UNKNOWN') {
                                    setProductionEndStatus('UNKNOWN');
                                    setProductionEndYear('');
                                    setProductionEndMonth('');
                                    return;
                                  }
                                  setProductionEndStatus('ENDED');
                                  setProductionEndYear(value);
                                }}
                                min={
                                  optionalNumber(productionStartYear) ??
                                  selectedYearBounds?.min
                                }
                                max={selectedYearBounds?.max ?? undefined}
                                allowCurrent={configurationCanBeCurrent}
                                hint={
                                  configurationCanBeCurrent
                                    ? 'Choose an end year, Present, or End not verified.'
                                    : 'Present is unavailable because the selected Generation/Trim is not explicitly current.'
                                }
                              />
                              <MonthSelectField
                                label="Month (optional)"
                                value={productionEndMonth}
                                onChange={setProductionEndMonth}
                                disabled={
                                  productionEndStatus !== 'ENDED' ||
                                  !productionEndYear
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="vehicle-builder-period__examples">
                          Examples: <strong>2005 → 2007</strong>,{' '}
                          <strong>03 / 2005 → 08 / 2007</strong>, or{' '}
                          <strong>2023 → Present</strong>.
                        </div>
                      </div>
                    </section>

                    <section className="vehicle-config-section">
                      <div className="vehicle-config-section__heading">
                        <div className="vehicle-config-section__title">
                          <span className="vehicle-config-section__index">3</span>
                          <div>
                            <strong>Vehicle details</strong>
                            <small>
                              Add only the remaining identity details needed for
                              this configured vehicle.
                            </small>
                          </div>
                        </div>
                      </div>

                      <div className="vehicle-builder-grid vehicle-config-details-grid">
                        <YearSelectField
                          label="Exact model year (optional)"
                          value={modelYear}
                          onChange={setModelYear}
                          min={selectedYearBounds?.min}
                          max={selectedYearBounds?.max ?? undefined}
                          placeholder="Not specified"
                          hint="Use only when the source explicitly identifies a model-year designation."
                        />
                        <label className="field">
                          <span className="field__label">Steering side</span>
                          <select
                            className="category-form__select"
                            value={steeringSide}
                            onChange={(event) =>
                              setSteeringSide(
                                event.target.value as VehicleSteeringSide | '',
                              )
                            }
                          >
                            <option value="">Unknown / not specified</option>
                            <option value="LHD">Left-hand drive (LHD)</option>
                            <option value="RHD">Right-hand drive (RHD)</option>
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="vehicle-config-review">
                      <div className="vehicle-config-section__heading">
                        <div className="vehicle-config-section__title">
                          <span className="vehicle-config-section__index">4</span>
                          <div>
                            <strong>Review and save</strong>
                            <small>
                              Confirm the generated identity, then save the
                              configured vehicle.
                            </small>
                          </div>
                        </div>
                      </div>

                      <div className="vehicle-builder-code">
                        <span>Configured vehicle type code</span>
                        <strong>
                          {suggestedConfigurationCode ||
                            'Select Engine and Transmission to generate the code'}
                        </strong>
                        <small>
                          Generated automatically from the canonical identity,
                          technical specification, market and steering side. It is
                          locked to prevent accidental code drift.
                        </small>
                      </div>

                      <LikelyDuplicateWarning
                        match={configurationDuplicate.match}
                        checking={configurationDuplicate.checking}
                      />

                      <div className="vehicle-builder__source-note">
                        Generation years describe the broad generation period. Trim
                        years are optional and should be entered only when verified.
                        Configuration production applicability is authoritative;
                        exact model year is optional and never replaces the production
                        period. Every configuration period must stay inside its
                        Generation and, when present, Trim applicability.
                        {technicalOptions.relatedConfigurationCount > 0
                          ? ` ${technicalOptions.relatedConfigurationCount} saved configuration(s) under this selection are being used to filter technical choices.`
                          : ''}
                      </div>

                      <div className="vehicle-config-review__actions">
                        <span className="vehicle-config-review__hint">
                          Required to save: Trim, Engine and Transmission.
                        </span>
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={
                            saving !== null ||
                            !suggestedConfigurationCode ||
                            !trimId ||
                            !engineId ||
                            !transmissionId
                          }
                        >
                          {saving === 'configuration'
                            ? 'Saving…'
                            : 'Save configured vehicle'}
                        </button>
                      </div>
                    </section>
                  </form>
                ) : <StepBlocked text="Complete Make → Model → [optional Derivative] → Generation → Trim first." />}
              </div>
            </section>
          </div>

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
                    setLibrarySortDirection(
                      event.target.value as SortDirection,
                    );
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

            {libraryLifecycleNotice ? (
              <div className="alert alert--success" role="status">
                {libraryLifecycleNotice}
              </div>
            ) : null}

            {libraryLifecycleError ? (
              <div className="alert alert--error" role="alert">
                {libraryLifecycleError}
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
              </div>
            ) : null}

            {!libraryLoading &&
            !libraryError &&
            libraryPage.items.length === 0 ? (
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
                                                    {trimGroup.configurations.length}{' '}
                                                    {trimGroup.configurations.length === 1
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
        </>
      )}
    </section>
  );
}

function StepNumber({ value }: { value: string }) {
  return <span className="vehicle-builder-step__number">{value}</span>;
}

function StepBlocked({ text }: { text: string }) {
  return <div className="vehicle-builder-step__blocked">{text}</div>;
}

function IdentitySummary({ title, meta }: { title: string; meta: string }) {
  return <div className="vehicle-builder-identity"><strong>{title}</strong><span>{meta}</span></div>;
}

function TechnicalMasterInlineEditor({
  editor,
  form,
  setField,
  saving,
  onSave,
  onCancel,
}: {
  editor: Exclude<TechnicalMasterEditor, null>;
  form: Record<string, string>;
  setField: (name: string, value: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const canSave =
    editor === 'engine'
      ? Boolean(form.name?.trim())
      : editor === 'transmission'
        ? Boolean(form.transmissionType?.trim())
        : Boolean(form.name?.trim() && form.code?.trim());

  const duplicateResource =
    editor === 'engine'
      ? 'engines'
      : editor === 'transmission'
        ? 'transmissions'
        : editor === 'body-type'
          ? 'body-types'
          : 'markets';
  const duplicateName =
    editor === 'transmission'
      ? (form.transmissionType ?? '')
      : (form.name ?? '');
  const duplicate = useLikelyDuplicate({
    name: duplicateName,
    code: form.code,
    searchUrl: `/api/admin/vehicles/master/${duplicateResource}/page`,
  });
  const keyboard = useAdminInlineFormKeyboard<HTMLDivElement>({
    open: true,
    saving,
    focusKey: editor,
    onEscape: onCancel,
  });

  function updateGeneratedCode(sourceName: string, value: string) {
    const previousSource = form[sourceName] ?? '';
    const previousGenerated = createVehicleCode(previousSource);
    const nextGenerated = createVehicleCode(value);
    if (!form.code || form.code === previousGenerated) {
      setField('code', nextGenerated);
    }
    setField(sourceName, value);
  }

  return (
    <div
      className="vehicle-builder-inline-form"
      ref={keyboard.ref}
      onKeyDown={(event) => {
        keyboard.onKeyDown(event);
        if (event.defaultPrevented || event.key !== 'Enter') return;
        event.preventDefault();
        event.stopPropagation();
        if (!saving && canSave) onSave();
      }}
    >
      <div className="category-form__heading">
        <div>
          <span className="eyebrow">Quick add technical master</span>
          <h3>
            {editor === 'engine'
              ? 'Engine'
              : editor === 'transmission'
                ? 'Transmission'
                : editor === 'body-type'
                  ? 'Body type'
                  : 'Market / region'}
          </h3>
        </div>
      </div>

      <LikelyDuplicateWarning
        match={duplicate.match}
        checking={duplicate.checking}
      />

      {editor === 'engine' ? (
        <div className="vehicle-builder-grid vehicle-builder-grid--4">
          <TextField
            label="Engine name"
            value={form.name ?? ''}
            onChange={(value) => updateGeneratedCode('name', value)}
            required
          />
          <TextField
            label="Engine family"
            value={form.family ?? ''}
            onChange={(value) => setField('family', value)}
          />
          <TechnicalNumberField
            label="Displacement (cc)"
            value={form.displacementCc ?? ''}
            onChange={(value) => setField('displacementCc', value)}
          />
          <TextField
            label="Fuel type"
            value={form.fuelType ?? ''}
            onChange={(value) => setField('fuelType', value)}
          />
          <TechnicalNumberField
            label="Cylinder count"
            value={form.cylinderCount ?? ''}
            onChange={(value) => setField('cylinderCount', value)}
          />
          <TextField
            label="Aspiration"
            value={form.aspiration ?? ''}
            onChange={(value) => setField('aspiration', value)}
          />
          <TechnicalNumberField
            label="Power (kW)"
            value={form.powerKw ?? ''}
            onChange={(value) => setField('powerKw', value)}
          />
          <TechnicalNumberField
            label="Torque (Nm)"
            value={form.torqueNm ?? ''}
            onChange={(value) => setField('torqueNm', value)}
          />
          <NumberField
            label="Applicable start year"
            value={form.startYear ?? ''}
            onChange={(value) => setField('startYear', value)}
          />
          <NumberField
            label="Applicable end year"
            value={form.endYear ?? ''}
            onChange={(value) => setField('endYear', value)}
          />
        </div>
      ) : editor === 'transmission' ? (
        <div className="vehicle-builder-grid vehicle-builder-grid--4">
          <TextField
            label="Transmission type"
            value={form.transmissionType ?? ''}
            onChange={(value) => updateGeneratedCode('transmissionType', value)}
            required
          />
          <TechnicalNumberField
            label="Gear count"
            value={form.gearCount ?? ''}
            onChange={(value) => setField('gearCount', value)}
          />
          <TextField
            label="Drive type"
            value={form.driveType ?? ''}
            onChange={(value) => setField('driveType', value)}
          />
          <NumberField
            label="Applicable start year"
            value={form.startYear ?? ''}
            onChange={(value) => setField('startYear', value)}
          />
          <NumberField
            label="Applicable end year"
            value={form.endYear ?? ''}
            onChange={(value) => setField('endYear', value)}
          />
        </div>
      ) : (
        <div className="vehicle-builder-grid">
          <TextField
            label={editor === 'body-type' ? 'Body type name' : 'Market / region name'}
            value={form.name ?? ''}
            onChange={(value) => updateGeneratedCode('name', value)}
            required
          />
        </div>
      )}

      <div className="vehicle-builder__source-note">
        Quick-added master records are saved as Draft with generated internal
        codes. Use Advanced masters for lifecycle activation, code maintenance,
        and advanced corrections.
      </div>
      <div className="vehicle-builder-inline-form__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={saving || !canSave}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Create and select'}
        </button>
        <button
          className="button button--quiet"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SearchableSelectField({
  label,
  value,
  onChange,
  onSearchChange,
  options,
  placeholder,
  searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const controlId = useId();

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <AdminSearchableCombobox
        id={`vehicle-builder-remote-${controlId}`}
        value={value}
        options={[
          { id: '', label: placeholder },
          ...options,
        ]}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        onChange={onChange}
        onSearchChange={onSearchChange}
      />
    </div>
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
      <span className="field__label">{label}</span>
      <AdminSearchableCombobox
        id={`vehicle-builder-${controlId}`}
        value={value}
        options={[
          { id: '', label: placeholder },
          ...options,
        ]}
        placeholder={placeholder}
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function YearSelectField({
  label,
  value,
  onChange,
  min = 1886,
  max,
  placeholder,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder: string;
  hint?: string;
  disabled?: boolean;
}) {
  const effectiveMax = Math.max(
    min,
    max ?? new Date().getFullYear() + 1,
  );
  const years = Array.from(
    { length: effectiveMax - min + 1 },
    (_, index) => effectiveMax - index,
  );

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="category-form__select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {years.map((year) => (
          <option value={String(year)} key={year}>
            {year}
          </option>
        ))}
      </select>
      {hint ? <small className="field__hint">{hint}</small> : null}
    </label>
  );
}

function ProductionEndYearField({
  label = 'Production to',
  value,
  onChange,
  min = 1886,
  max,
  allowCurrent = false,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  allowCurrent?: boolean;
  hint?: string;
}) {
  const effectiveMax = Math.max(
    min,
    max ?? new Date().getFullYear() + 1,
  );
  const years = Array.from(
    { length: effectiveMax - min + 1 },
    (_, index) => effectiveMax - index,
  );

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="category-form__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="UNKNOWN">End not verified</option>
        {allowCurrent ? (
          <option value="CURRENT">Present / still produced</option>
        ) : null}
        {years.map((year) => (
          <option value={String(year)} key={year}>
            {year}
          </option>
        ))}
      </select>
      {hint ? <small className="field__hint">{hint}</small> : null}
    </label>
  );
}

function MonthSelectField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const months = [
    ['1', 'January'],
    ['2', 'February'],
    ['3', 'March'],
    ['4', 'April'],
    ['5', 'May'],
    ['6', 'June'],
    ['7', 'July'],
    ['8', 'August'],
    ['9', 'September'],
    ['10', 'October'],
    ['11', 'November'],
    ['12', 'December'],
  ] as const;

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select
        className="category-form__select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not specified</option>
        {months.map(([month, name]) => (
          <option value={month} key={month}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 1886,
  max = 2200,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <small className="field__hint">{hint}</small> : null}
    </label>
  );
}

function TechnicalNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StatusField({
  value,
  onChange,
  activeDisabled = false,
}: {
  value: MasterDataStatus;
  onChange: (value: MasterDataStatus) => void;
  activeDisabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field__label">Status</span>
      <select
        className="category-form__select"
        value={value}
        onChange={(event) => onChange(event.target.value as MasterDataStatus)}
      >
        <option value="DRAFT">Draft</option>
        <option value="ACTIVE" disabled={activeDisabled}>
          Active
        </option>
        <option value="INACTIVE">Inactive</option>
        <option value="ARCHIVED">Archived</option>
      </select>
    </label>
  );
}

function InlineActions({
  saving,
  saveLabel,
  onCancel,
}: {
  saving: boolean;
  saveLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="vehicle-builder-inline-form__actions">
      <button className="button button--primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : saveLabel}
      </button>
      <button className="button button--quiet" type="button" disabled={saving} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

async function fetchVehicleValidation(
  configurationId: string,
): Promise<VehicleConfigurationActivationValidation> {
  const response = await fetch(
    `/api/admin/vehicles/master/configurations/${configurationId}/validate-activation`,
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
        `Configured vehicle validation failed: ${response.status}`,
    );
  }

  return (await response.json()) as VehicleConfigurationActivationValidation;
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

function optionalNumber(value: string): number | undefined {
  return value.trim() ? Number(value) : undefined;
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

async function fetchVehiclePage<T>(
  path: string,
): Promise<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Vehicle request failed: ${response.status}`);
  }
  return (await response.json()) as {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

async function fetchVehicleRecord<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Vehicle request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function mergeRecords<T extends { id: string }>(
  items: T[],
  extras: T[],
): T[] {
  const merged = new Map(items.map((item) => [item.id, item]));
  for (const item of extras) merged.set(item.id, item);
  return [...merged.values()];
}

function includeRecord<T extends { id: string }>(
  items: T[],
  record: T | null,
): T[] {
  if (!record || items.some((item) => item.id === record.id)) return items;
  return [...items, record];
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

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim() ?? '';
  return normalized || undefined;
}

function generationYearRange(
  generation: VehicleGenerationRecord,
): string {
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

function messageFor(error: unknown, fallback: string): string {
  return error instanceof ClientApiError ? error.message : fallback;
}

function configurationVinReadiness(
  item: VehicleConfigurationRecord,
): string {
  const missing = [
    !item.modelYear && !item.productionStartYear ? 'year identity' : null,
    !item.bodyTypeId ? 'body type' : null,
    !item.marketId ? 'market' : null,
    !item.steeringSide ? 'steering side' : null,
  ].filter((value): value is string => Boolean(value));

  return missing.length === 0
    ? 'VIN matching detail: complete'
    : `VIN matching detail: add ${missing.join(', ')} for higher precision`;
}

function configurationDescription(item: VehicleConfigurationRecord, data: DataState): string {
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
