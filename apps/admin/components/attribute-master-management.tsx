'use client';

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import type {
  AttributeAllowedValueRecord,
  AttributeDataType,
  AttributeDefinitionPage,
  AttributeDefinitionRecord,
  AttributeDefinitionSummary,
  AttributeGroupRecord,
  AttributeCsvImportCommitResponse,
  AttributeCsvImportPreviewResponse,
  AttributeScope,
  AttributeValueSource,
  CreateAttributeAllowedValueInput,
  CreateAttributeDefinitionInput,
  CreateAttributeGroupInput,
  UpdateAttributeAllowedValueInput,
  UpdateAttributeDefinitionInput,
  UpdateAttributeGroupInput,
} from '@/lib/catalog-attribute-contracts';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import {
  createAllowedValueCode,
  createAttributeCode,
  isStaticValueAttribute,
} from '@/lib/attribute-master-management';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
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
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { useAdminPrincipal } from './admin-session';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useAdminOverlayKeyboard } from '@/lib/use-admin-overlay-keyboard';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';

type FilterStatus = 'ALL' | MasterDataStatus;
type FilterScope = 'ALL' | AttributeScope;
type FilterDataType = 'ALL' | AttributeDataType;
type AttributeAdminSortBy =
  | 'NAME'
  | 'CODE'
  | 'DATA_TYPE'
  | 'SCOPE'
  | 'VALUE_SOURCE'
  | 'STATUS'
  | 'UPDATED_AT'
  | 'CREATED_AT';
type SortDirection = 'ASC' | 'DESC';

const ATTRIBUTE_SAVED_VIEW_SCOPE = 'CATALOG_ATTRIBUTES';

const attributeSortOptions: Array<{
  value: AttributeAdminSortBy;
  label: string;
}> = [
  { value: 'NAME', label: 'Attribute name' },
  { value: 'CODE', label: 'Attribute code' },
  { value: 'DATA_TYPE', label: 'Data type' },
  { value: 'SCOPE', label: 'Scope' },
  { value: 'VALUE_SOURCE', label: 'Value source' },
  { value: 'STATUS', label: 'Lifecycle status' },
  { value: 'UPDATED_AT', label: 'Updated time' },
  { value: 'CREATED_AT', label: 'Created date' },
];

const attributeStatuses: MasterDataStatus[] = [
  'ACTIVE',
  'DRAFT',
  'INACTIVE',
  'ARCHIVED',
];

const dataTypes: AttributeDataType[] = [
  'TEXT',
  'LONG_TEXT',
  'INTEGER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'MONEY',
  'SELECT',
  'MULTI_SELECT',
  'REFERENCE',
  'MULTI_REFERENCE',
  'COUNTRY',
  'MEASUREMENT',
  'IMAGE',
  'MULTI_IMAGE',
  'VIDEO',
  'FILE',
  'UUID',
];

const scopes: AttributeScope[] = [
  'PRODUCT',
  'VEHICLE',
  'COMPATIBILITY',
  'SELLER',
  'SYSTEM',
];

const valueSources: AttributeValueSource[] = [
  'NONE',
  'STATIC',
  'REFERENCE',
  'DYNAMIC',
];

export function AttributeMasterManagement() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [attributes, setAttributes] = useState<AttributeDefinitionRecord[]>([]);
  const [groups, setGroups] = useState<AttributeGroupRecord[]>([]);
  const [attributeSummary, setAttributeSummary] =
    useState<AttributeDefinitionSummary>({
      total: 0,
      ungrouped: 0,
      groupCounts: {},
    });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [libraryPageNumber, setLibraryPageNumber] = useState(1);
  const [libraryPageSize, setLibraryPageSize] = useState<AdminPageSize>(50);
  const [libraryPageCount, setLibraryPageCount] = useState(0);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryReloadKey, setLibraryReloadKey] = useState(0);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

  const [selectedGroupId, setSelectedGroupId] = useState('ALL');
  const [selectedAttributeId, setSelectedAttributeId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [scopeFilter, setScopeFilter] = useState<FilterScope>('ALL');
  const [dataTypeFilter, setDataTypeFilter] = useState<FilterDataType>('ALL');
  const [sortBy, setSortBy] = useState<AttributeAdminSortBy>('NAME');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ASC');
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
    useState<AttributeCsvImportPreviewResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const [attributeFormOpen, setAttributeFormOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] =
    useState<AttributeDefinitionRecord | null>(null);
  const [attributeName, setAttributeName] = useState('');
  const [attributeCode, setAttributeCode] = useState('');
  const [attributeGroupId, setAttributeGroupId] = useState('');
  const [dataType, setDataType] = useState<AttributeDataType>('TEXT');
  const [scope, setScope] = useState<AttributeScope>('PRODUCT');
  const [valueSource, setValueSource] =
    useState<AttributeValueSource>('NONE');
  const [unit, setUnit] = useState('');
  const [exampleValue, setExampleValue] = useState('');
  const [attributeDescription, setAttributeDescription] = useState('');
  const [repeatable, setRepeatable] = useState(false);
  const [translatable, setTranslatable] = useState(false);
  const [attributeStatus, setAttributeStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [attributeSaving, setAttributeSaving] = useState(false);
  const [attributeFormError, setAttributeFormError] = useState('');

  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AttributeGroupRecord | null>(
    null,
  );
  const [groupName, setGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSortOrder, setGroupSortOrder] = useState('0');
  const [groupStatus, setGroupStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupFormError, setGroupFormError] = useState('');

  const [values, setValues] = useState<AttributeAllowedValueRecord[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesError, setValuesError] = useState('');
  const [valueFormOpen, setValueFormOpen] = useState(false);
  const [editingValue, setEditingValue] =
    useState<AttributeAllowedValueRecord | null>(null);
  const [valueLabel, setValueLabel] = useState('');
  const [valueCode, setValueCode] = useState('');
  const [valueDescription, setValueDescription] = useState('');
  const [valueSortOrder, setValueSortOrder] = useState('0');
  const [valueStatus, setValueStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [valueSaving, setValueSaving] = useState(false);
  const [valueFormError, setValueFormError] = useState('');

  const attributeDuplicate = useLikelyDuplicate({
    enabled: attributeFormOpen && !editingAttribute,
    name: attributeName,
    code: attributeCode,
    searchUrl: '/api/admin/catalog/attributes/page',
  });
  const groupDuplicate = useLikelyDuplicate({
    enabled: groupFormOpen && !editingGroup,
    name: groupName,
    code: groupCode,
    records: groups,
  });
  const valueDuplicate = useLikelyDuplicate({
    enabled: valueFormOpen && !editingValue,
    name: valueLabel,
    code: valueCode,
    records: values,
  });

  const attributeDrawerRef = useAdminOverlayKeyboard<HTMLElement>({
    open: attributeFormOpen,
    closeDisabled: attributeSaving,
    onClose: closeAttributeForm,
  });
  const groupDrawerRef = useAdminOverlayKeyboard<HTMLElement>({
    open: groupFormOpen,
    closeDisabled: groupSaving,
    onClose: closeGroupForm,
  });
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
          `/api/admin/preferences/saved-views?scope=${ATTRIBUTE_SAVED_VIEW_SCOPE}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) {
          throw new Error('Could not load Attribute Library saved views');
        }

        const views = (await response.json()) as AdminSavedViewRecord[];
        if (active) setSavedViews(views);
      } catch {
        if (active) {
          setSavedViewError(
            'Saved views could not be loaded. Attribute Library is still available.',
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
      setLoading(false);
      return;
    }

    let active = true;

    async function loadLibraryIndex() {
      setLoading(true);
      setLoadError('');

      try {
        const [groupsResponse, summaryResponse] = await Promise.all([
          fetch('/api/admin/catalog/attribute-groups', {
            credentials: 'same-origin',
            cache: 'no-store',
          }),
          fetch('/api/admin/catalog/attributes/summary', {
            credentials: 'same-origin',
            cache: 'no-store',
          }),
        ]);

        if (!groupsResponse.ok || !summaryResponse.ok) {
          throw new Error('Attribute Library index could not be loaded');
        }

        const [groupData, summaryData] = await Promise.all([
          groupsResponse.json() as Promise<AttributeGroupRecord[]>,
          summaryResponse.json() as Promise<AttributeDefinitionSummary>,
        ]);

        if (!active) return;
        setGroups(groupData);
        setAttributeSummary(summaryData);
      } catch {
        if (active) {
          setLoadError(
            'Attribute Library could not be loaded. Reload the page and try again.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLibraryIndex();

    return () => {
      active = false;
    };
  }, [canManage, summaryReloadKey]);

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
        const searchValue = search.trim();
        if (searchValue) query.set('search', searchValue);
        if (selectedGroupId === 'UNGROUPED') {
          query.set('ungrouped', 'true');
        } else if (selectedGroupId !== 'ALL') {
          query.set('groupId', selectedGroupId);
        }
        if (statusFilter !== 'ALL') query.set('status', statusFilter);
        if (scopeFilter !== 'ALL') query.set('scope', scopeFilter);
        if (dataTypeFilter !== 'ALL') query.set('dataType', dataTypeFilter);
        query.set('sortBy', sortBy);
        query.set('sortDirection', sortDirection);

        const response = await fetch(
          `/api/admin/catalog/attributes/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Attribute page could not be loaded');

        const page = (await response.json()) as AttributeDefinitionPage;
        if (!active) return;

        setAttributes(page.items);
        setLibraryTotal(page.total);
        setLibraryPageCount(page.pageCount);
        setSelectedAttributeId((current) =>
          current && page.items.some((item) => item.id === current)
            ? current
            : '',
        );

        if (page.pageCount > 0 && libraryPageNumber > page.pageCount) {
          setLibraryPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setLibraryError(
            'Attribute Definitions could not be loaded. Change the filters or retry.',
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
    dataTypeFilter,
    libraryPageNumber,
    libraryPageSize,
    libraryReloadKey,
    scopeFilter,
    search,
    selectedGroupId,
    sortBy,
    sortDirection,
    statusFilter,
  ]);

  const selectedAttribute =
    attributes.find((attribute) => attribute.id === selectedAttributeId) ?? null;
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? null;
  const valueDrawerRef = useAdminOverlayKeyboard<HTMLElement>({
    open: valueFormOpen && Boolean(selectedAttribute),
    closeDisabled: valueSaving,
    onClose: closeValueForm,
  });

  useEffect(() => {
    if (!selectedAttribute || !isStaticValueAttribute(selectedAttribute)) {
      setValues([]);
      setValuesError('');
      setValueFormOpen(false);
      return;
    }

    const attributeId = selectedAttribute.id;
    let active = true;

    async function loadValues() {
      try {
        setValuesLoading(true);
        setValuesError('');
        const response = await fetch(
          `/api/admin/catalog/attributes/${attributeId}/values`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load values');
        const data = (await response.json()) as AttributeAllowedValueRecord[];
        if (active) setValues(data);
      } catch {
        if (active) {
          setValuesError('Allowed values could not be loaded.');
        }
      } finally {
        if (active) setValuesLoading(false);
      }
    }

    void loadValues();

    return () => {
      active = false;
    };
  }, [selectedAttribute]);

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name) ||
          a.code.localeCompare(b.code),
      ),
    [groups],
  );

  const groupCounts = useMemo(() => {
    const result = new Map<string, number>(
      Object.entries(attributeSummary.groupCounts),
    );
    result.set('UNGROUPED', attributeSummary.ungrouped);
    return result;
  }, [attributeSummary]);

  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const visibleAttributes = attributes;

  const importPreviewRows = useMemo(() => {
    if (!importPreview) return [];
    const invalid = importPreview.rows.filter((row) => row.errors.length > 0);
    const valid = importPreview.rows.filter((row) => row.errors.length === 0);
    return [...invalid, ...valid].slice(0, 50);
  }, [importPreview]);

  const sortedValues = useMemo(
    () =>
      [...values].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label) ||
          a.code.localeCompare(b.code),
      ),
    [values],
  );

  function currentLibraryQuery(): URLSearchParams {
    const query = new URLSearchParams();
    const searchValue = search.trim();
    if (searchValue) query.set('search', searchValue);
    if (selectedGroupId === 'UNGROUPED') {
      query.set('ungrouped', 'true');
    } else if (selectedGroupId !== 'ALL') {
      query.set('groupId', selectedGroupId);
    }
    if (statusFilter !== 'ALL') query.set('status', statusFilter);
    if (scopeFilter !== 'ALL') query.set('scope', scopeFilter);
    if (dataTypeFilter !== 'ALL') query.set('dataType', dataTypeFilter);
    query.set('sortBy', sortBy);
    query.set('sortDirection', sortDirection);
    return query;
  }

  async function exportAttributeCsv() {
    setExportBusy(true);
    setImportError('');
    try {
      const query = currentLibraryQuery();
      const response = await fetch(
        `/api/admin/catalog/attributes/export?${query.toString()}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );
      if (!response.ok) {
        throw new Error('Attribute CSV export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lemekinaye-attributes.csv';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setImportOpen(true);
      setImportError(
        'The filtered Attribute Library could not be exported. Try again.',
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
      const preview = await postJson<AttributeCsvImportPreviewResponse>(
        '/api/admin/catalog/attributes/import/preview',
        { csv, fileName: file.name },
      );
      setImportCsv(csv);
      setImportPreview(preview);
    } catch (error) {
      setImportError(
        error instanceof ClientApiError
          ? error.message
          : 'The Attribute CSV could not be previewed.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function commitAttributeImport() {
    if (!importCsv || !importPreview || importPreview.invalidRows > 0) return;

    setImportBusy(true);
    setImportError('');
    setImportSuccess('');
    try {
      const result = await postJson<AttributeCsvImportCommitResponse>(
        '/api/admin/catalog/attributes/import/commit',
        { csv: importCsv, fileName: importFileName },
      );
      setImportSuccess(
        `${result.createdCount} ${result.createdCount === 1 ? 'Attribute' : 'Attributes'} imported successfully.`,
      );
      setImportCsv('');
      setImportPreview(null);
      setImportFileName('');
      setSelectedAttributeId('');
      setLibraryPageNumber(1);
      setLibraryReloadKey((current) => current + 1);
      setSummaryReloadKey((current) => current + 1);
    } catch (error) {
      setImportError(
        error instanceof ClientApiError
          ? error.message
          : 'The Attribute CSV import could not be committed.',
      );
    } finally {
      setImportBusy(false);
    }
  }

  function resetLibraryFilters() {
    setSelectedGroupId('ALL');
    setSelectedAttributeId('');
    setSearch('');
    setStatusFilter('ALL');
    setScopeFilter('ALL');
    setDataTypeFilter('ALL');
    setLibraryPageNumber(1);
    setSelectedSavedViewId('');
    setSavedViewName('');
  }

  function currentAttributeSavedViewState(): Record<string, unknown> {
    return {
      search,
      groupId: selectedGroupId,
      status: statusFilter,
      scope: scopeFilter,
      dataType: dataTypeFilter,
      sortBy,
      sortDirection,
      pageSize: libraryPageSize,
    };
  }

  function applyAttributeSavedView(view: AdminSavedViewRecord) {
    const state = view.state;
    const requestedGroupId =
      typeof state.groupId === 'string' ? state.groupId : 'ALL';
    const safeGroupId =
      requestedGroupId === 'ALL' ||
      requestedGroupId === 'UNGROUPED' ||
      groups.some((group) => group.id === requestedGroupId)
        ? requestedGroupId
        : 'ALL';

    setSearch(typeof state.search === 'string' ? state.search : '');
    setSelectedGroupId(safeGroupId);
    setStatusFilter(
      isAttributeStatusFilter(state.status) ? state.status : 'ALL',
    );
    setScopeFilter(isAttributeScopeFilter(state.scope) ? state.scope : 'ALL');
    setDataTypeFilter(
      isAttributeDataTypeFilter(state.dataType) ? state.dataType : 'ALL',
    );
    setSortBy(isAttributeSortBy(state.sortBy) ? state.sortBy : 'NAME');
    setSortDirection(state.sortDirection === 'DESC' ? 'DESC' : 'ASC');
    setLibraryPageSize(normalizeAdminPageSize(state.pageSize));
    setSelectedAttributeId('');
    setLibraryPageNumber(1);
    setSelectedSavedViewId(view.id);
    setSavedViewName(view.name);
    setSavedViewError('');
  }

  async function saveAttributeView() {
    const viewName = savedViewName.trim();
    if (!viewName) {
      setSavedViewError('Enter a name for the saved view.');
      return;
    }

    setSavedViewSaving(true);
    setSavedViewError('');
    try {
      const created = await postJson<AdminSavedViewRecord>(
        '/api/admin/preferences/saved-views',
        {
          scope: ATTRIBUTE_SAVED_VIEW_SCOPE,
          name: viewName,
          state: currentAttributeSavedViewState(),
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
          : 'The current Attribute Library view could not be saved.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function updateAttributeSavedView() {
    const selected = savedViews.find(
      (view) => view.id === selectedSavedViewId,
    );
    const viewName = savedViewName.trim();
    if (!selected) {
      setSavedViewError('Choose a saved view to update.');
      return;
    }
    if (!viewName) {
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
          name: viewName,
          state: currentAttributeSavedViewState(),
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
          : 'The saved Attribute Library view could not be updated.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function deleteAttributeSavedView() {
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
          payload?.error?.message ??
            'The saved Attribute Library view could not be deleted.',
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
          : 'The saved Attribute Library view could not be deleted.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedAttributeId('');
    setSearch('');
    setLibraryPageNumber(1);
  }

  function selectAttribute(attribute: AttributeDefinitionRecord) {
    setSelectedAttributeId(attribute.id);
    setValueFormOpen(false);
    setEditingValue(null);
    setValueFormError('');
  }

  function openCreateAttribute() {
    setEditingAttribute(null);
    setAttributeName('');
    setAttributeCode('');
    setAttributeGroupId(
      selectedGroupId !== 'ALL' && selectedGroupId !== 'UNGROUPED'
        ? selectedGroupId
        : '',
    );
    setDataType('TEXT');
    setScope('PRODUCT');
    setValueSource('NONE');
    setUnit('');
    setExampleValue('');
    setAttributeDescription('');
    setRepeatable(false);
    setTranslatable(false);
    setAttributeStatus('DRAFT');
    setAttributeFormError('');
    setAttributeFormOpen(true);
  }

  function openEditAttribute(attribute: AttributeDefinitionRecord) {
    setEditingAttribute(attribute);
    setAttributeName(attribute.name);
    setAttributeCode(attribute.code);
    setAttributeGroupId(attribute.groupId ?? '');
    setDataType(attribute.dataType);
    setScope(attribute.scope);
    setValueSource(attribute.valueSource);
    setUnit(attribute.unit ?? '');
    setExampleValue(attribute.exampleValue ?? '');
    setAttributeDescription(attribute.description ?? '');
    setRepeatable(attribute.repeatable);
    setTranslatable(attribute.translatable);
    setAttributeStatus(attribute.status);
    setAttributeFormError('');
    setAttributeFormOpen(true);
  }

  function closeAttributeForm() {
    if (attributeSaving) return;
    setAttributeFormOpen(false);
    setEditingAttribute(null);
    setAttributeFormError('');
  }

  function closeGroupForm() {
    if (groupSaving) return;
    setGroupFormOpen(false);
    setEditingGroup(null);
    setGroupFormError('');
  }

  function closeValueForm() {
    if (valueSaving) return;
    setValueFormOpen(false);
    setEditingValue(null);
    setValueFormError('');
  }

  function handleAttributeNameChange(value: string) {
    setAttributeName(value);
    if (!editingAttribute && !attributeCode) {
      setAttributeCode(createAttributeCode(value));
    }
  }

  async function saveAttribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttributeSaving(true);
    setAttributeFormError('');

    try {
      if (editingAttribute) {
        const input: UpdateAttributeDefinitionInput = {
          version: editingAttribute.version,
          name: attributeName.trim(),
          groupId: attributeGroupId || null,
          unit: unit.trim() || null,
          description: attributeDescription.trim() || null,
          exampleValue: exampleValue.trim() || null,
          repeatable,
          translatable,
          status: attributeStatus,
        };

        const updated = await patchJson<AttributeDefinitionRecord>(
          `/api/admin/catalog/attributes/${editingAttribute.id}`,
          input,
        );
        setAttributes((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSelectedAttributeId(updated.id);
        setLibraryReloadKey((current) => current + 1);
        setSummaryReloadKey((current) => current + 1);
      } else {
        const input: CreateAttributeDefinitionInput = {
          code: attributeCode.trim().toUpperCase(),
          name: attributeName.trim(),
          groupId: attributeGroupId || null,
          dataType,
          scope,
          valueSource,
          unit: unit.trim() || null,
          description: attributeDescription.trim() || null,
          exampleValue: exampleValue.trim() || null,
          repeatable,
          translatable,
          status: attributeStatus,
        };

        const created = await postJson<AttributeDefinitionRecord>(
          '/api/admin/catalog/attributes',
          input,
        );
        setAttributes([created]);
        setSelectedAttributeId(created.id);
        setSelectedGroupId(created.groupId ?? 'UNGROUPED');
        setLibraryPageNumber(1);
        setLibraryReloadKey((current) => current + 1);
        setSummaryReloadKey((current) => current + 1);
      }

      setAttributeFormOpen(false);
      setEditingAttribute(null);
    } catch (requestError) {
      if (requestError instanceof ClientApiError) {
        setAttributeFormError(requestError.message);
      } else {
        setAttributeFormError('The Attribute could not be saved.');
      }
    } finally {
      setAttributeSaving(false);
    }
  }

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupName('');
    setGroupCode('');
    setGroupDescription('');
    setGroupSortOrder(String((sortedGroups.at(-1)?.sortOrder ?? 0) + 10));
    setGroupStatus('DRAFT');
    setGroupFormError('');
    setGroupFormOpen(true);
  }

  function openEditGroup() {
    if (!selectedGroup) return;
    setEditingGroup(selectedGroup);
    setGroupName(selectedGroup.name);
    setGroupCode(selectedGroup.code);
    setGroupDescription(selectedGroup.description ?? '');
    setGroupSortOrder(String(selectedGroup.sortOrder));
    setGroupStatus(selectedGroup.status);
    setGroupFormError('');
    setGroupFormOpen(true);
  }

  function handleGroupNameChange(value: string) {
    setGroupName(value);
    if (!editingGroup && !groupCode) {
      setGroupCode(createGroupCode(value));
    }
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupSaving(true);
    setGroupFormError('');

    try {
      if (editingGroup) {
        const input: UpdateAttributeGroupInput = {
          version: editingGroup.version,
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          sortOrder: Number(groupSortOrder) || 0,
          status: groupStatus,
        };
        const updated = await patchJson<AttributeGroupRecord>(
          `/api/admin/catalog/attribute-groups/${editingGroup.id}`,
          input,
        );
        setGroups((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const input: CreateAttributeGroupInput = {
          code: groupCode.trim().toUpperCase(),
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          sortOrder: Number(groupSortOrder) || 0,
          status: groupStatus,
        };
        const created = await postJson<AttributeGroupRecord>(
          '/api/admin/catalog/attribute-groups',
          input,
        );
        setGroups((current) => [...current, created]);
        setSelectedGroupId(created.id);
      }
      setGroupFormOpen(false);
      setEditingGroup(null);
    } catch (requestError) {
      if (requestError instanceof ClientApiError) {
        setGroupFormError(requestError.message);
      } else {
        setGroupFormError('The Attribute Group could not be saved.');
      }
    } finally {
      setGroupSaving(false);
    }
  }

  function openCreateValue() {
    if (!selectedAttribute) return;
    setEditingValue(null);
    setValueLabel('');
    setValueCode('');
    setValueDescription('');
    setValueSortOrder(
      String((sortedValues.at(-1)?.sortOrder ?? 0) + 10),
    );
    setValueStatus(
      selectedAttribute.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
    );
    setValueFormError('');
    setValueFormOpen(true);
  }

  function openEditValue(value: AttributeAllowedValueRecord) {
    setEditingValue(value);
    setValueLabel(value.label);
    setValueCode(value.code);
    setValueDescription(value.description ?? '');
    setValueSortOrder(String(value.sortOrder));
    setValueStatus(value.status);
    setValueFormError('');
    setValueFormOpen(true);
  }

  function handleValueLabelChange(value: string) {
    setValueLabel(value);
    if (!editingValue && !valueCode) {
      setValueCode(createAllowedValueCode(value));
    }
  }

  async function saveValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAttribute) return;

    setValueSaving(true);
    setValueFormError('');

    try {
      if (editingValue) {
        const input: UpdateAttributeAllowedValueInput = {
          version: editingValue.version,
          label: valueLabel.trim(),
          description: valueDescription.trim() || null,
          sortOrder: Number(valueSortOrder) || 0,
          status: valueStatus,
        };
        const updated = await patchJson<AttributeAllowedValueRecord>(
          `/api/admin/catalog/attributes/${selectedAttribute.id}/values/${editingValue.id}`,
          input,
        );
        setValues((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const input: CreateAttributeAllowedValueInput = {
          code: valueCode.trim().toUpperCase(),
          label: valueLabel.trim(),
          description: valueDescription.trim() || null,
          sortOrder: Number(valueSortOrder) || 0,
          status: valueStatus,
        };
        const created = await postJson<AttributeAllowedValueRecord>(
          `/api/admin/catalog/attributes/${selectedAttribute.id}/values`,
          input,
        );
        setValues((current) => [...current, created]);
      }

      setValueFormOpen(false);
      setEditingValue(null);
    } catch (requestError) {
      if (requestError instanceof ClientApiError) {
        setValueFormError(requestError.message);
      } else {
        setValueFormError('The allowed value could not be saved.');
      }
    } finally {
      setValueSaving(false);
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Catalog management</span>
        <h1>Attribute Library</h1>
        <p>
          Your administrator account does not have the catalog.manage
          permission.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page attribute-library-v2">
      <AdminPageHeader
        eyebrow="Attribute master"
        title="Attribute Library"
        description="Maintain reusable technical specifications by domain. Article identity, structured fitment, media, pricing, inventory, and seller commercial data use their dedicated workflows."
        actions={
          <>
            <button
              className="button button--quiet"
              type="button"
              disabled={exportBusy}
              onClick={() => void exportAttributeCsv()}
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
            <button
              className="button button--primary"
              type="button"
              onClick={openCreateAttribute}
            >
              + Add Attribute
            </button>
          </>
        }
      />

      <CatalogPrimaryNav active="attributes" />

      {loading ? (
        <div className="catalog-state">
          <span className="spinner spinner--dark" aria-hidden="true" />
          <p>Loading grouped Attribute Library…</p>
        </div>
      ) : null}

      {loadError ? (
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      ) : null}

      {!loading && !loadError && attributeSummary.total > 0 ? (
        <>
          <div className="attribute-library-summary">
            <div>
              <span>Groups</span>
              <strong>{groups.length}</strong>
            </div>
            <div>
              <span>Attributes</span>
              <strong>{attributeSummary.total}</strong>
            </div>
            <div>
              <span>Ungrouped</span>
              <strong>{attributeSummary.ungrouped}</strong>
            </div>
            <div>
              <span>Selected</span>
              <strong>
                {selectedGroup?.name ??
                  (selectedGroupId === 'UNGROUPED'
                    ? 'Ungrouped'
                    : 'All Attributes')}
              </strong>
            </div>
          </div>

          {importOpen ? (
            <section className="attribute-import-panel" aria-label="Attribute CSV import">
              <div className="attribute-import-panel__heading">
                <div>
                  <strong>CSV import</strong>
                  <small>
                    Export the current library for the canonical column format.
                    Preview validates every row before any data is written.
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
                  aria-label="Choose Attribute CSV file"
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
                    <span>
                      <strong>{importPreview.totalRows}</strong> rows
                    </span>
                    <span>
                      <strong>{importPreview.validRows}</strong> valid
                    </span>
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
                          <strong>{row.name || 'Unnamed Attribute'}</strong>
                          <small>
                            {row.code || 'Missing code'} · {row.groupCode || 'Ungrouped'} ·{' '}
                            {row.dataType || 'Missing type'} · {row.scope || 'Missing scope'} ·{' '}
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
                      onClick={() => void commitAttributeImport()}
                    >
                      {importBusy
                        ? 'Importing…'
                        : `Import ${importPreview.validRows} ${importPreview.validRows === 1 ? 'Attribute' : 'Attributes'}`}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          <AdminSavedViewsToolbar
            idPrefix="attribute-library"
            savedViews={savedViews}
            loading={savedViewsLoading}
            saving={savedViewSaving}
            selectedId={selectedSavedViewId}
            name={savedViewName}
            namePlaceholder="Active vehicle dimensions"
            error={savedViewError}
            onSelect={(view) => {
              if (view) applyAttributeSavedView(view);
              else {
                setSelectedSavedViewId('');
                setSavedViewName('');
              }
            }}
            onNameChange={setSavedViewName}
            onSaveAsNew={() => void saveAttributeView()}
            onUpdate={() => void updateAttributeSavedView()}
            onDelete={() => void deleteAttributeSavedView()}
          />

          <div className="attribute-library-grid">
            <aside className="attribute-library-groups attribute-library-groups--compact">
              <div className="attribute-library-pane-heading">
                <div>
                  <strong>Attribute Groups</strong>
                  <small>Search the library instead of scrolling long group lists</small>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={openCreateGroup}
                >
                  + Group
                </button>
              </div>

              <div className="attribute-library-group-selector">
                <span className="field__label">Technical domain</span>
                <AdminSearchableCombobox
                  id="attribute-library-group-filter"
                  value={selectedGroupId}
                  options={[
                    {
                      id: 'ALL',
                      label: 'All Attributes',
                      meta: `${attributeSummary.total} total`,
                    },
                    ...sortedGroups.map((group) => ({
                      id: group.id,
                      label: group.name,
                      meta: `${group.code} · ${groupCounts.get(group.id) ?? 0} attributes`,
                      keywords: [group.code],
                    })),
                    ...(attributeSummary.ungrouped > 0
                      ? [
                          {
                            id: 'UNGROUPED',
                            label: 'Ungrouped',
                            meta: `${attributeSummary.ungrouped} need classification`,
                          },
                        ]
                      : []),
                  ]}
                  placeholder="Choose Attribute Group"
                  searchPlaceholder="Search Attribute Groups…"
                  onChange={selectGroup}
                />
              </div>

              <div className="attribute-library-group-context">
                <span>Current filter</span>
                <strong>
                  {selectedGroup?.name ??
                    (selectedGroupId === 'UNGROUPED'
                      ? 'Ungrouped'
                      : 'All Attributes')}
                </strong>
                <small>{libraryTotal} matching Attributes</small>
              </div>

              {selectedGroup ? (
                <div className="attribute-library-group-actions">
                  <button
                    className="attribute-library-edit-group"
                    type="button"
                    onClick={openEditGroup}
                  >
                    Edit selected group
                  </button>
                  <AdminMasterLifecycleActions
                    domain="CATALOG"
                    entityType="ATTRIBUTE_GROUP"
                    entityId={selectedGroup.id}
                    entityName={selectedGroup.name}
                    status={selectedGroup.status}
                    version={selectedGroup.version}
                    reactivatePath={`/api/admin/catalog/attribute-groups/${selectedGroup.id}`}
                    disabled={!canManage}
                    onCompleted={() => {
                      setLibraryReloadKey((current) => current + 1);
                      setSummaryReloadKey((current) => current + 1);
                    }}
                  />
                </div>
              ) : null}
            </aside>

            <section className="attribute-library-list-pane">
              <div className="attribute-library-pane-heading">
                <div>
                  <strong>
                    {selectedGroup?.name ??
                      (selectedGroupId === 'UNGROUPED'
                        ? 'Ungrouped Attributes'
                        : 'Attribute Definitions')}
                  </strong>
                  <small>{libraryTotal} matching</small>
                </div>
              </div>

              <div className="attribute-library-toolbar">
                <label className="attribute-library-search">
                  <span>Search</span>
                  <input
                    type="search"
                    value={search}
                    placeholder="Name, code, description…"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setLibraryPageNumber(1);
                    }}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as FilterStatus);
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
                <label>
                  <span>Scope</span>
                  <select
                    value={scopeFilter}
                    onChange={(event) => {
                      setScopeFilter(event.target.value as FilterScope);
                      setLibraryPageNumber(1);
                    }}
                  >
                    <option value="ALL">All</option>
                    {scopes.map((item) => (
                      <option value={item} key={item}>
                        {prettyLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Type</span>
                  <select
                    value={dataTypeFilter}
                    onChange={(event) => {
                      setDataTypeFilter(event.target.value as FilterDataType);
                      setLibraryPageNumber(1);
                    }}
                  >
                    <option value="ALL">All</option>
                    {dataTypes.map((item) => (
                      <option value={item} key={item}>
                        {prettyLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setSortBy(event.target.value as AttributeAdminSortBy);
                      setLibraryPageNumber(1);
                    }}
                  >
                    {attributeSortOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Direction</span>
                  <select
                    value={sortDirection}
                    onChange={(event) => {
                      setSortDirection(event.target.value as SortDirection);
                      setLibraryPageNumber(1);
                    }}
                  >
                    <option value="ASC">Ascending</option>
                    <option value="DESC">Descending</option>
                  </select>
                </label>
                <AdminFilterResetButton
                  active={Boolean(
                    selectedGroupId !== 'ALL' ||
                      search.trim() ||
                      statusFilter !== 'ALL' ||
                      scopeFilter !== 'ALL' ||
                      dataTypeFilter !== 'ALL',
                  )}
                  onReset={resetLibraryFilters}
                />
              </div>

              {libraryLoading ? (
                <div className="catalog-state" aria-live="polite">
                  <span className="spinner spinner--dark" aria-hidden="true" />
                  <p>Loading Attribute Definitions…</p>
                </div>
              ) : null}

              {libraryError ? (
                <div className="alert alert--error" role="alert">
                  {libraryError}
                </div>
              ) : null}

              {!libraryLoading &&
              !libraryError &&
              visibleAttributes.length === 0 ? (
                <div className="catalog-workspace-empty">
                  <strong>No matching Attributes</strong>
                  <p>Change the filters or add an Attribute to this group.</p>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={openCreateAttribute}
                  >
                    + Add Attribute
                  </button>
                </div>
              ) : !libraryError && visibleAttributes.length > 0 ? (
                <div className="admin-library-table attribute-library-list">
                  <div
                    className="admin-library-table__row admin-library-table__row--header attribute-library-table-row"
                    aria-hidden="true"
                  >
                    <span>Attribute</span>
                    <span>Group</span>
                    <span>Type</span>
                    <span>Scope</span>
                    <span>Status</span>
                  </div>

                  {visibleAttributes.map((attribute) => (
                    <button
                      className={
                        selectedAttributeId === attribute.id
                          ? 'admin-library-table__row attribute-library-table-row is-selected'
                          : 'admin-library-table__row attribute-library-table-row'
                      }
                      type="button"
                      key={attribute.id}
                      onClick={() => selectAttribute(attribute)}
                    >
                      <span className="admin-library-table__primary">
                        <strong>{attribute.name}</strong>
                        <small>{attribute.code}</small>
                      </span>
                      <span>
                        {attribute.groupId
                          ? groupNameById.get(attribute.groupId) ?? 'Unknown group'
                          : 'Ungrouped'}
                      </span>
                      <span>{prettyLabel(attribute.dataType)}</span>
                      <span>{prettyLabel(attribute.scope)}</span>
                      <span>
                        <AdminStatusBadge
                          status={attribute.status}
                          label={prettyLabel(attribute.status)}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {!libraryError && libraryTotal > 0 ? (
                <AdminLibraryPagination
                  page={libraryPageNumber}
                  pageCount={libraryPageCount}
                  pageSize={libraryPageSize}
                  total={libraryTotal}
                  disabled={libraryLoading}
                  onPageChange={setLibraryPageNumber}
                  onPageSizeChange={(nextPageSize) => {
                    setLibraryPageSize(nextPageSize);
                    setLibraryPageNumber(1);
                  }}
                />
              ) : null}
            </section>

            <aside className="attribute-library-detail">
              {!selectedAttribute ? (
                <div className="attribute-library-detail__empty">
                  <strong>Select an Attribute</strong>
                  <p>
                    Review its definition, group, value source, example and
                    controlled values here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="attribute-library-detail__heading">
                    <div>
                      <span className="eyebrow">Attribute Definition</span>
                      <h2>{selectedAttribute.name}</h2>
                      <code>{selectedAttribute.code}</code>
                    </div>
                    <div className="attribute-library-heading-actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => openEditAttribute(selectedAttribute)}
                    >
                      Edit
                    </button>
                      <AdminMasterLifecycleActions
                        domain="CATALOG"
                        entityType="ATTRIBUTE_DEFINITION"
                        entityId={selectedAttribute.id}
                        entityName={selectedAttribute.name}
                        status={selectedAttribute.status}
                        version={selectedAttribute.version}
                        reactivatePath={`/api/admin/catalog/attributes/${selectedAttribute.id}`}
                        disabled={!canManage}
                        onCompleted={() => {
                          setLibraryReloadKey((current) => current + 1);
                          setSummaryReloadKey((current) => current + 1);
                        }}
                      />
                    </div>
                  </div>

                  <div className="attribute-library-badges">
                    <span>{prettyLabel(selectedAttribute.dataType)}</span>
                    <span>{prettyLabel(selectedAttribute.scope)}</span>
                    <span>{prettyLabel(selectedAttribute.valueSource)}</span>
                    <span>{selectedAttribute.status}</span>
                  </div>

                  <dl className="attribute-library-definition">
                    <div>
                      <dt>Group</dt>
                      <dd>
                        {groups.find(
                          (group) => group.id === selectedAttribute.groupId,
                        )?.name ?? 'Ungrouped'}
                      </dd>
                    </div>
                    <div>
                      <dt>Example</dt>
                      <dd>{selectedAttribute.exampleValue || '—'}</dd>
                    </div>
                    <div>
                      <dt>Unit</dt>
                      <dd>{selectedAttribute.unit || '—'}</dd>
                    </div>
                    <div>
                      <dt>Repeatable</dt>
                      <dd>{selectedAttribute.repeatable ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Translatable</dt>
                      <dd>{selectedAttribute.translatable ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Option Set</dt>
                      <dd>
                        {selectedAttribute.optionSetId
                          ? 'Linked'
                          : 'Not linked'}
                      </dd>
                    </div>
                    <div>
                      <dt>Unit Dimension</dt>
                      <dd>
                        {selectedAttribute.unitDimensionId
                          ? 'Linked'
                          : 'Not linked'}
                      </dd>
                    </div>
                  </dl>

                  {selectedAttribute.description ? (
                    <div className="attribute-library-description">
                      <span>Definition</span>
                      <p>{selectedAttribute.description}</p>
                    </div>
                  ) : null}

                  <section className="attribute-library-values">
                    <div className="attribute-library-values__heading">
                      <div>
                        <strong>Controlled values</strong>
                        <small>
                          {isStaticValueAttribute(selectedAttribute)
                            ? 'STATIC Attribute values'
                            : `${prettyLabel(selectedAttribute.valueSource)} value source`}
                        </small>
                      </div>
                      {isStaticValueAttribute(selectedAttribute) ? (
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={openCreateValue}
                        >
                          + Value
                        </button>
                      ) : null}
                    </div>

                    {!isStaticValueAttribute(selectedAttribute) ? (
                      <p className="attribute-library-values__note">
                        Values are not maintained as a local STATIC list for
                        this Attribute.
                      </p>
                    ) : valuesLoading ? (
                      <div className="catalog-state">
                        <span
                          className="spinner spinner--dark"
                          aria-hidden="true"
                        />
                      </div>
                    ) : valuesError ? (
                      <div className="alert alert--error">{valuesError}</div>
                    ) : sortedValues.length === 0 ? (
                      <p className="attribute-library-values__note">
                        No controlled values yet.
                      </p>
                    ) : (
                      <div className="attribute-library-value-list">
                        {sortedValues.map((value) => (
                          <div
                            className="attribute-library-value-list__row"
                            key={value.id}
                          >
                            <button
                              className="attribute-library-value-list__edit"
                              type="button"
                              onClick={() => openEditValue(value)}
                            >
                              <span>
                                <strong>{value.label}</strong>
                                <small>{value.code}</small>
                              </span>
                              <AdminStatusBadge
                                status={value.status}
                                label={value.status}
                              />
                            </button>
                            <AdminMasterLifecycleActions
                              domain="CATALOG"
                              entityType="ATTRIBUTE_ALLOWED_VALUE"
                              entityId={value.id}
                              entityName={value.label}
                              status={value.status}
                              version={value.version}
                              reactivatePath={`/api/admin/catalog/attributes/${selectedAttribute.id}/values/${value.id}`}
                              disabled={!canManage}
                              onCompleted={() => {
                                setLibraryReloadKey((current) => current + 1);
                                setSummaryReloadKey((current) => current + 1);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </aside>
          </div>
        </>
      ) : null}

      {!loading && !loadError && attributeSummary.total === 0 ? (
        <div className="catalog-empty">
          <h2>No Attribute Definitions</h2>
          <p>Create the first reusable automotive Attribute Definition.</p>
          <button
            className="button button--primary"
            type="button"
            onClick={openCreateAttribute}
          >
            + Add Attribute
          </button>
        </div>
      ) : null}

      {attributeFormOpen ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Attribute editor"
            onClick={attributeDrawerRef.requestClose}
          />
          <aside
            ref={attributeDrawerRef}
            className="catalog-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attribute-editor-title"
            tabIndex={-1}
          >
            <form className="catalog-drawer__form" onSubmit={saveAttribute}>
              <div className="catalog-drawer__heading">
                <div>
                  <span className="eyebrow">
                    {editingAttribute ? 'Edit Attribute' : 'New Attribute'}
                  </span>
                  <h2 id="attribute-editor-title">
                    {editingAttribute
                      ? editingAttribute.name
                      : 'Create Attribute Definition'}
                  </h2>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={attributeSaving}
                  onClick={attributeDrawerRef.requestClose}
                >
                  Close
                </button>
              </div>

              {attributeFormError ? (
                <div className="alert alert--error">{attributeFormError}</div>
              ) : null}

              <div className="catalog-drawer__fields">
                <label className="field">
                  <span className="field__label">Attribute name</span>
                  <div className="field__control">
                    <input
                      data-admin-autofocus
                      required
                      maxLength={120}
                      value={attributeName}
                      placeholder="Example: Brake Disc Diameter"
                      onChange={(event) =>
                        handleAttributeNameChange(event.target.value)
                      }
                    />
                  </div>
                </label>

                <div className="field">
                  <span className="field__label">Attribute Group</span>
                  <AdminSearchableCombobox
                    id="attribute-editor-group"
                    value={attributeGroupId}
                    options={[
                      { id: '', label: 'Ungrouped' },
                      ...sortedGroups.map((group) => ({
                        id: group.id,
                        label: group.name,
                        meta: group.code,
                        keywords: [group.code],
                      })),
                    ]}
                    placeholder="Ungrouped"
                    searchPlaceholder="Search Attribute Groups…"
                    onChange={setAttributeGroupId}
                  />
                </div>

                <div className="catalog-drawer__two">
                  <label className="field">
                    <span className="field__label">Data type</span>
                    <select
                      className="category-form__select"
                      disabled={Boolean(editingAttribute)}
                      value={dataType}
                      onChange={(event) =>
                        setDataType(event.target.value as AttributeDataType)
                      }
                    >
                      {dataTypes.map((item) => (
                        <option value={item} key={item}>
                          {prettyLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field__label">Scope</span>
                    <select
                      className="category-form__select"
                      disabled={Boolean(editingAttribute)}
                      value={scope}
                      onChange={(event) =>
                        setScope(event.target.value as AttributeScope)
                      }
                    >
                      {scopes.map((item) => (
                        <option value={item} key={item}>
                          {prettyLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="catalog-drawer__two">
                  <label className="field">
                    <span className="field__label">Value source</span>
                    <select
                      className="category-form__select"
                      disabled={Boolean(editingAttribute)}
                      value={valueSource}
                      onChange={(event) =>
                        setValueSource(
                          event.target.value as AttributeValueSource,
                        )
                      }
                    >
                      {valueSources.map((item) => (
                        <option value={item} key={item}>
                          {prettyLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field__label">Status</span>
                    <select
                      className="category-form__select"
                      value={attributeStatus}
                      onChange={(event) =>
                        setAttributeStatus(
                          event.target.value as MasterDataStatus,
                        )
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </label>
                </div>

                <div className="catalog-drawer__two">
                  <label className="field">
                    <span className="field__label">Unit label</span>
                    <div className="field__control">
                      <input
                        maxLength={50}
                        value={unit}
                        placeholder="e.g. mm, V, A"
                        onChange={(event) => setUnit(event.target.value)}
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span className="field__label">Example value</span>
                    <div className="field__control">
                      <input
                        maxLength={300}
                        value={exampleValue}
                        placeholder="e.g. 280 mm"
                        onChange={(event) =>
                          setExampleValue(event.target.value)
                        }
                      />
                    </div>
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Definition</span>
                  <textarea
                    className="catalog-drawer__textarea"
                    maxLength={2000}
                    value={attributeDescription}
                    placeholder="Explain exactly what this automotive specification means."
                    onChange={(event) =>
                      setAttributeDescription(event.target.value)
                    }
                  />
                </label>

                <div className="attribute-library-flags">
                  <label>
                    <input
                      type="checkbox"
                      checked={repeatable}
                      onChange={(event) =>
                        setRepeatable(event.target.checked)
                      }
                    />
                    Repeatable
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={translatable}
                      onChange={(event) =>
                        setTranslatable(event.target.checked)
                      }
                    />
                    Translatable
                  </label>
                </div>

                <LikelyDuplicateWarning
                  match={attributeDuplicate.match}
                  checking={attributeDuplicate.checking}
                />

                <details className="catalog-workspace-advanced">
                  <summary>Advanced technical fields</summary>
                  <label className="field">
                    <span className="field__label">Canonical code</span>
                    <div className="field__control">
                      <input
                        required
                        disabled={Boolean(editingAttribute)}
                        maxLength={75}
                        value={attributeCode}
                        placeholder="ATTR_BRAKE_DISC_DIAMETER"
                        onChange={(event) =>
                          setAttributeCode(
                            createAttributeCode(event.target.value),
                          )
                        }
                      />
                    </div>
                  </label>
                  {editingAttribute ? (
                    <small className="field__hint">
                      Canonical code, data type, scope and value source stay
                      immutable after creation.
                    </small>
                  ) : null}
                </details>
              </div>

              <div className="catalog-drawer__actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={
                    attributeSaving ||
                    !attributeName.trim() ||
                    !attributeCode.trim()
                  }
                >
                  {attributeSaving
                    ? 'Saving…'
                    : editingAttribute
                      ? 'Save Attribute'
                      : 'Create Attribute'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {groupFormOpen ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Attribute Group editor"
            onClick={groupDrawerRef.requestClose}
          />
          <aside
            ref={groupDrawerRef}
            className="catalog-drawer catalog-drawer--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attribute-group-editor-title"
            tabIndex={-1}
          >
            <form className="catalog-drawer__form" onSubmit={saveGroup}>
              <div className="catalog-drawer__heading">
                <div>
                  <span className="eyebrow">
                    {editingGroup ? 'Edit Group' : 'New Group'}
                  </span>
                  <h2 id="attribute-group-editor-title">
                    {editingGroup
                      ? editingGroup.name
                      : 'Create Attribute Group'}
                  </h2>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={groupSaving}
                  onClick={groupDrawerRef.requestClose}
                >
                  Close
                </button>
              </div>

              {groupFormError ? (
                <div className="alert alert--error">{groupFormError}</div>
              ) : null}

              <div className="catalog-drawer__fields">
                <label className="field">
                  <span className="field__label">Group name</span>
                  <div className="field__control">
                    <input
                      data-admin-autofocus
                      required
                      value={groupName}
                      onChange={(event) =>
                        handleGroupNameChange(event.target.value)
                      }
                    />
                  </div>
                </label>

                <div className="catalog-drawer__two">
                  <label className="field">
                    <span className="field__label">Status</span>
                    <select
                      className="category-form__select"
                      value={groupStatus}
                      onChange={(event) =>
                        setGroupStatus(
                          event.target.value as MasterDataStatus,
                        )
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Description</span>
                  <textarea
                    className="catalog-drawer__textarea"
                    value={groupDescription}
                    onChange={(event) =>
                      setGroupDescription(event.target.value)
                    }
                  />
                </label>

                <LikelyDuplicateWarning
                  match={groupDuplicate.match}
                  checking={groupDuplicate.checking}
                />

                <details className="catalog-workspace-advanced">
                  <summary>Advanced technical fields</summary>
                  <div className="catalog-drawer__two">
                    <label className="field">
                      <span className="field__label">Canonical code</span>
                      <div className="field__control">
                        <input
                          required
                          disabled={Boolean(editingGroup)}
                          value={groupCode}
                          onChange={(event) =>
                            setGroupCode(createGroupCode(event.target.value))
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span className="field__label">Sort order</span>
                      <div className="field__control">
                        <input
                          type="number"
                          min="0"
                          value={groupSortOrder}
                          onChange={(event) =>
                            setGroupSortOrder(event.target.value)
                          }
                        />
                      </div>
                    </label>
                  </div>
                  <small className="field__hint">
                    The code is generated from the Group name and becomes
                    immutable after creation.
                  </small>
                </details>
              </div>

              <div className="catalog-drawer__actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={
                    groupSaving || !groupName.trim() || !groupCode.trim()
                  }
                >
                  {groupSaving
                    ? 'Saving…'
                    : editingGroup
                      ? 'Save Group'
                      : 'Create Group'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {valueFormOpen && selectedAttribute ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close value editor"
            onClick={valueDrawerRef.requestClose}
          />
          <aside
            ref={valueDrawerRef}
            className="catalog-drawer catalog-drawer--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attribute-value-editor-title"
            tabIndex={-1}
          >
            <form className="catalog-drawer__form" onSubmit={saveValue}>
              <div className="catalog-drawer__heading">
                <div>
                  <span className="eyebrow">
                    {editingValue ? 'Edit value' : 'New value'}
                  </span>
                  <h2 id="attribute-value-editor-title">
                    {selectedAttribute.name}
                  </h2>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={valueSaving}
                  onClick={valueDrawerRef.requestClose}
                >
                  Close
                </button>
              </div>

              {valueFormError ? (
                <div className="alert alert--error">{valueFormError}</div>
              ) : null}

              <div className="catalog-drawer__fields">
                <label className="field">
                  <span className="field__label">Label</span>
                  <div className="field__control">
                    <input
                      data-admin-autofocus
                      required
                      value={valueLabel}
                      onChange={(event) =>
                        handleValueLabelChange(event.target.value)
                      }
                    />
                  </div>
                </label>

                <div className="catalog-drawer__two">
                  <label className="field">
                    <span className="field__label">Status</span>
                    <select
                      className="category-form__select"
                      value={valueStatus}
                      onChange={(event) =>
                        setValueStatus(
                          event.target.value as MasterDataStatus,
                        )
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Description</span>
                  <textarea
                    className="catalog-drawer__textarea"
                    value={valueDescription}
                    onChange={(event) =>
                      setValueDescription(event.target.value)
                    }
                  />
                </label>

                <LikelyDuplicateWarning
                  match={valueDuplicate.match}
                  checking={valueDuplicate.checking}
                />

                <details className="catalog-workspace-advanced">
                  <summary>Advanced technical fields</summary>
                  <div className="catalog-drawer__two">
                    <label className="field">
                      <span className="field__label">Canonical code</span>
                      <div className="field__control">
                        <input
                          required
                          disabled={Boolean(editingValue)}
                          value={valueCode}
                          onChange={(event) =>
                            setValueCode(
                              createAllowedValueCode(event.target.value),
                            )
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span className="field__label">Sort order</span>
                      <div className="field__control">
                        <input
                          type="number"
                          min="0"
                          value={valueSortOrder}
                          onChange={(event) =>
                            setValueSortOrder(event.target.value)
                          }
                        />
                      </div>
                    </label>
                  </div>
                  <small className="field__hint">
                    The code is generated from the display label and becomes
                    immutable after creation.
                  </small>
                </details>
              </div>

              <div className="catalog-drawer__actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={valueSaving || !valueLabel.trim() || !valueCode}
                >
                  {valueSaving
                    ? 'Saving…'
                    : editingValue
                      ? 'Save value'
                      : 'Create value'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function isAttributeStatusFilter(value: unknown): value is FilterStatus {
  return (
    value === 'ALL' ||
    (typeof value === 'string' &&
      attributeStatuses.includes(value as MasterDataStatus))
  );
}

function isAttributeScopeFilter(value: unknown): value is FilterScope {
  return (
    value === 'ALL' ||
    (typeof value === 'string' && scopes.includes(value as AttributeScope))
  );
}

function isAttributeDataTypeFilter(value: unknown): value is FilterDataType {
  return (
    value === 'ALL' ||
    (typeof value === 'string' &&
      dataTypes.includes(value as AttributeDataType))
  );
}

function isAttributeSortBy(value: unknown): value is AttributeAdminSortBy {
  return (
    typeof value === 'string' &&
    attributeSortOptions.some((option) => option.value === value)
  );
}

function prettyLabel(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createGroupCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
