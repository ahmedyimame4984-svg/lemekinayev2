'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import type {
  BulkUpdateSupplierStatusInput,
  CreateSupplierInput,
  SupplierBulkStatusResult,
  SupplierPage,
  SupplierRecord,
  SupplierType,
  UpdateSupplierInput,
} from '@/lib/sourcing-contracts';
import { AdminSavedViewsToolbar } from './admin-saved-views-toolbar';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import {
  AdminLibraryCount,
  AdminLibraryPagination,
  AdminLibraryToolbar,
  normalizeAdminPageSize,
  type AdminPageSize,
} from './admin-library-shell';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { useAdminPrincipal } from './admin-session';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import {
  adminBulkLifecycleConfirmationMessage,
  requiresAdminBulkLifecycleConfirmation,
} from '@/lib/admin-change-safety';

type SupplierStatusFilter = 'ALL' | MasterDataStatus;
type SupplierAdminSortBy =
  | 'NAME'
  | 'CODE'
  | 'SUPPLIER_TYPE'
  | 'COUNTRY_CODE'
  | 'STATUS'
  | 'UPDATED_AT'
  | 'CREATED_AT';
type SortDirection = 'ASC' | 'DESC';

const SUPPLIER_SAVED_VIEW_SCOPE = 'SOURCING_SUPPLIERS';

const supplierSortOptions: Array<{ value: SupplierAdminSortBy; label: string }> = [
  { value: 'NAME', label: 'Supplier name' },
  { value: 'CODE', label: 'Supplier code' },
  { value: 'SUPPLIER_TYPE', label: 'Supplier type' },
  { value: 'COUNTRY_CODE', label: 'Country' },
  { value: 'STATUS', label: 'Lifecycle status' },
  { value: 'UPDATED_AT', label: 'Updated time' },
  { value: 'CREATED_AT', label: 'Created date' },
];

const supplierStatuses: MasterDataStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
];

const supplierTypes: SupplierType[] = [
  'MANUFACTURER',
  'AUTHORIZED_DISTRIBUTOR',
  'DISTRIBUTOR',
  'WHOLESALER',
  'EXPORTER',
  'TRADING_COMPANY',
  'OTHER',
];

export function SupplierMasterManagement() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('sourcing.manage');

  const [records, setRecords] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<SupplierStatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SupplierType>('ALL');
  const [countryFilter, setCountryFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(50);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [sortBy, setSortBy] = useState<SupplierAdminSortBy>('NAME');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ASC');
  const [savedViews, setSavedViews] = useState<AdminSavedViewRecord[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewSaving, setSavedViewSaving] = useState(false);
  const [savedViewError, setSavedViewError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [supplierType, setSupplierType] =
    useState<SupplierType>('DISTRIBUTOR');
  const [countryCode, setCountryCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MasterDataStatus>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const supplierFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editing?.id ?? 'create',
    onEscape: resetForm,
  });

  const supplierDuplicate = useLikelyDuplicate({
    enabled: formOpen && !editing,
    name,
    code,
    searchUrl: '/api/admin/sourcing/suppliers/page',
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
          `/api/admin/preferences/saved-views?scope=${SUPPLIER_SAVED_VIEW_SCOPE}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Supplier saved views');

        const views = (await response.json()) as AdminSavedViewRecord[];
        if (active) setSavedViews(views);
      } catch {
        if (active) {
          setSavedViewError(
            'Saved views could not be loaded. Supplier Master is still available.',
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
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setLoadError('');

        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: String(pageSize),
        });
        const searchValue = search.trim();
        const countryValue = countryFilter.trim().toUpperCase();

        if (searchValue) query.set('search', searchValue);
        if (statusFilter !== 'ALL') query.set('status', statusFilter);
        if (typeFilter !== 'ALL') query.set('supplierType', typeFilter);
        if (countryValue.length === 2) {
          query.set('countryCode', countryValue);
        }
        query.set('sortBy', sortBy);
        query.set('sortDirection', sortDirection);

        const response = await fetch(
          `/api/admin/sourcing/suppliers/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Suppliers');

        const page = (await response.json()) as SupplierPage;
        if (!active) return;

        setRecords(page.items);
        setSelectedSupplierIds([]);
        setBulkError('');
        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setLoadError(
            'Supplier Master could not be loaded. Reload and try again.',
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
    countryFilter,
    pageNumber,
    pageSize,
    reloadKey,
    search,
    sortBy,
    sortDirection,
    statusFilter,
    typeFilter,
  ]);

  function resetFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setCountryFilter('');
    setPageNumber(1);
    setSelectedSavedViewId('');
    setSavedViewName('');
    setSelectedSupplierIds([]);
  }

  function currentSupplierSavedViewState(): Record<string, unknown> {
    return {
      search,
      status: statusFilter,
      supplierType: typeFilter,
      countryCode: countryFilter,
      sortBy,
      sortDirection,
      pageSize,
    };
  }

  function applySupplierSavedView(view: AdminSavedViewRecord) {
    const state = view.state;

    setSearch(typeof state.search === 'string' ? state.search : '');
    setStatusFilter(
      isSupplierStatusFilter(state.status) ? state.status : 'ALL',
    );
    setTypeFilter(
      isSupplierTypeFilter(state.supplierType) ? state.supplierType : 'ALL',
    );
    setCountryFilter(
      typeof state.countryCode === 'string'
        ? state.countryCode
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 2)
        : '',
    );
    setSortBy(isSupplierSortBy(state.sortBy) ? state.sortBy : 'NAME');
    setSortDirection(state.sortDirection === 'DESC' ? 'DESC' : 'ASC');
    setPageSize(normalizeAdminPageSize(state.pageSize));
    setPageNumber(1);
    setSelectedSavedViewId(view.id);
    setSavedViewName(view.name);
    setSavedViewError('');
  }

  async function saveSupplierView() {
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
          scope: SUPPLIER_SAVED_VIEW_SCOPE,
          name: viewName,
          state: currentSupplierSavedViewState(),
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
          : 'The current Supplier view could not be saved.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function updateSupplierSavedView() {
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
          state: currentSupplierSavedViewState(),
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
          : 'The saved Supplier view could not be updated.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function deleteSupplierSavedView() {
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
            'The saved Supplier view could not be deleted.',
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
          : 'The saved Supplier view could not be deleted.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  function toggleSupplierSelection(supplierId: string) {
    setSelectedSupplierIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId],
    );
  }

  function togglePageSelection() {
    const pageIds = records.map((record) => record.id);
    const allSelected =
      pageIds.length > 0 &&
      pageIds.every((id) => selectedSupplierIds.includes(id));

    setSelectedSupplierIds(allSelected ? [] : pageIds);
  }

  async function applyBulkStatus() {
    const selected = records.filter((record) =>
      selectedSupplierIds.includes(record.id),
    );
    if (selected.length === 0) return;

    if (
      requiresAdminBulkLifecycleConfirmation(
        selected.map((record) => record.status),
        bulkStatus,
      ) &&
      !window.confirm(
        adminBulkLifecycleConfirmationMessage({
          count: selected.length,
          entityLabel: 'Supplier',
          nextStatus: bulkStatus,
        }),
      )
    ) {
      return;
    }

    const input: BulkUpdateSupplierStatusInput = {
      items: selected.map((record) => ({
        id: record.id,
        version: record.version,
      })),
      status: bulkStatus,
    };

    setBulkSaving(true);
    setBulkError('');

    try {
      await patchJson<SupplierBulkStatusResult>(
        '/api/admin/sourcing/suppliers/bulk-status',
        input,
      );
      setSelectedSupplierIds([]);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setBulkError(
        error instanceof ClientApiError
          ? error.message
          : 'The selected Suppliers could not be updated.',
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function resetForm() {
    setEditing(null);
    setName('');
    setCode('');
    setSupplierType('DISTRIBUTOR');
    setCountryCode('');
    setContactEmail('');
    setWebsite('');
    setNotes('');
    setStatus('ACTIVE');
    setFormError('');
    setFormOpen(false);
  }

  function openCreate() {
    if (formOpen && !supplierFormKeyboard.confirmDiscard()) return;
    resetForm();
    setFormOpen(true);
  }

  function openEdit(record: SupplierRecord) {
    if (formOpen && !supplierFormKeyboard.confirmDiscard()) return;
    setEditing(record);
    setName(record.name);
    setCode(record.code);
    setSupplierType(record.supplierType);
    setCountryCode(record.countryCode);
    setContactEmail(record.contactEmail ?? '');
    setWebsite(record.website ?? '');
    setNotes(record.notes ?? '');
    setStatus(record.status);
    setFormError('');
    setFormOpen(true);
  }

  function handleName(value: string) {
    const previousGenerated = createCode(name);
    const nextGenerated = createCode(value);
    if (!editing && (!code || code === previousGenerated)) {
      setCode(nextGenerated);
    }
    setName(value);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      if (editing) {
        const input: UpdateSupplierInput = {
          version: editing.version,
          name: name.trim(),
          supplierType,
          countryCode: countryCode.trim().toUpperCase(),
          contactEmail: contactEmail.trim() || null,
          website: website.trim() || null,
          notes: notes.trim() || null,
          status,
        };
        const updated = await patchJson<SupplierRecord>(
          `/api/admin/sourcing/suppliers/${editing.id}`,
          input,
        );
        setRecords((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setReloadKey((current) => current + 1);
      } else {
        const input: CreateSupplierInput = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          supplierType,
          countryCode: countryCode.trim().toUpperCase(),
          ...(contactEmail.trim()
            ? { contactEmail: contactEmail.trim().toLowerCase() }
            : {}),
          ...(website.trim() ? { website: website.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          status,
        };
        await postJson<SupplierRecord>(
          '/api/admin/sourcing/suppliers',
          input,
        );
        setPageNumber(1);
        setReloadKey((current) => current + 1);
      }
      resetForm();
    } catch (requestError) {
      setFormError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'The Supplier could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Global sourcing</span>
        <h1>Supplier Master</h1>
        <p>
          Your administrator account does not have the sourcing.manage
          permission.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page sourcing-workspace">
      <AdminPageHeader
        eyebrow="Global automotive sourcing"
        title="Supplier Master"
        description="Govern canonical sourcing organizations independently from product catalog definitions and marketplace Sellers."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={openCreate}
          >
            + Supplier
          </button>
        }
      />

      <nav className="catalog-tabs" aria-label="Sourcing">
        <a className="catalog-tabs__active" href="/admin/sourcing/suppliers">
          Supplier Master
        </a>
      </nav>

      <AdminLibraryToolbar ariaLabel="Supplier library filters">
        <div className="catalog-filter">
          <label htmlFor="supplier-search">Search</label>
          <input
            id="supplier-search"
            type="search"
            value={search}
            placeholder="Supplier name, code, or email"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="supplier-status-filter">Status</label>
          <select
            id="supplier-status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as SupplierStatusFilter);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="SUPERSEDED">Superseded</option>
            {supplierStatuses.map((item) => (
              <option value={item} key={item}>
                {formatEnum(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="supplier-type-filter">Supplier type</label>
          <select
            id="supplier-type-filter"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as 'ALL' | SupplierType);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All types</option>
            {supplierTypes.map((item) => (
              <option value={item} key={item}>
                {formatEnum(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="supplier-country-filter">Country</label>
          <input
            id="supplier-country-filter"
            value={countryFilter}
            inputMode="text"
            maxLength={2}
            placeholder="ET"
            onChange={(event) => {
              setCountryFilter(
                event.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
              );
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="supplier-sort-by">Sort by</label>
          <select
            id="supplier-sort-by"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as SupplierAdminSortBy);
              setPageNumber(1);
            }}
          >
            {supplierSortOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="supplier-sort-direction">Direction</label>
          <select
            id="supplier-sort-direction"
            value={sortDirection}
            onChange={(event) => {
              setSortDirection(event.target.value as SortDirection);
              setPageNumber(1);
            }}
          >
            <option value="ASC">Ascending</option>
            <option value="DESC">Descending</option>
          </select>
        </div>

        <AdminFilterResetButton
          active={Boolean(
            search.trim() ||
              statusFilter !== 'ALL' ||
              typeFilter !== 'ALL' ||
              countryFilter.trim(),
          )}
          onReset={resetFilters}
        />

        <AdminLibraryCount
          count={total}
          singular="Supplier"
          plural="Suppliers"
        />
      </AdminLibraryToolbar>

      <AdminSavedViewsToolbar
        idPrefix="supplier-master"
        savedViews={savedViews}
        loading={savedViewsLoading}
        saving={savedViewSaving}
        selectedId={selectedSavedViewId}
        name={savedViewName}
        namePlaceholder="Active Ethiopian distributors"
        error={savedViewError}
        onSelect={(view) => {
          if (view) applySupplierSavedView(view);
          else {
            setSelectedSavedViewId('');
            setSavedViewName('');
          }
        }}
        onNameChange={setSavedViewName}
        onSaveAsNew={() => void saveSupplierView()}
        onUpdate={() => void updateSupplierSavedView()}
        onDelete={() => void deleteSupplierSavedView()}
      />

      {records.length > 0 ? (
        <AdminLibraryToolbar ariaLabel="Supplier bulk actions">
          <button
            className="button button--quiet"
            type="button"
            disabled={bulkSaving}
            onClick={togglePageSelection}
          >
            {records.every((record) =>
              selectedSupplierIds.includes(record.id),
            )
              ? 'Clear page selection'
              : 'Select page'}
          </button>

          <AdminLibraryCount
            count={selectedSupplierIds.length}
            singular="selected"
            plural="selected"
          />

          <div className="catalog-filter">
            <label htmlFor="supplier-bulk-status">Bulk lifecycle</label>
            <select
              id="supplier-bulk-status"
              value={bulkStatus}
              disabled={bulkSaving || selectedSupplierIds.length === 0}
              onChange={(event) =>
                setBulkStatus(event.target.value as MasterDataStatus)
              }
            >
              {supplierStatuses.map((item) => (
                <option value={item} key={item}>
                  {formatEnum(item)}
                </option>
              ))}
            </select>
          </div>

          <button
            className="button button--secondary"
            type="button"
            disabled={bulkSaving || selectedSupplierIds.length === 0}
            onClick={() => void applyBulkStatus()}
          >
            {bulkSaving ? 'Applying…' : 'Apply to selected'}
          </button>
        </AdminLibraryToolbar>
      ) : null}

      {bulkError ? (
        <div className="alert alert--error" role="alert">
          {bulkError}
        </div>
      ) : null}

      {loading ? <AdminLoadingState message="Loading Supplier Master…" /> : null}

      {loadError ? (
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      ) : null}

      {formOpen ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Supplier editor"
            disabled={saving}
            onClick={supplierFormKeyboard.requestClose}
          />
          <aside
            className="catalog-drawer supplier-editor-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Edit Supplier' : 'Create Supplier'}
          >
            <form
                      className="catalog-drawer__form supplier-editor-form"
                      ref={supplierFormKeyboard.ref}
                      onKeyDown={supplierFormKeyboard.onKeyDown}
                      onSubmit={save}
                    >
                      <div className="catalog-drawer__heading">
                        <div>
                          <span className="eyebrow">
                            {editing ? 'Supplier governance' : 'New sourcing organization'}
                          </span>
                          <h2>{editing ? 'Edit Supplier' : 'Create Supplier'}</h2>
                        </div>
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={supplierFormKeyboard.requestClose}
                        >
                          Close
                        </button>
                      </div>

                      {formError ? (
                        <div className="alert alert--error" role="alert">
                          {formError}
                        </div>
                      ) : null}

                      <div className="sourcing-supplier-grid">
                        <label className="field">
                          <span className="field__label">Supplier name *</span>
                          <div className="field__control">
                            <input
                              required
                              maxLength={180}
                              value={name}
                              onChange={(event) => handleName(event.target.value)}
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span className="field__label">Supplier type *</span>
                          <select
                            className="category-form__select"
                            value={supplierType}
                            onChange={(event) =>
                              setSupplierType(event.target.value as SupplierType)
                            }
                          >
                            {supplierTypes.map((type) => (
                              <option value={type} key={type}>
                                {formatEnum(type)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span className="field__label">Country code *</span>
                          <div className="field__control">
                            <input
                              required
                              minLength={2}
                              maxLength={2}
                              value={countryCode}
                              placeholder="AE"
                              onChange={(event) =>
                                setCountryCode(
                                  event.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
                                )
                              }
                            />
                          </div>
                        </label>

                        {editing ? (
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
                              <option value="ACTIVE">Active</option>
                              <option value="INACTIVE">Inactive</option>
                              <option value="ARCHIVED">Archived</option>
                            </select>
                          </label>
                        ) : null}
                      </div>

                      <LikelyDuplicateWarning
                        match={supplierDuplicate.match}
                        checking={supplierDuplicate.checking}
                      />

                      {editing ? (
                        <details className="catalog-workspace-advanced">
                          <summary>Advanced technical fields</summary>
                          <label className="field">
                            <span className="field__label">Canonical code</span>
                            <div className="field__control">
                              <input disabled maxLength={60} value={code} />
                            </div>
                            <small className="field__hint">
                              Stable identifier generated when the Supplier was created.
                            </small>
                          </label>
                        </details>
                      ) : null}

                      <details className="sourcing-advanced">
                        <summary>Contact & notes</summary>
                        <div className="sourcing-supplier-grid">
                          <label className="field">
                            <span className="field__label">Contact email</span>
                            <div className="field__control">
                              <input
                                type="email"
                                maxLength={254}
                                value={contactEmail}
                                onChange={(event) => setContactEmail(event.target.value)}
                              />
                            </div>
                          </label>

                          <label className="field">
                            <span className="field__label">Website</span>
                            <div className="field__control">
                              <input
                                type="url"
                                maxLength={500}
                                value={website}
                                placeholder="https://"
                                onChange={(event) => setWebsite(event.target.value)}
                              />
                            </div>
                          </label>

                          <label className="field sourcing-offer-notes">
                            <span className="field__label">Notes</span>
                            <textarea
                              maxLength={5000}
                              value={notes}
                              onChange={(event) => setNotes(event.target.value)}
                            />
                          </label>
                        </div>
                      </details>

                      <div className="catalog-drawer__actions supplier-editor-actions">
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={
                            saving ||
                            !name.trim() ||
                            !code.trim() ||
                            countryCode.length !== 2
                          }
                        >
                          {saving
                            ? 'Saving Supplier…'
                            : editing
                              ? 'Save Supplier'
                              : 'Create Supplier'}
                        </button>
                      </div>
                    </form>
          </aside>
        </div>
      ) : null}

      {!loading && !loadError ? (
        records.length === 0 ? (
          <AdminEmptyState
            title="No Suppliers match this view"
            description="Change the search or filters, or create a new canonical sourcing organization."
            actions={
              <button
                className="button button--primary"
                type="button"
                onClick={openCreate}
              >
                + Create first Supplier
              </button>
            }
          />
        ) : (
          <div
            className="admin-library-table supplier-master-table"
            role="table"
            aria-label="Supplier Master library"
          >
            <div
              className="admin-library-table__row admin-library-table__row--header supplier-master-table__row"
              role="row"
            >
              <span role="columnheader">Supplier</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Country</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Action</span>
            </div>

            {records.map((record) => (
              <div
                className="admin-library-table__row supplier-master-table__row"
                role="row"
                key={record.id}
              >
                <span className="admin-library-table__primary" role="cell">
                  <label className="attribute-library-row__check">
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.name}`}
                      checked={selectedSupplierIds.includes(record.id)}
                      disabled={bulkSaving}
                      onChange={() => toggleSupplierSelection(record.id)}
                    />
                    <span>
                      <strong>{record.name}</strong>
                      <small>{record.code}</small>
                    </span>
                  </label>
                </span>
                <span role="cell">{formatEnum(record.supplierType)}</span>
                <span role="cell">{record.countryCode}</span>
                <span role="cell">
                  <AdminStatusBadge status={record.status} />
                </span>
                <span className="supplier-master-table__actions" role="cell">
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => openEdit(record)}
                  >
                    Edit
                  </button>
                  <AdminMasterLifecycleActions
                    domain="SOURCING"
                    entityType="SUPPLIER"
                    entityId={record.id}
                    entityName={record.name}
                    status={record.status}
                    version={record.version}
                    reactivatePath={`/api/admin/sourcing/suppliers/${record.id}`}
                    disabled={!canManage}
                    onCompleted={() =>
                      setReloadKey((current) => current + 1)
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}

      {!loading && !loadError && total > 0 ? (
        <AdminLibraryPagination
          page={pageNumber}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          disabled={loading}
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

function createCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function isSupplierStatusFilter(value: unknown): value is SupplierStatusFilter {
  return (
    value === 'ALL' ||
    (typeof value === 'string' &&
      supplierStatuses.includes(value as MasterDataStatus))
  );
}

function isSupplierTypeFilter(
  value: unknown,
): value is 'ALL' | SupplierType {
  return (
    value === 'ALL' ||
    (typeof value === 'string' &&
      supplierTypes.includes(value as SupplierType))
  );
}

function isSupplierSortBy(value: unknown): value is SupplierAdminSortBy {
  return (
    typeof value === 'string' &&
    supplierSortOptions.some((option) => option.value === value)
  );
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
