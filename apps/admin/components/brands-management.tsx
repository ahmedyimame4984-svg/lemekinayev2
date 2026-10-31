'use client';
import { CatalogPrimaryNav } from './catalog-primary-nav';
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

import { type FormEvent, useEffect, useState } from 'react';
import type { MasterDataStatus } from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { nextGeneratedFieldValue } from '@/lib/generated-field';
import type {
  BrandBulkStatusResult,
  BrandPage,
  BrandRecord,
  BulkUpdateBrandStatusInput,
  CreateBrandInput,
  UpdateBrandInput,
} from '@/lib/product-identity-contracts';
import { useAdminPrincipal } from './admin-session';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import {
  adminBulkLifecycleConfirmationMessage,
  requiresAdminBulkLifecycleConfirmation,
} from '@/lib/admin-change-safety';

type FilterStatus = 'ALL' | MasterDataStatus;

export function BrandsManagement({
  initialSearch = '',
}: {
  initialSearch?: string;
}) {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<FilterStatus>('ALL');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(50);
  const [reloadKey, setReloadKey] = useState(0);
  const [brandPage, setBrandPage] = useState<BrandPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    pageCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRecord | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [recordStatus, setRecordStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const formKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editing?.id ?? 'create',
    onEscape: closeForm,
  });

  const brandDuplicate = useLikelyDuplicate({
    enabled: formOpen && !editing,
    name,
    code,
    searchUrl: '/api/admin/brands/page',
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
          pageSize: String(pageSize),
        });
        const searchValue = search.trim();
        if (searchValue) query.set('search', searchValue);
        if (status !== 'ALL') query.set('status', status);

        const response = await fetch(
          `/api/admin/brands/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load brands');

        const data = (await response.json()) as BrandPage;
        if (!active) return;

        setBrandPage(data);
        setSelectedBrandIds([]);
        setBulkError('');
        if (data.pageCount > 0 && pageNumber > data.pageCount) {
          setPageNumber(data.pageCount);
        }
      } catch {
        if (active) {
          setLoadError(
            'Brands could not be loaded. Check that the API and database are running.',
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
  }, [canManage, pageNumber, pageSize, reloadKey, search, status]);

  const brands = brandPage.items;

  function resetFilters() {
    setSearch('');
    setStatus('ALL');
    setPageNumber(1);
    setSelectedBrandIds([]);
  }

  function toggleBrandSelection(brandId: string) {
    setSelectedBrandIds((current) =>
      current.includes(brandId)
        ? current.filter((id) => id !== brandId)
        : [...current, brandId],
    );
  }

  function togglePageSelection() {
    const pageIds = brands.map((brand) => brand.id);
    const allSelected =
      pageIds.length > 0 &&
      pageIds.every((id) => selectedBrandIds.includes(id));

    setSelectedBrandIds(allSelected ? [] : pageIds);
  }

  async function applyBulkStatus() {
    const selected = brands.filter((brand) =>
      selectedBrandIds.includes(brand.id),
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
          entityLabel: 'Brand',
          nextStatus: bulkStatus,
        }),
      )
    ) {
      return;
    }

    const input: BulkUpdateBrandStatusInput = {
      items: selected.map((brand) => ({
        id: brand.id,
        version: brand.version,
      })),
      status: bulkStatus,
    };

    setBulkSaving(true);
    setBulkError('');

    try {
      await patchJson<BrandBulkStatusResult>(
        '/api/admin/brands/bulk-status',
        input,
      );
      setSelectedBrandIds([]);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setBulkError(
        error instanceof ClientApiError
          ? error.message
          : 'The selected Brands could not be updated.',
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function openCreateForm() {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditing(null);
    setName('');
    setCode('');
    setGeneratedCode('');
    setRecordStatus('DRAFT');
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(brand: BrandRecord) {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditing(brand);
    setName(brand.name);
    setCode(brand.code);
    setGeneratedCode(brand.code);
    setRecordStatus(brand.status);
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  }

  function handleNameChange(value: string) {
    setName(value);
    if (editing) return;
    const nextGenerated = makeBrandCode(value);
    setCode(
      nextGeneratedFieldValue(code, generatedCode, nextGenerated),
    );
    setGeneratedCode(nextGenerated);
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      if (editing) {
        const input: UpdateBrandInput = {
          version: editing.version,
          name: name.trim(),
          status: recordStatus,
        };
        await patchJson<BrandRecord>(
          `/api/admin/brands/${editing.id}`,
          input,
        );
      } else {
        const input: CreateBrandInput = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          status: recordStatus,
        };
        await postJson<BrandRecord>('/api/admin/brands', input);
      }

      setReloadKey((current) => current + 1);
      setFormOpen(false);
      setEditing(null);
    } catch (requestError) {
      setFormError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'The Brand could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Catalog management</span>
        <h1>Brand Master</h1>
        <p>
          Your administrator account does not have the catalog.manage
          permission.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <AdminPageHeader
        eyebrow="Catalog management"
        title="Brand Master"
        description="Maintain approved canonical product brands. Sellers select these references when creating actual products; Admin does not create those products here."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={openCreateForm}
          >
            + Add brand
          </button>
        }
      />

      <CatalogPrimaryNav active="brands" />

      <AdminLibraryToolbar ariaLabel="Brand library filters">
        <div className="catalog-filter">
          <label htmlFor="brand-search">Search</label>
          <input
            id="brand-search"
            type="search"
            value={search}
            placeholder="Brand name or code"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>
        <div className="catalog-filter">
          <label htmlFor="brand-status">Status</label>
          <select
            id="brand-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as FilterStatus);
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
          active={Boolean(search.trim() || status !== 'ALL')}
          onReset={resetFilters}
        />
        <AdminLibraryCount
          count={brandPage.total}
          singular="brand"
          plural="brands"
        />
      </AdminLibraryToolbar>

      {brands.length > 0 ? (
        <AdminLibraryToolbar ariaLabel="Brand bulk actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={togglePageSelection}
          >
            {brands.every((brand) => selectedBrandIds.includes(brand.id))
              ? 'Clear page selection'
              : 'Select page'}
          </button>

          <AdminLibraryCount
            count={selectedBrandIds.length}
            singular="selected"
            plural="selected"
          />

          <div className="catalog-filter">
            <label htmlFor="brand-bulk-status">Bulk lifecycle</label>
            <select
              id="brand-bulk-status"
              value={bulkStatus}
              disabled={bulkSaving || selectedBrandIds.length === 0}
              onChange={(event) =>
                setBulkStatus(event.target.value as MasterDataStatus)
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <button
            className="button button--secondary"
            type="button"
            disabled={bulkSaving || selectedBrandIds.length === 0}
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

      {formOpen ? (
        <form
          className="category-form"
          ref={formKeyboard.ref}
          onKeyDown={formKeyboard.onKeyDown}
          onSubmit={saveBrand}
        >
          <div className="category-form__heading">
            <div>
              <span className="eyebrow">
                {editing ? 'Edit Brand' : 'New Brand'}
              </span>
              <h2>{editing ? editing.name : 'Create canonical Brand'}</h2>
            </div>
            <button
              className="button button--quiet"
              type="button"
              disabled={saving}
              onClick={formKeyboard.requestClose}
            >
              Cancel
            </button>
          </div>

          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="category-form__grid">
            <label className="field">
              <span className="field__label">Brand name</span>
              <div className="field__control">
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={name}
                  placeholder="Example: Bosch"
                  onChange={(event) => handleNameChange(event.target.value)}
                />
              </div>
            </label>

            {editing ? (
              <label className="field">
                <span className="field__label">Status</span>
                <select
                  className="category-form__select"
                  value={recordStatus}
                  onChange={(event) =>
                    setRecordStatus(event.target.value as MasterDataStatus)
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
            match={brandDuplicate.match}
            checking={brandDuplicate.checking}
          />

          {editing ? (
            <details className="catalog-workspace-advanced">
              <summary>Advanced technical fields</summary>
              <label className="field">
                <span className="field__label">Canonical code</span>
                <div className="field__control">
                  <input
                    disabled
                    minLength={2}
                    maxLength={60}
                    value={code}
                  />
                </div>
                <small className="field__hint">
                  Stable identifier generated at creation and kept immutable.
                </small>
              </label>
            </details>
          ) : null}

          <div className="category-form__actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={saving || !name.trim() || !code.trim()}
            >
              {saving ? (
                <>
                  <span className="spinner" /> Saving…
                </>
              ) : editing ? (
                'Save Brand'
              ) : (
                'Create Brand'
              )}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <AdminLoadingState message="Loading Brand Master…" /> : null}

      {loadError ? (
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
      ) : null}

      {!loading && !loadError && brands.length === 0 ? (
        <AdminEmptyState
          title="No Brands found"
          description="Create the first approved Brand or change the current status filter."
          actions={
            <button
              className="button button--primary"
              type="button"
              onClick={openCreateForm}
            >
              + Create Brand
            </button>
          }
        />
      ) : null}

      {brands.length > 0 ? (
        <div className="admin-library-table brand-library-table" role="table" aria-label="Brand library">
          <div
            className="admin-library-table__row admin-library-table__row--header brand-library-table__row"
            role="row"
          >
            <span role="columnheader">Brand</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Action</span>
          </div>
          {brands.map((brand) => (
            <div
                className="admin-library-table__row brand-library-table__row"
                role="row"
                key={brand.id}
            >
              <span className="admin-library-table__primary" role="cell">
                <label className="attribute-library-row__check">
                  <input
                    type="checkbox"
                    checked={selectedBrandIds.includes(brand.id)}
                    aria-label={`Select ${brand.name}`}
                    onChange={() => toggleBrandSelection(brand.id)}
                  />
                  <span>
                    <strong>{brand.name}</strong>
                    <small>{brand.code}</small>
                  </span>
                </label>
              </span>
              <span role="cell">
                <AdminStatusBadge status={brand.status} />
              </span>
              <span role="cell">v{brand.version}</span>
              <span className="brand-library-table__actions" role="cell">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => openEditForm(brand)}
                >
                  Edit
                </button>
                <AdminMasterLifecycleActions
                  domain="CATALOG"
                  entityType="BRAND"
                  entityId={brand.id}
                  entityName={brand.name}
                  status={brand.status}
                  version={brand.version}
                  reactivatePath={`/api/admin/brands/${brand.id}`}
                  disabled={!canManage}
                  onCompleted={() =>
                    setReloadKey((current) => current + 1)
                  }
                />
              </span>
            </div>
          ))}
        </div>
      ) : null}
            {!loading && !loadError && brandPage.total > 0 ? (
        <AdminLibraryPagination
          page={brandPage.page}
          pageCount={brandPage.pageCount}
          pageSize={pageSize}
          total={brandPage.total}
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

function makeBrandCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 60);
}
