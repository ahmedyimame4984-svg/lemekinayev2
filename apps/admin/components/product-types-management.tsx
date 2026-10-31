'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import type {
  CategoryRecord,
  CreateCategoryInput,
  CreateExternalStandardMappingInput,
  CreateMasterDataLocalizationInput,
  CreateProductFamilyInput,
  CreateProductTypeInput,
  ExternalStandardMappingRecord,
  MasterDataLocalizationRecord,
  MasterDataStatus,
  ProductFamilyRecord,
  ProductTypeCsvImportCommitResponse,
  ProductTypeCsvImportPreviewResponse,
  ProductTypePage,
  ProductTypeRecord,
  UpdateExternalStandardMappingInput,
  UpdateMasterDataLocalizationInput,
} from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { AdminSavedViewsToolbar } from './admin-saved-views-toolbar';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import {
  AdminLibraryPagination,
  normalizeAdminPageSize,
  type AdminPageSize,
} from './admin-library-shell';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { useAdminPrincipal } from './admin-session';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { ProductTypeTechnicalAttributes } from './product-type-technical-attributes';
import { ProductTypeImageLimits } from './product-type-image-limits';
import {
  DEFAULT_PRODUCT_TYPE_REQUIREMENTS,
  ProductTypeRequirementFields,
  type ProductTypeRequirementValues,
} from './product-type-requirement-fields';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import { useAdminOverlayKeyboard } from '@/lib/use-admin-overlay-keyboard';

type CreateMode = 'category' | 'family' | 'product-type' | null;
type FilterStatus = 'ALL' | MasterDataStatus;
type ProductTypeLibrarySortBy =
  | 'SORT_ORDER'
  | 'NAME'
  | 'CODE'
  | 'STATUS'
  | 'UPDATED_AT'
  | 'CREATED_AT';
type SortDirection = 'ASC' | 'DESC';

const PRODUCT_TYPE_SAVED_VIEW_SCOPE = 'CATALOG_PRODUCT_TYPES';
const productTypeSortOptions: Array<{
  value: ProductTypeLibrarySortBy;
  label: string;
}> = [
  { value: 'SORT_ORDER', label: 'Configured order' },
  { value: 'NAME', label: 'Name' },
  { value: 'CODE', label: 'Code' },
  { value: 'STATUS', label: 'Status' },
  { value: 'UPDATED_AT', label: 'Updated time' },
  { value: 'CREATED_AT', label: 'Created date' },
];

export function ProductTypesManagement({
  initialCategoryId = '',
  initialProductFamilyId = '',
  initialProductTypeId = '',
  startCreate = false,
}: {
  initialCategoryId?: string;
  initialProductFamilyId?: string;
  initialProductTypeId?: string;
  startCreate?: boolean;
}) {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [families, setFamilies] = useState<ProductFamilyRecord[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeRecord[]>([]);
  // Only the latest Part Group request may replace the selected Product Type.
  const familyProductTypeRequestRef = useRef(0);

  const [categoryId, setCategoryId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [unsavedAttributeChanges, setUnsavedAttributeChanges] = useState(0);
  const [publicationFocusProductTypeId, setPublicationFocusProductTypeId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createRequirements, setCreateRequirements] =
    useState<ProductTypeRequirementValues>({
      ...DEFAULT_PRODUCT_TYPE_REQUIREMENTS,
    });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryStatus, setLibraryStatus] = useState<FilterStatus>('ALL');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState('');
  const [libraryFamilyFilter, setLibraryFamilyFilter] = useState('');
  const [librarySortBy, setLibrarySortBy] =
    useState<ProductTypeLibrarySortBy>('SORT_ORDER');
  const [librarySortDirection, setLibrarySortDirection] =
    useState<SortDirection>('ASC');
  const [savedViews, setSavedViews] = useState<AdminSavedViewRecord[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewSaving, setSavedViewSaving] = useState(false);
  const [savedViewError, setSavedViewError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importCsv, setImportCsv] = useState('');
  const [importPreview, setImportPreview] =
    useState<ProductTypeCsvImportPreviewResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [mappingTarget, setMappingTarget] = useState<ProductTypeRecord | null>(null);
  const [externalMappings, setExternalMappings] = useState<
    ExternalStandardMappingRecord[]
  >([]);
  const [editingMapping, setEditingMapping] =
    useState<ExternalStandardMappingRecord | null>(null);
  const [mappingForm, setMappingForm] = useState<Record<string, string>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const [localizationTarget, setLocalizationTarget] =
    useState<ProductTypeRecord | null>(null);
  const [localizations, setLocalizations] = useState<
    MasterDataLocalizationRecord[]
  >([]);
  const [editingLocalization, setEditingLocalization] =
    useState<MasterDataLocalizationRecord | null>(null);
  const [localizationForm, setLocalizationForm] =
    useState<Record<string, string>>({});
  const [localizationLoading, setLocalizationLoading] = useState(false);
  const [localizationSaving, setLocalizationSaving] = useState(false);
  const [localizationError, setLocalizationError] = useState('');
  const [libraryPageNumber, setLibraryPageNumber] = useState(1);
  const [libraryPageSize, setLibraryPageSize] = useState<AdminPageSize>(50);
  const [libraryReloadKey, setLibraryReloadKey] = useState(0);
  const [libraryData, setLibraryData] = useState<ProductTypePage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    pageCount: 0,
  });
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');

  const createFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: Boolean(createMode),
    saving: createSaving,
    focusKey: createMode,
    onEscape: resetCreate,
  });
  const mappingDrawerRef = useAdminOverlayKeyboard<HTMLElement>({
    open: Boolean(mappingTarget),
    closeDisabled: mappingSaving,
    onClose: closeMappings,
  });
  const localizationDrawerRef = useAdminOverlayKeyboard<HTMLElement>({
    open: Boolean(localizationTarget),
    closeDisabled: localizationSaving,
    onClose: closeLocalizations,
  });


  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [categoryResponse, familyResponse, requestedProductTypeResponse] =
          await Promise.all([
            fetch('/api/admin/catalog/categories', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
            fetch('/api/admin/catalog/product-families', {
              credentials: 'same-origin',
              cache: 'no-store',
            }),
            initialProductTypeId
              ? fetch(`/api/admin/catalog/product-types/${initialProductTypeId}`, {
                  credentials: 'same-origin',
                  cache: 'no-store',
                })
              : Promise.resolve(null),
          ]);

        if (
          !categoryResponse.ok ||
          !familyResponse.ok ||
          (requestedProductTypeResponse && !requestedProductTypeResponse.ok)
        ) {
          throw new Error('Could not load Product Types');
        }

        const [categoryData, familyData] = await Promise.all([
          categoryResponse.json() as Promise<CategoryRecord[]>,
          familyResponse.json() as Promise<ProductFamilyRecord[]>,
        ]);
        const requestedProductType = requestedProductTypeResponse
          ? ((await requestedProductTypeResponse.json()) as ProductTypeRecord)
          : undefined;

        if (!active) return;

        const rootCategories = categoryData
          .filter((category) => category.parentId === null)
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          );

        const requestedFamily =
          familyData.find((item) => item.id === initialProductFamilyId) ??
          (requestedProductType?.productFamilyId
            ? familyData.find(
                (item) => item.id === requestedProductType.productFamilyId,
              )
            : undefined);
        const requestedCategory =
          categoryData.find((item) => item.id === initialCategoryId) ??
          (requestedFamily
            ? categoryData.find(
                (item) => item.id === requestedFamily.categoryId,
              )
            : undefined) ??
          (requestedProductType
            ? categoryData.find(
                (item) => item.id === requestedProductType.categoryId,
              )
            : undefined) ??
          rootCategories[0] ??
          null;

        const nextCategoryId = requestedCategory?.id ?? '';
        const nextFamilies = familyData
          .filter((family) => family.categoryId === nextCategoryId)
          .sort((a, b) => a.name.localeCompare(b.name));
        const nextFamily =
          nextFamilies.find((family) => family.id === requestedFamily?.id) ??
          nextFamilies[0] ??
          null;

        let nextProductTypes: ProductTypeRecord[] = [];
        if (nextFamily) {
          const productTypeResponse = await fetch(
            `/api/admin/catalog/product-types?productFamilyId=${nextFamily.id}`,
            {
              credentials: 'same-origin',
              cache: 'no-store',
            },
          );
          if (!productTypeResponse.ok) {
            throw new Error('Could not load Product Types');
          }
          nextProductTypes =
            (await productTypeResponse.json()) as ProductTypeRecord[];
        }

        if (!active) return;

        const nextProductType =
          nextProductTypes.find(
            (item) => item.id === requestedProductType?.id,
          ) ??
          nextProductTypes[0] ??
          null;

        setCategories(categoryData);
        setFamilies(familyData);
        setProductTypes(nextProductTypes);
        setCategoryId(nextCategoryId);
        setFamilyId(nextFamily?.id ?? '');
        setProductTypeId(nextProductType?.id ?? '');

        if (startCreate && nextFamily) {
          openCreate('product-type');
        }
      } catch {
        if (active) {
          setError(
            'Product Types could not be loaded. Check the API and database.',
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
    initialCategoryId,
    initialProductFamilyId,
    initialProductTypeId,
    startCreate,
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
          `/api/admin/preferences/saved-views?scope=${PRODUCT_TYPE_SAVED_VIEW_SCOPE}`,
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
            'Saved views could not be loaded. Product Types are still available.',
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
        if (libraryStatus !== 'ALL') query.set('status', libraryStatus);
        if (libraryCategoryFilter) {
          query.set('categoryId', libraryCategoryFilter);
        }
        if (libraryFamilyFilter) {
          query.set('productFamilyId', libraryFamilyFilter);
        }
        query.set('sortBy', librarySortBy);
        query.set('sortDirection', librarySortDirection);

        const response = await fetch(
          `/api/admin/catalog/product-types/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          throw new Error('Could not load Product Types library');
        }

        const page = (await response.json()) as ProductTypePage;
        if (!active) return;

        setLibraryData(page);
        if (page.pageCount > 0 && libraryPageNumber > page.pageCount) {
          setLibraryPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setLibraryError(
            'The Product Types library could not be loaded. Change the filters or retry.',
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
    libraryCategoryFilter,
    libraryFamilyFilter,
    libraryPageNumber,
    libraryPageSize,
    libraryReloadKey,
    librarySearch,
    librarySortBy,
    librarySortDirection,
    libraryStatus,
  ]);

  const rootCategories = useMemo(
    () =>
      categories
        .filter((category) => category.parentId === null)
        .slice()
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
    [categories],
  );

  const categoryFamilies = useMemo(
    () =>
      families
        .filter((family) => family.categoryId === categoryId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [families, categoryId],
  );

  const familyProductTypes = useMemo(
    () =>
      productTypes
        .filter((item) => item.productFamilyId === familyId)
        .slice()
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
    [productTypes, familyId],
  );

  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? null;
  const selectedFamily =
    families.find((family) => family.id === familyId) ?? null;
  const libraryFilterFamilies = useMemo(
    () =>
      families
        .filter(
          (family) =>
            !libraryCategoryFilter ||
            family.categoryId === libraryCategoryFilter,
        )
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [families, libraryCategoryFilter],
  );

  const libraryHasActiveFilters = Boolean(
    librarySearch.trim() ||
    libraryStatus !== 'ALL' ||
    libraryCategoryFilter ||
    libraryFamilyFilter,
  );

  const selectedProductType =
    productTypes.find((item) => item.id === productTypeId) ?? null;

  const createDuplicateSearchUrl = useMemo(() => {
    if (createMode === 'category') {
      return '/api/admin/catalog/categories/page?rootOnly=true';
    }
    if (createMode === 'family' && categoryId) {
      return `/api/admin/catalog/product-families/page?categoryId=${categoryId}`;
    }
    if (createMode === 'product-type' && categoryId && familyId) {
      return `/api/admin/catalog/product-types/page?categoryId=${categoryId}&productFamilyId=${familyId}`;
    }
    return '';
  }, [categoryId, createMode, familyId]);

  const createDuplicate = useLikelyDuplicate({
    enabled: Boolean(createMode && createDuplicateSearchUrl),
    name: createName,
    code: createCode(createName),
    searchUrl: createDuplicateSearchUrl,
  });

  const libraryCategoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const libraryFamilyById = useMemo(
    () => new Map(families.map((family) => [family.id, family])),
    [families],
  );

  const importPreviewRows = useMemo(() => {
    if (!importPreview) return [];
    const invalid = importPreview.rows.filter((row) => row.errors.length > 0);
    const valid = importPreview.rows.filter((row) => row.errors.length === 0);
    return [...invalid, ...valid].slice(0, 50);
  }, [importPreview]);

  function resetLocalizationForm(record?: MasterDataLocalizationRecord | null) {
    setEditingLocalization(record ?? null);
    setLocalizationForm(
      record
        ? {
            locale: record.locale,
            name: record.name,
            description: record.description ?? '',
          }
        : {
            locale: '',
            name: '',
            description: '',
          },
    );
    setLocalizationError('');
  }

  async function loadLocalizations(productTypeId: string) {
    setLocalizationLoading(true);
    setLocalizationError('');
    try {
      const response = await fetch(
        '/api/admin/catalog/product-types/' +
          productTypeId +
          '/localizations',
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Could not load localized content');
      const records = (await response.json()) as MasterDataLocalizationRecord[];
      setLocalizations(records);
    } catch {
      setLocalizationError(
        'Localized content could not be loaded. Reload and try again.',
      );
    } finally {
      setLocalizationLoading(false);
    }
  }

  async function openLocalizations(productType: ProductTypeRecord) {
    setLocalizationTarget(productType);
    setLocalizations([]);
    resetLocalizationForm();
    await loadLocalizations(productType.id);
  }

  function closeLocalizations() {
    if (localizationSaving) return;
    setLocalizationTarget(null);
    setLocalizations([]);
    resetLocalizationForm();
  }

  async function saveLocalization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!localizationTarget) return;

    const locale = localizationForm.locale?.trim();
    const name = localizationForm.name?.trim();
    if (!locale || !name) {
      setLocalizationError('Locale and localized name are required.');
      return;
    }

    setLocalizationSaving(true);
    setLocalizationError('');
    try {
      if (editingLocalization) {
        await patchJson<MasterDataLocalizationRecord>(
          '/api/admin/catalog/product-types/' +
            localizationTarget.id +
            '/localizations/' +
            editingLocalization.id,
          {
            version: editingLocalization.version,
            name,
            description: localizationForm.description?.trim() || null,
          } satisfies UpdateMasterDataLocalizationInput,
        );
      } else {
        await postJson<MasterDataLocalizationRecord>(
          '/api/admin/catalog/product-types/' +
            localizationTarget.id +
            '/localizations',
          {
            locale,
            name,
            description: localizationForm.description?.trim() || undefined,
          } satisfies CreateMasterDataLocalizationInput,
        );
      }
      await loadLocalizations(localizationTarget.id);
      resetLocalizationForm();
      localizationDrawerRef.markPristine();
    } catch (error) {
      setLocalizationError(
        error instanceof ClientApiError
          ? error.message
          : 'Localized content could not be saved.',
      );
    } finally {
      setLocalizationSaving(false);
    }
  }

  async function removeLocalization() {
    if (!localizationTarget || !editingLocalization) return;
    setLocalizationSaving(true);
    setLocalizationError('');
    try {
      const response = await fetch(
        '/api/admin/catalog/product-types/' +
          localizationTarget.id +
          '/localizations/' +
          editingLocalization.id,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: editingLocalization.version }),
        },
      );
      if (!response.ok) {
        let message = 'Localized content could not be removed.';
        try {
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          message = payload.error?.message ?? message;
        } catch {
          // Keep the bounded fallback.
        }
        throw new Error(message);
      }
      await loadLocalizations(localizationTarget.id);
      resetLocalizationForm();
    } catch (error) {
      setLocalizationError(
        error instanceof Error
          ? error.message
          : 'Localized content could not be removed.',
      );
    } finally {
      setLocalizationSaving(false);
    }
  }

  function resetMappingForm(record?: ExternalStandardMappingRecord | null) {
    setEditingMapping(record ?? null);
    setMappingForm(
      record
        ? {
            provider: record.provider,
            standard: record.standard,
            externalEntityType: record.externalEntityType,
            externalIdentifier: record.externalIdentifier,
            externalVersion: record.externalVersion ?? '',
            notes: record.notes ?? '',
          }
        : {
            provider: '',
            standard: '',
            externalEntityType: '',
            externalIdentifier: '',
            externalVersion: '',
            notes: '',
          },
    );
    setMappingError('');
  }

  async function loadExternalMappings(productTypeId: string) {
    setMappingLoading(true);
    setMappingError('');
    try {
      const response = await fetch(
        '/api/admin/catalog/product-types/' +
          productTypeId +
          '/external-mappings',
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Could not load external mappings');
      const records = (await response.json()) as ExternalStandardMappingRecord[];
      setExternalMappings(records);
    } catch {
      setMappingError(
        'External mappings could not be loaded. Reload and try again.',
      );
    } finally {
      setMappingLoading(false);
    }
  }

  async function openMappings(productType: ProductTypeRecord) {
    setMappingTarget(productType);
    setExternalMappings([]);
    resetMappingForm();
    await loadExternalMappings(productType.id);
  }

  function closeMappings() {
    if (mappingSaving) return;
    setMappingTarget(null);
    setExternalMappings([]);
    resetMappingForm();
  }

  async function saveExternalMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mappingTarget) return;

    const provider = mappingForm.provider?.trim();
    const standard = mappingForm.standard?.trim();
    const externalEntityType = mappingForm.externalEntityType?.trim();
    const externalIdentifier = mappingForm.externalIdentifier?.trim();
    if (!provider || !standard || !externalEntityType || !externalIdentifier) {
      setMappingError(
        'Provider, standard, external entity type and external identifier are required.',
      );
      return;
    }

    setMappingSaving(true);
    setMappingError('');
    try {
      if (editingMapping) {
        await patchJson<ExternalStandardMappingRecord>(
          '/api/admin/catalog/product-types/' +
            mappingTarget.id +
            '/external-mappings/' +
            editingMapping.id,
          {
            version: editingMapping.version,
            provider,
            standard,
            externalEntityType,
            externalIdentifier,
            externalVersion: mappingForm.externalVersion?.trim() || null,
            notes: mappingForm.notes?.trim() || null,
          } satisfies UpdateExternalStandardMappingInput,
        );
      } else {
        await postJson<ExternalStandardMappingRecord>(
          '/api/admin/catalog/product-types/' +
            mappingTarget.id +
            '/external-mappings',
          {
            provider,
            standard,
            externalEntityType,
            externalIdentifier,
            externalVersion: mappingForm.externalVersion?.trim() || undefined,
            notes: mappingForm.notes?.trim() || undefined,
          } satisfies CreateExternalStandardMappingInput,
        );
      }
      await loadExternalMappings(mappingTarget.id);
      resetMappingForm();
      mappingDrawerRef.markPristine();
    } catch (error) {
      setMappingError(
        error instanceof ClientApiError
          ? error.message
          : 'The external mapping could not be saved.',
      );
    } finally {
      setMappingSaving(false);
    }
  }

  async function removeExternalMapping() {
    if (!mappingTarget || !editingMapping) return;
    setMappingSaving(true);
    setMappingError('');
    try {
      const response = await fetch(
        '/api/admin/catalog/product-types/' +
          mappingTarget.id +
          '/external-mappings/' +
          editingMapping.id,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: editingMapping.version }),
        },
      );
      if (!response.ok) {
        let message = 'The external mapping could not be removed.';
        try {
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          message = payload.error?.message ?? message;
        } catch {
          // Keep the bounded fallback message.
        }
        throw new Error(message);
      }
      await loadExternalMappings(mappingTarget.id);
      resetMappingForm();
    } catch (error) {
      setMappingError(
        error instanceof Error
          ? error.message
          : 'The external mapping could not be removed.',
      );
    } finally {
      setMappingSaving(false);
    }
  }

  function currentLibraryQuery(): URLSearchParams {
    const query = new URLSearchParams();
    const searchValue = librarySearch.trim();
    if (searchValue) query.set('search', searchValue);
    if (libraryStatus !== 'ALL') query.set('status', libraryStatus);
    if (libraryCategoryFilter) query.set('categoryId', libraryCategoryFilter);
    if (libraryFamilyFilter) {
      query.set('productFamilyId', libraryFamilyFilter);
    }
    query.set('sortBy', librarySortBy);
    query.set('sortDirection', librarySortDirection);
    return query;
  }

  async function exportProductTypeCsv() {
    setExportBusy(true);
    setImportError('');
    try {
      const query = currentLibraryQuery();
      const response = await fetch(
        `/api/admin/catalog/product-types/export?${query.toString()}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Product Type CSV export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lemekinaye-product-types.csv';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setImportOpen(true);
      setImportError(
        'The filtered Product Types Library could not be exported. Try again.',
      );
    } finally {
      setExportBusy(false);
    }
  }

  function clearImportState() {
    setImportFileName('');
    setImportCsv('');
    setImportPreview(null);
    setImportError('');
    setImportSuccess('');
  }

  function closeImportPanel() {
    if (importBusy) return;
    clearImportState();
    setImportOpen(false);
  }

  async function previewImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    clearImportState();
    setImportOpen(true);
    setImportFileName(file.name);
    if (file.size > 1_000_000) {
      setImportError('Choose a CSV file no larger than 1 MB.');
      return;
    }

    setImportBusy(true);
    try {
      const csv = await file.text();
      const preview = await postJson<ProductTypeCsvImportPreviewResponse>(
        '/api/admin/catalog/product-types/import/preview',
        { csv, fileName: file.name },
      );
      setImportCsv(csv);
      setImportPreview(preview);
    } catch (error) {
      setImportError(
        error instanceof ClientApiError
          ? error.message
          : 'The Product Type CSV could not be previewed.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function commitProductTypeImport() {
    if (!importCsv || !importPreview || importPreview.invalidRows > 0) return;
    if (!confirmDiscardAttributeChanges()) return;

    setImportBusy(true);
    setImportError('');
    setImportSuccess('');
    try {
      const result = await postJson<ProductTypeCsvImportCommitResponse>(
        '/api/admin/catalog/product-types/import/commit',
        { csv: importCsv, fileName: importFileName },
      );
      setImportSuccess(
        `${result.createdCount} ${result.createdCount === 1 ? 'Product Type' : 'Product Types'} imported successfully.`,
      );
      setImportCsv('');
      setImportPreview(null);
      setImportFileName('');
      ++familyProductTypeRequestRef.current;
      setProductTypeId('');
      setLibraryPageNumber(1);
      setLibraryReloadKey((current) => current + 1);
    } catch (error) {
      setImportError(
        error instanceof ClientApiError
          ? error.message
          : 'The Product Type CSV import could not be committed.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  function resetLibraryFilters() {
    setLibrarySearch('');
    setLibraryStatus('ALL');
    setLibraryCategoryFilter('');
    setLibraryFamilyFilter('');
    setLibraryPageNumber(1);
    setSelectedSavedViewId('');
    setSavedViewName('');
  }

  function currentSavedViewState(): Record<string, unknown> {
    return {
      search: librarySearch,
      status: libraryStatus,
      categoryId: libraryCategoryFilter,
      productFamilyId: libraryFamilyFilter,
      sortBy: librarySortBy,
      sortDirection: librarySortDirection,
      pageSize: libraryPageSize,
    };
  }

  function applySavedView(view: AdminSavedViewRecord) {
    const state = view.state;
    const nextStatus = isFilterStatus(state.status) ? state.status : 'ALL';
    const nextSortBy = isProductTypeSortBy(state.sortBy)
      ? state.sortBy
      : 'SORT_ORDER';
    const nextSortDirection =
      state.sortDirection === 'DESC' ? 'DESC' : 'ASC';
    const nextCategoryId =
      typeof state.categoryId === 'string' &&
      categories.some((category) => category.id === state.categoryId)
        ? state.categoryId
        : '';
    const nextFamilyId =
      typeof state.productFamilyId === 'string' &&
      families.some(
        (family) =>
          family.id === state.productFamilyId &&
          (!nextCategoryId || family.categoryId === nextCategoryId),
      )
        ? state.productFamilyId
        : '';

    setLibrarySearch(
      typeof state.search === 'string' ? state.search : '',
    );
    setLibraryStatus(nextStatus);
    setLibraryCategoryFilter(nextCategoryId);
    setLibraryFamilyFilter(nextFamilyId);
    setLibrarySortBy(nextSortBy);
    setLibrarySortDirection(nextSortDirection);
    setLibraryPageSize(normalizeAdminPageSize(state.pageSize));
    setLibraryPageNumber(1);
    setSelectedSavedViewId(view.id);
    setSavedViewName(view.name);
    setSavedViewError('');
  }

  async function saveCurrentView() {
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
          scope: PRODUCT_TYPE_SAVED_VIEW_SCOPE,
          name,
          state: currentSavedViewState(),
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
          : 'The current view could not be saved.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function updateSelectedSavedView() {
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
          state: currentSavedViewState(),
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

  async function deleteSelectedSavedView() {
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

  function resetCreate() {
    setCreateMode(null);
    setCreateName('');
    setCreateDescription('');
    setCreateRequirements({ ...DEFAULT_PRODUCT_TYPE_REQUIREMENTS });
    setCreateError('');
  }

  function openCreate(mode: Exclude<CreateMode, null>) {
    if (createMode && !createFormKeyboard.confirmDiscard()) return;
    setCreateMode(mode);
    setCreateName('');
    setCreateDescription('');
    setCreateRequirements({ ...DEFAULT_PRODUCT_TYPE_REQUIREMENTS });
    setCreateError('');
    setNotice('');
  }

  async function loadFamilyProductTypes(
    nextFamilyId: string,
    preferredProductTypeId = '',
  ) {
    const requestId = ++familyProductTypeRequestRef.current;
    if (!nextFamilyId) {
      setProductTypes([]);
      setProductTypeId('');
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/catalog/product-types?productFamilyId=${nextFamilyId}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );
      if (!response.ok) throw new Error('Could not load Product Types');

      const items = (await response.json()) as ProductTypeRecord[];
      // An older request must not undo a newer selection or silently discard drafts.
      if (requestId !== familyProductTypeRequestRef.current) return;
      setProductTypes(items);
      setProductTypeId(
        items.find((item) => item.id === preferredProductTypeId)?.id ??
          items[0]?.id ??
          '',
      );
    } catch {
      if (requestId !== familyProductTypeRequestRef.current) return;
      setProductTypes([]);
      setProductTypeId('');
      setError('Product Types for the selected Part Group could not be loaded.');
    }
  }

  function confirmDiscardAttributeChanges() {
    return unsavedAttributeChanges === 0 ||
      window.confirm('Unsaved Product Type Attribute settings will be discarded. Continue?');
  }

  function selectCategory(nextCategoryId: string) {
    if (nextCategoryId === categoryId) return;
    if (!confirmDiscardAttributeChanges()) return;
    if (createMode && !createFormKeyboard.confirmDiscard()) return;
    setPublicationFocusProductTypeId(null);
    setUnsavedAttributeChanges(0);
    setCategoryId(nextCategoryId);
    const nextFamily =
      families
        .filter((family) => family.categoryId === nextCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
    setFamilyId(nextFamily?.id ?? '');
    setProductTypes([]);
    setProductTypeId('');
    resetCreate();

    // This also invalidates an outstanding request when the Category has no Part Group.
    void loadFamilyProductTypes(nextFamily?.id ?? '');
  }

  function selectFamily(nextFamilyId: string) {
    if (nextFamilyId === familyId) return;
    if (!confirmDiscardAttributeChanges()) return;
    if (createMode && !createFormKeyboard.confirmDiscard()) return;
    setPublicationFocusProductTypeId(null);
    setUnsavedAttributeChanges(0);
    setFamilyId(nextFamilyId);
    setProductTypes([]);
    setProductTypeId('');
    resetCreate();
    void loadFamilyProductTypes(nextFamilyId);
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createMode || !confirmDiscardAttributeChanges()) return;

    const name = createName.trim();
    if (!name) {
      setCreateError('Enter a name.');
      return;
    }

    setCreateSaving(true);
    setCreateError('');
    setNotice('');

    try {
      if (createMode === 'category') {
        const input: CreateCategoryInput = {
          code: createCode(name).slice(0, 50),
          name,
          slug: createSlug(name).slice(0, 140),
          description: createDescription.trim() || null,
          status: 'DRAFT',
        };
        const created = await postJson<CategoryRecord>(
          '/api/admin/catalog/categories',
          input,
        );
        ++familyProductTypeRequestRef.current;
        setCategories((current) => [...current, created]);
        setCategoryId(created.id);
        setFamilyId('');
        setProductTypes([]);
        setProductTypeId('');
        setNotice(`${created.name} created. Add its first Part Group.`);
        createFormKeyboard.markPristine();
        openCreate('family');
        return;
      }

      if (createMode === 'family') {
        if (!categoryId) {
          setCreateError('Choose a Category first.');
          return;
        }
        const input: CreateProductFamilyInput = {
          categoryId,
          code: createCode(name).slice(0, 60),
          name,
          description: createDescription.trim() || null,
          status: 'DRAFT',
        };
        const created = await postJson<ProductFamilyRecord>(
          '/api/admin/catalog/product-families',
          input,
        );
        ++familyProductTypeRequestRef.current;
        setFamilies((current) => [...current, created]);
        setFamilyId(created.id);
        setProductTypes([]);
        setProductTypeId('');
        setNotice(`${created.name} created. Add its first Product Type.`);
        createFormKeyboard.markPristine();
        openCreate('product-type');
        return;
      }

      if (!categoryId || !familyId) {
        setCreateError('Choose a Category and Part Group first.');
        return;
      }

      const input: CreateProductTypeInput = {
        categoryId,
        productFamilyId: familyId,
        code: createCode(name).slice(0, 50),
        name,
        slug: createSlug(name).slice(0, 140),
        description: createDescription.trim() || null,
        ...createRequirements,
        status: 'DRAFT',
      };
      const created = await postJson<ProductTypeRecord>(
        '/api/admin/catalog/product-types',
        input,
      );

      ++familyProductTypeRequestRef.current;
      setProductTypes((current) => [...current, created]);
      setProductTypeId(created.id);
      setLibraryPageNumber(1);
      setLibraryReloadKey((current) => current + 1);
      resetCreate();
      setNotice(
        `${created.name} created. Select its Technical Attributes below.`,
      );
    } catch (requestError) {
      setCreateError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'The catalog record could not be created.',
      );
    } finally {
      setCreateSaving(false);
    }
  }

  function handleProductTypeChange(updated: ProductTypeRecord) {
    setProductTypes((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setLibraryReloadKey((current) => current + 1);
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Catalog management</span>
        <h1>Product Types</h1>
        <p>
          Your administrator account does not have the catalog.manage
          permission.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page product-types-professional-page">
      <AdminPageHeader
        eyebrow="Product catalog"
        title="Product Types"
        description="Build the generic automotive catalog from classification through technical Attributes and publication."
      />

      <CatalogPrimaryNav active="product-types" />

      {loading ? <AdminLoadingState message="Loading Product Types…" /> : null}

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="product-classification-bar" id="product-type-classification">
            <div className="product-classification-bar__heading">
              <div>
                <span className="eyebrow">Catalog classification</span>
                <h2>Category → Part Group → Product Type</h2>
              </div>
              <div className="product-classification-bar__counts">
                <span>{rootCategories.length} Categories</span>
                <span>{families.length} Part Groups</span>
                <span>{libraryData.total} Product Types</span>
              </div>
            </div>

            <div className="product-classification-grid">
              <ClassificationField
                label="Category"
                value={categoryId}
                placeholder="Choose Category"
                options={rootCategories.map((category) => ({
                  id: category.id,
                  label: category.name,
                }))}
                onChange={selectCategory}
                onAdd={() => openCreate('category')}
                addLabel="Add Category"
              />

              <ClassificationField
                label="Part Group"
                value={familyId}
                placeholder={
                  categoryId ? 'Choose Part Group' : 'Choose Category first'
                }
                options={categoryFamilies.map((family) => ({
                  id: family.id,
                  label: family.name,
                }))}
                onChange={selectFamily}
                onAdd={() =>
                  categoryId ? openCreate('family') : openCreate('category')
                }
                addLabel="Add Part Group"
                disabled={!categoryId}
              />

              <ClassificationField
                label="Product Type"
                value={productTypeId}
                placeholder={
                  familyId ? 'Choose Product Type' : 'Choose Part Group first'
                }
                options={familyProductTypes.map((item) => ({
                  id: item.id,
                  label: item.name,
                }))}
                onChange={(value) => {
                  if (value !== productTypeId && !confirmDiscardAttributeChanges()) return;
                  if (createMode && !createFormKeyboard.confirmDiscard()) return;
                  setPublicationFocusProductTypeId(null);
                  setUnsavedAttributeChanges(0);
                  setProductTypeId(value);
                  resetCreate();
                }}
                onAdd={() =>
                  familyId ? openCreate('product-type') : openCreate('family')
                }
                addLabel="Add Product Type"
                disabled={!familyId}
              />
            </div>

            <div className="product-classification-path">
              <span>Current path</span>
              <strong>{selectedCategory?.name ?? 'Category'}</strong>
              <i>→</i>
              <strong>{selectedFamily?.name ?? 'Part Group'}</strong>
              <i>→</i>
              <strong>{selectedProductType?.name ?? 'Product Type'}</strong>
            </div>
          </section>

          {createMode ? (
            <form
              className="product-classification-create"
              ref={createFormKeyboard.ref}
              onKeyDown={createFormKeyboard.onKeyDown}
              onSubmit={createRecord}
            >
              <div>
                <span className="eyebrow">Quick add</span>
                <h3>
                  {createMode === 'category'
                    ? 'Category'
                    : createMode === 'family'
                      ? 'Part Group'
                      : 'Product Type'}
                </h3>
                <p>
                  {createMode === 'category'
                    ? 'Create the broad automotive classification.'
                    : createMode === 'family'
                      ? `Create inside ${selectedCategory?.name ?? 'the selected Category'}.`
                      : `Create inside ${selectedFamily?.name ?? 'the selected Part Group'}.`}
                </p>
              </div>

              <label className="field">
                <span className="field__label">Name</span>
                <div className="field__control">
                  <input
                    required
                    maxLength={140}
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder={
                      createMode === 'category'
                        ? 'Example: Braking'
                        : createMode === 'family'
                          ? 'Example: Disc Brake Components'
                          : 'Example: Brake Pad Set'
                    }
                  />
                </div>
                <small className="field__hint">
                  Code: {createCode(createName) || '—'}
                </small>
              </label>

              <label className="field product-classification-create__description">
                <span className="field__label">Description</span>
                <textarea
                  maxLength={2000}
                  value={createDescription}
                  placeholder="Optional definition"
                  onChange={(event) =>
                    setCreateDescription(event.target.value)
                  }
                />
              </label>

              {createMode === 'product-type' ? (
                <div className="product-classification-create__requirements">
                  <div className="product-classification-create__requirements-heading">
                    <strong>Article & listing requirements</strong>
                    <span>
                      Define what sellers must provide for actual products of this type.
                    </span>
                  </div>
                  <ProductTypeRequirementFields
                    value={createRequirements}
                    onChange={setCreateRequirements}
                    disabled={createSaving}
                  />
                </div>
              ) : null}

              <LikelyDuplicateWarning
                match={createDuplicate.match}
                checking={createDuplicate.checking}
              />

              <div className="product-classification-create__actions">
                {createError ? (
                  <span className="field__error">{createError}</span>
                ) : null}
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={createSaving || !createName.trim()}
                >
                  {createSaving
                    ? 'Creating…'
                    : createMode === 'category'
                      ? 'Create Category'
                      : createMode === 'family'
                        ? 'Create Part Group'
                        : 'Create Product Type'}
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={createSaving}
                  onClick={createFormKeyboard.requestClose}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {notice ? (
            <div className="alert alert--success" role="status">
              {notice}
            </div>
          ) : null}

          {selectedProductType ? (
            <>
              <section className="product-type-workbench-shell" aria-label="Selected Product Type workbench">
                <div className="product-type-workbench-shell__identity">
                  <span className="eyebrow">Selected Product Type</span>
                  <strong>{selectedProductType.name}</strong>
                  <small>
                    One professional workflow for definition, requirements, technical
                    Attributes, readiness and publishing.
                  </small>
                </div>
                <nav className="product-type-workbench-nav" aria-label="Product Type workflow">
                  <a href="#product-type-definition">Definition</a>
                  <a href="#product-type-requirements">Article requirements</a>
                  <a href="#product-type-attributes">Technical Attributes</a>
                  <a href="#product-type-publish">Readiness & publish</a>
                </nav>
              </section>

              <div className="product-type-external-mapping-bar">
                <div>
                  <span className="eyebrow">Canonical reference data</span>
                  <strong>One identity, many integrations and languages</strong>
                  <small>
                    Keep the Lemekinaye Product Type canonical while maintaining
                    external-standard IDs and localized names/descriptions.
                  </small>
                </div>
                <div className="product-type-reference-actions">
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => void openLocalizations(selectedProductType)}
                  >
                    Localized content
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => void openMappings(selectedProductType)}
                  >
                    External mappings
                  </button>
                </div>
              </div>
              <ProductTypeImageLimits
                key={selectedProductType.id}
                productType={selectedProductType}
                onProductTypeChange={handleProductTypeChange}
              />
              <ProductTypeTechnicalAttributes
                key={selectedProductType.id}
                productType={selectedProductType}
                onProductTypeChange={handleProductTypeChange}
                onUnsavedChange={setUnsavedAttributeChanges}
                focusPublication={publicationFocusProductTypeId === selectedProductType.id}
                onPublicationFocused={() => setPublicationFocusProductTypeId(null)}
              />
            </>
          ) : (
            <div className="catalog-empty product-types-no-selection">
              <h2>
                {familyId
                  ? 'Create or choose a Product Type'
                  : 'Choose the catalog classification'}
              </h2>
              <p>
                Technical Attributes become available immediately after a Product
                Type is selected.
              </p>
              {familyId ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => openCreate('product-type')}
                >
                  + Add Product Type
                </button>
              ) : null}
            </div>
          )}

          {localizationTarget ? (
            <div className="catalog-drawer-layer" role="presentation">
              <button
                className="catalog-drawer-scrim"
                type="button"
                aria-label="Close localized content"
                disabled={localizationSaving}
                onClick={localizationDrawerRef.requestClose}
              />
              <aside
                ref={localizationDrawerRef}
                className="catalog-drawer product-type-mapping-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-type-localization-title"
                tabIndex={-1}
              >
                <div className="catalog-drawer__heading">
                  <div>
                    <span className="eyebrow">Localized reference data</span>
                    <h2 id="product-type-localization-title">
                      {localizationTarget.name}
                    </h2>
                    <p>
                      Add English, Amharic or other localized labels without
                      creating duplicate Product Types.
                    </p>
                  </div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={localizationSaving}
                    onClick={localizationDrawerRef.requestClose}
                  >
                    Close
                  </button>
                </div>

                <div className="external-mapping-list">
                  {localizationLoading ? (
                    <div className="catalog-state">
                      <span className="spinner spinner--dark" aria-hidden="true" />
                      <span>Loading localized content…</span>
                    </div>
                  ) : localizations.length === 0 ? (
                    <div className="catalog-empty">
                      <strong>No localized content yet</strong>
                      <p>Add the first locale while keeping the canonical record unchanged.</p>
                    </div>
                  ) : (
                    localizations.map((record) => (
                      <button
                        className={
                          editingLocalization?.id === record.id
                            ? 'external-mapping-record is-selected'
                            : 'external-mapping-record'
                        }
                        type="button"
                        key={record.id}
                        onClick={() => {
                          if (localizationDrawerRef.confirmDiscard()) {
                            resetLocalizationForm(record);
                          }
                        }}
                      >
                        <span>
                          <strong>{record.name}</strong>
                          <small>{record.description || 'No localized description'}</small>
                        </span>
                        <span>
                          <b>{record.locale}</b>
                          <small>v{record.version}</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <form className="catalog-drawer__form" onSubmit={saveLocalization}>
                  <div className="catalog-drawer__fields">
                    <div className="external-mapping-form-heading">
                      <strong>
                        {editingLocalization
                          ? 'Edit localized content'
                          : 'Add localized content'}
                      </strong>
                      {editingLocalization ? (
                        <button
                          className="button button--quiet"
                          type="button"
                          disabled={localizationSaving}
                          onClick={() => {
                            if (localizationDrawerRef.confirmDiscard()) {
                              resetLocalizationForm();
                            }
                          }}
                        >
                          New locale
                        </button>
                      ) : null}
                    </div>

                    {localizationError ? (
                      <div className="alert alert--error" role="alert">
                        {localizationError}
                      </div>
                    ) : null}

                    <label className="field">
                      <span className="field__label">Locale</span>
                      <input
                        data-admin-autofocus
                        required
                        disabled={Boolean(editingLocalization)}
                        maxLength={35}
                        value={localizationForm.locale ?? ''}
                        placeholder="am, en, om, fr…"
                        onChange={(event) =>
                          setLocalizationForm((current) => ({
                            ...current,
                            locale: event.target.value,
                          }))
                        }
                      />
                      <small className="field__hint">
                        Use a BCP 47-style language tag. Locale is fixed after creation.
                      </small>
                    </label>

                    <label className="field">
                      <span className="field__label">Localized name</span>
                      <input
                        required
                        maxLength={200}
                        value={localizationForm.name ?? ''}
                        placeholder="Localized Product Type name"
                        onChange={(event) =>
                          setLocalizationForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span className="field__label">Localized description</span>
                      <textarea
                        className="catalog-drawer__textarea"
                        maxLength={4000}
                        value={localizationForm.description ?? ''}
                        placeholder="Optional localized definition"
                        onChange={(event) =>
                          setLocalizationForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="catalog-drawer__actions external-mapping-actions">
                    {editingLocalization ? (
                      <button
                        className="button button--quiet"
                        type="button"
                        disabled={localizationSaving}
                        onClick={() => void removeLocalization()}
                      >
                        Remove locale
                      </button>
                    ) : <span />}
                    <button
                      className="button button--primary"
                      type="submit"
                      disabled={localizationSaving}
                    >
                      {localizationSaving
                        ? 'Saving…'
                        : editingLocalization
                          ? 'Save localized content'
                          : 'Add locale'}
                    </button>
                  </div>
                </form>
              </aside>
            </div>
          ) : null}

          {mappingTarget ? (
            <div className="catalog-drawer-layer" role="presentation">
              <button
                className="catalog-drawer-scrim"
                type="button"
                aria-label="Close external mappings"
                disabled={mappingSaving}
                onClick={mappingDrawerRef.requestClose}
              />
              <aside
                ref={mappingDrawerRef}
                className="catalog-drawer product-type-mapping-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-type-mapping-title"
                tabIndex={-1}
              >
                <div className="catalog-drawer__heading">
                  <div>
                    <span className="eyebrow">External-standard mappings</span>
                    <h2 id="product-type-mapping-title">{mappingTarget.name}</h2>
                    <p>
                      Lemekinaye code {mappingTarget.code} remains the canonical
                      internal identity.
                    </p>
                  </div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={mappingSaving}
                    onClick={mappingDrawerRef.requestClose}
                  >
                    Close
                  </button>
                </div>

                <div className="external-mapping-list">
                  {mappingLoading ? (
                    <div className="catalog-state">
                      <span className="spinner spinner--dark" aria-hidden="true" />
                      <span>Loading mappings…</span>
                    </div>
                  ) : externalMappings.length === 0 ? (
                    <div className="catalog-empty">
                      <strong>No external mappings yet</strong>
                      <p>Add the first standards reference for this Product Type.</p>
                    </div>
                  ) : (
                    externalMappings.map((record) => (
                      <button
                        className={
                          editingMapping?.id === record.id
                            ? 'external-mapping-record is-selected'
                            : 'external-mapping-record'
                        }
                        type="button"
                        key={record.id}
                        onClick={() => {
                          if (mappingDrawerRef.confirmDiscard()) {
                            resetMappingForm(record);
                          }
                        }}
                      >
                        <span>
                          <strong>
                            {record.provider} · {record.standard}
                          </strong>
                          <small>{record.externalEntityType}</small>
                        </span>
                        <span>
                          <b>{record.externalIdentifier}</b>
                          <small>{record.externalVersion || 'Version not specified'}</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <form className="catalog-drawer__form" onSubmit={saveExternalMapping}>
                  <div className="catalog-drawer__fields">
                    <div className="external-mapping-form-heading">
                      <strong>
                        {editingMapping ? 'Edit mapping' : 'Add mapping'}
                      </strong>
                      {editingMapping ? (
                        <button
                          className="button button--quiet"
                          type="button"
                          disabled={mappingSaving}
                          onClick={() => {
                            if (mappingDrawerRef.confirmDiscard()) {
                              resetMappingForm();
                            }
                          }}
                        >
                          New mapping
                        </button>
                      ) : null}
                    </div>

                    {mappingError ? (
                      <div className="alert alert--error" role="alert">
                        {mappingError}
                      </div>
                    ) : null}

                    <div className="catalog-drawer__two">
                      <label className="field">
                        <span className="field__label">Provider</span>
                        <input
                          data-admin-autofocus
                          required
                          maxLength={100}
                          value={mappingForm.provider ?? ''}
                          placeholder="TecAlliance"
                          onChange={(event) =>
                            setMappingForm((current) => ({
                              ...current,
                              provider: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Standard</span>
                        <input
                          required
                          maxLength={100}
                          value={mappingForm.standard ?? ''}
                          placeholder="TecDoc"
                          onChange={(event) =>
                            setMappingForm((current) => ({
                              ...current,
                              standard: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="catalog-drawer__two">
                      <label className="field">
                        <span className="field__label">External entity type</span>
                        <input
                          required
                          maxLength={100}
                          value={mappingForm.externalEntityType ?? ''}
                          placeholder="GenericArticle"
                          onChange={(event) =>
                            setMappingForm((current) => ({
                              ...current,
                              externalEntityType: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">External identifier</span>
                        <input
                          required
                          maxLength={180}
                          value={mappingForm.externalIdentifier ?? ''}
                          placeholder="402"
                          onChange={(event) =>
                            setMappingForm((current) => ({
                              ...current,
                              externalIdentifier: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className="field">
                      <span className="field__label">External version</span>
                      <input
                        maxLength={80}
                        value={mappingForm.externalVersion ?? ''}
                        placeholder="Optional provider dataset/version"
                        onChange={(event) =>
                          setMappingForm((current) => ({
                            ...current,
                            externalVersion: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span className="field__label">Mapping notes</span>
                      <textarea
                        className="catalog-drawer__textarea"
                        maxLength={2000}
                        value={mappingForm.notes ?? ''}
                        placeholder="Scope, caveats, mapping rationale…"
                        onChange={(event) =>
                          setMappingForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="catalog-drawer__actions external-mapping-actions">
                    {editingMapping ? (
                      <button
                        className="button button--quiet"
                        type="button"
                        disabled={mappingSaving}
                        onClick={() => void removeExternalMapping()}
                      >
                        Remove mapping
                      </button>
                    ) : <span />}
                    <button
                      className="button button--primary"
                      type="submit"
                      disabled={mappingSaving}
                    >
                      {mappingSaving
                        ? 'Saving…'
                        : editingMapping
                          ? 'Save mapping'
                          : 'Add mapping'}
                    </button>
                  </div>
                </form>
              </aside>
            </div>
          ) : null}

          <section className="product-types-library">
            <div className="product-types-library__heading">
              <div>
                <span className="eyebrow">Canonical library</span>
                <h2>Product Types Library</h2>
                <p>
                  Browse the complete Category → Part Group → Product Type
                  classification.
                </p>
              </div>

              <div className="attribute-library-heading-actions">
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={exportBusy}
                  onClick={() => void exportProductTypeCsv()}
                >
                  {exportBusy ? 'Exporting…' : 'Export CSV'}
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  aria-expanded={importOpen}
                  onClick={() => {
                    if (importOpen) closeImportPanel();
                    else {
                      clearImportState();
                      setImportOpen(true);
                    }
                  }}
                >
                  Import CSV
                </button>
              </div>

              <div className="product-types-library__filters">
                <label className="field">
                  <span className="field__label">Search</span>
                  <div className="field__control">
                    <input
                      type="search"
                      value={librarySearch}
                      placeholder="Brake pad, filter, radiator…"
                      onChange={(event) => {
                        setLibrarySearch(event.target.value);
                        setLibraryPageNumber(1);
                      }}
                    />
                  </div>
                </label>
                <label className="field">
                  <span className="field__label">Status</span>
                  <select
                    className="category-form__select"
                    value={libraryStatus}
                    onChange={(event) => {
                      setLibraryStatus(event.target.value as FilterStatus);
                      setLibraryPageNumber(1);
                    }}
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="DEPRECATED">Deprecated</option>
                    <option value="SUPERSEDED">Superseded</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
                <div className="field">
                  <span className="field__label">Category</span>
                  <AdminSearchableCombobox
                    id="product-types-library-category"
                    value={libraryCategoryFilter}
                    options={[
                      { id: '', label: 'All Categories' },
                      ...rootCategories.map((category) => ({
                        id: category.id,
                        label: category.name,
                      })),
                    ]}
                    placeholder="All Categories"
                    searchPlaceholder="Search Categories…"
                    onChange={(nextCategoryId) => {
                      setLibraryCategoryFilter(nextCategoryId);
                      setLibraryFamilyFilter((current) =>
                        families.some(
                          (family) =>
                            family.id === current &&
                            (!nextCategoryId ||
                              family.categoryId === nextCategoryId),
                        )
                          ? current
                          : '',
                      );
                      setLibraryPageNumber(1);
                    }}
                  />
                </div>
                <div className="field">
                  <span className="field__label">Part Group</span>
                  <AdminSearchableCombobox
                    id="product-types-library-part-group"
                    value={libraryFamilyFilter}
                    options={[
                      { id: '', label: 'All Part Groups' },
                      ...libraryFilterFamilies.map((family) => ({
                        id: family.id,
                        label: family.name,
                      })),
                    ]}
                    placeholder="All Part Groups"
                    searchPlaceholder="Search Part Groups…"
                    onChange={(nextFamilyId) => {
                      setLibraryFamilyFilter(nextFamilyId);
                      setLibraryPageNumber(1);
                    }}
                  />
                </div>
                <label className="field">
                  <span className="field__label">Sort by</span>
                  <select
                    className="category-form__select"
                    value={librarySortBy}
                    onChange={(event) => {
                      setLibrarySortBy(
                        event.target.value as ProductTypeLibrarySortBy,
                      );
                      setLibraryPageNumber(1);
                    }}
                  >
                    {productTypeSortOptions.map((option) => (
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
                <AdminFilterResetButton
                  active={libraryHasActiveFilters}
                  onReset={resetLibraryFilters}
                />
              </div>
            </div>

            {importOpen ? (
              <section className="attribute-import-panel" aria-label="Product Type CSV import">
                <div className="attribute-import-panel__heading">
                  <div>
                    <strong>Product Type CSV import</strong>
                    <small>
                      Category and Part Group are resolved by canonical code.
                      Preview validates hierarchy and seller requirements before any write.
                    </small>
                  </div>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={importBusy}
                    onClick={closeImportPanel}
                  >
                    Close
                  </button>
                </div>

                <div className="attribute-import-panel__controls">
                  <input
                    className="attribute-import-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Choose Product Type CSV file"
                    disabled={importBusy}
                    onChange={(event) => void previewImportFile(event)}
                  />
                  <span>
                    {importBusy
                      ? 'Validating CSV…'
                      : importFileName ||
                        'No file selected · maximum 1 MB / 2,000 rows'}
                  </span>
                </div>

                {importError ? (
                  <div className="alert alert--error" role="alert">
                    {importError}
                  </div>
                ) : null}

                {importSuccess ? (
                  <div className="alert alert--success" role="status">
                    {importSuccess}
                  </div>
                ) : null}

                {importPreview ? (
                  <>
                    <div className="attribute-import-summary">
                      <span><strong>{importPreview.totalRows}</strong> rows</span>
                      <span><strong>{importPreview.validRows}</strong> valid</span>
                      <span className={importPreview.invalidRows > 0 ? 'is-invalid' : ''}>
                        <strong>{importPreview.invalidRows}</strong> invalid
                      </span>
                    </div>

                    <div className="attribute-import-preview">
                      {importPreviewRows.map((row) => (
                        <div
                          className={
                            row.errors.length > 0
                              ? 'attribute-import-row attribute-import-row--invalid'
                              : 'attribute-import-row'
                          }
                          key={row.rowNumber}
                        >
                          <span>#{row.rowNumber}</span>
                          <div>
                            <strong>{row.name || 'Unnamed Product Type'}</strong>
                            <small>
                              {row.code || 'Missing code'} ·{' '}
                              {row.categoryCode || 'Missing Category'} →{' '}
                              {row.partGroupCode || 'Missing Part Group'} ·{' '}
                              {row.status || 'Draft'}
                            </small>
                            {row.errors.length > 0 ? (
                              <ul>
                                {row.errors.map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    {importPreview.totalRows > importPreviewRows.length ? (
                      <small className="attribute-import-panel__note">
                        Showing the first {importPreviewRows.length} rows with invalid
                        rows prioritized. All {importPreview.totalRows} rows are validated
                        on the server.
                      </small>
                    ) : null}

                    <div className="attribute-import-panel__actions">
                      <span>
                        {importPreview.invalidRows > 0
                          ? 'Fix the invalid rows and choose the corrected CSV again.'
                          : 'All rows passed preview validation. Commit writes the batch atomically.'}
                      </span>
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={
                          importBusy ||
                          importPreview.totalRows === 0 ||
                          importPreview.invalidRows > 0
                        }
                        onClick={() => void commitProductTypeImport()}
                      >
                        {importBusy
                          ? 'Importing…'
                          : `Import ${importPreview.validRows} ${importPreview.validRows === 1 ? 'Product Type' : 'Product Types'}`}
                      </button>
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

            <AdminSavedViewsToolbar
              idPrefix="product-types"
              savedViews={savedViews}
              loading={savedViewsLoading}
              saving={savedViewSaving}
              selectedId={selectedSavedViewId}
              name={savedViewName}
              namePlaceholder="Draft brake parts"
              error={savedViewError}
              onSelect={(view) => {
                if (view) applySavedView(view);
                else {
                  setSelectedSavedViewId('');
                  setSavedViewName('');
                }
              }}
              onNameChange={setSavedViewName}
              onSaveAsNew={() => void saveCurrentView()}
              onUpdate={() => void updateSelectedSavedView()}
              onDelete={() => void deleteSelectedSavedView()}
            />

            {libraryLoading ? (
              <div className="catalog-state" aria-live="polite">
                <span className="spinner spinner--dark" aria-hidden="true" />
                <p>Loading Product Types library…</p>
              </div>
            ) : null}

            {libraryError ? (
              <div className="alert alert--error" role="alert">
                {libraryError}
              </div>
            ) : null}

            {!libraryLoading && !libraryError && libraryData.items.length === 0 ? (
              <AdminEmptyState
                title={
                  libraryHasActiveFilters
                    ? 'No Product Types match the current filters'
                    : 'No Product Types yet'
                }
                description={
                  libraryHasActiveFilters
                    ? 'Adjust your search or reset the filters to see more Product Types.'
                    : 'Start with a Category and Part Group using the controls above, then create your first Product Type.'
                }
                headingLevel={3}
              />
            ) : !libraryError && libraryData.items.length > 0 ? (
              <div
                className="admin-library-table product-types-library__table"
                role="table"
                aria-label="Product Types library"
              >
                <div
                  className="admin-library-table__row admin-library-table__row--header product-types-library__table-row"
                  role="row"
                >
                  <span role="columnheader">Product Type</span>
                  <span role="columnheader">Category</span>
                  <span role="columnheader">Part Group</span>
                  <span role="columnheader">Fitment</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Publication</span>
                  <span role="columnheader">Action</span>
                </div>

                {libraryData.items.map((item) => {
                  const category = libraryCategoryById.get(item.categoryId);
                  const family = item.productFamilyId
                    ? libraryFamilyById.get(item.productFamilyId)
                    : null;

                  const openProductType = (openPublication = false) => {
                    // Switching records must never silently discard staged row settings.
                    if (item.id !== productTypeId && !confirmDiscardAttributeChanges()) return;
                    // Invalidate an older Part Group response even when this record has no family.
                    ++familyProductTypeRequestRef.current;
                    setCategoryId(item.categoryId);
                    setFamilyId(item.productFamilyId ?? '');
                    setProductTypes([item]);
                    setProductTypeId(item.id);
                    if (item.id !== productTypeId) setUnsavedAttributeChanges(0);
                    setPublicationFocusProductTypeId(openPublication ? item.id : null);
                    resetCreate();
                    if (item.productFamilyId) {
                      void loadFamilyProductTypes(item.productFamilyId, item.id);
                    }
                    if (!openPublication) {
                      window.requestAnimationFrame(() => {
                        document.querySelector('.product-type-technical')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      });
                    }
                  };
                  return (
                    <div
                      className={
                        item.id === productTypeId
                          ? 'admin-library-table__row product-types-library__table-row is-selected'
                          : 'admin-library-table__row product-types-library__table-row'
                      }
                      role="row"
                      key={item.id}
                    >
                      <span className="admin-library-table__primary" role="cell">
                        <strong>{item.name}</strong>
                        <small>{item.code}</small>
                      </span>
                      <span role="cell">{category?.name ?? '—'}</span>
                      <span role="cell">{family?.name ?? '—'}</span>
                      <span role="cell">{formatAdminEnumLabel(item.fitmentRequirement)}</span>
                      <span role="cell">
                        <AdminStatusBadge status={item.status} />
                      </span>
                      <span role="cell">
                        <i
                          className={
                            item.currentSchemaVersionId
                              ? 'product-types-library__publication is-published'
                              : 'product-types-library__publication'
                          }
                        >
                          {item.currentSchemaVersionId
                            ? 'Published'
                            : 'Not published'}
                        </i>
                      </span>
                      <span className="product-types-library__actions" role="cell">
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={() => openProductType()}
                        >
                          Open here
                        </button>
                        <a
                          className="button button--quiet"
                          href={`/admin/catalog/product-types/${item.id}/attributes`}
                        >
                          {item.currentSchemaVersionId
                            ? 'Review setup'
                            : 'Continue setup'}
                        </a>
                        <AdminMasterLifecycleActions
                          domain="CATALOG"
                          entityType="PRODUCT_TYPE"
                          entityId={item.id}
                          entityName={item.name}
                          status={item.status}
                          version={item.version}
                          reactivatePath={`/api/admin/catalog/product-types/${item.id}`}
                          disabled={!canManage}
                          onPublishRequested={() => openProductType(true)}
                          onCompleted={() =>
                            setLibraryReloadKey((current) => current + 1)
                          }
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!libraryError && libraryData.total > 0 ? (
              <AdminLibraryPagination
                page={libraryData.page}
                pageCount={libraryData.pageCount}
                pageSize={libraryPageSize}
                total={libraryData.total}
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
      ) : null}
    </section>
  );
}

function isFilterStatus(value: unknown): value is FilterStatus {
  return (
    value === 'ALL' ||
    value === 'DRAFT' ||
    value === 'ACTIVE' ||
    value === 'INACTIVE' ||
    value === 'ARCHIVED'
  );
}

function isProductTypeSortBy(
  value: unknown,
): value is ProductTypeLibrarySortBy {
  return productTypeSortOptions.some((option) => option.value === value);
}

function ClassificationField({
  label,
  value,
  options,
  placeholder,
  onChange,
  onAdd,
  addLabel,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  addLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="product-classification-field">
      <div className="product-classification-field__heading">
        <span className="field__label">{label}</span>
        <button
          className="product-classification-field__add"
          type="button"
          disabled={disabled}
          onClick={onAdd}
        >
          <span aria-hidden="true">+</span>
          {addLabel}
        </button>
      </div>

      <AdminSearchableCombobox
        id={`product-classification-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        value={value}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
        emptyMessage={`No ${label.toLowerCase()} matches your search.`}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
