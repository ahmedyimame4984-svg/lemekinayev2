'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  CategoryPage,
  CategoryPageItem,
  CategoryRecord,
  CreateProductFamilyInput,
  MasterDataStatus,
  ProductFamilyPage,
  ProductFamilyPageItem,
  ProductFamilyRecord,
  UpdateProductFamilyInput,
} from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { useAdminPrincipal } from './admin-session';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { AdminSearchableCombobox } from './admin-searchable-combobox';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';

type FilterStatus = 'ALL' | MasterDataStatus;

interface CategoryChoice {
  id: string;
  name: string;
  status: MasterDataStatus;
}

const statuses: MasterDataStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
];

export function PartGroupsManagement({
  initialCategoryId = '',
}: {
  initialCategoryId?: string;
}) {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [families, setFamilies] = useState<ProductFamilyPageItem[]>([]);
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('ALL');
  const [exactCategoryId, setExactCategoryId] = useState(initialCategoryId);
  const [exactCategoryLabel, setExactCategoryLabel] = useState('');
  const [exactCategoryStatus, setExactCategoryStatus] =
    useState<MasterDataStatus | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFamilyPageItem | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryChoice | null>(null);
  const [categoryLookupSearch, setCategoryLookupSearch] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<CategoryPageItem[]>([]);
  const [categoryLookupLoading, setCategoryLookupLoading] = useState(false);
  const [categoryLookupError, setCategoryLookupError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recordStatus, setRecordStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const formKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editing?.id ?? 'create',
    onEscape: closeForm,
  });

  const partGroupDuplicate = useLikelyDuplicate({
    enabled: formOpen && !editing && Boolean(selectedCategory),
    name,
    code: createCode(name),
    searchUrl: selectedCategory
      ? `/api/admin/catalog/product-families/page?categoryId=${selectedCategory.id}`
      : '',
  });

  useEffect(() => {
    if (!canManage || !exactCategoryId) return;

    let active = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/catalog/categories/${exactCategoryId}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Category not found');

        const category = (await response.json()) as CategoryRecord;
        if (!active) return;

        setExactCategoryLabel(category.name);
        setExactCategoryStatus(category.status);
      } catch {
        if (active) {
          setExactCategoryId('');
          setExactCategoryLabel('');
          setExactCategoryStatus(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [canManage, exactCategoryId]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');

        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: '50',
        });
        const searchValue = search.trim();
        const categoryValue = categorySearch.trim();

        if (searchValue) query.set('search', searchValue);
        if (status !== 'ALL') query.set('status', status);
        if (exactCategoryId) {
          query.set('categoryId', exactCategoryId);
        } else if (categoryValue) {
          query.set('categorySearch', categoryValue);
        }

        const response = await fetch(
          `/api/admin/catalog/product-families/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Part Groups');

        const page = (await response.json()) as ProductFamilyPage;
        if (!active) return;

        setFamilies(page.items);
        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch {
        if (active) setError('Part Groups could not be loaded.');
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
    categorySearch,
    exactCategoryId,
    pageNumber,
    reloadKey,
    search,
    status,
  ]);

  useEffect(() => {
    if (!canManage || !formOpen) {
      setCategoryLookupLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setCategoryLookupLoading(true);
        setCategoryLookupError('');

        const query = new URLSearchParams({
          rootOnly: 'true',
          page: '1',
          pageSize: '20',
        });
        const searchValue = categoryLookupSearch.trim();
        if (searchValue) query.set('search', searchValue);

        const response = await fetch(
          `/api/admin/catalog/categories/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Categories');

        const page = (await response.json()) as CategoryPage;
        if (active) setCategoryOptions(page.items);
      } catch {
        if (active) {
          setCategoryLookupError(
            'Categories could not be searched. Retry before saving.',
          );
        }
      } finally {
        if (active) setCategoryLookupLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [canManage, categoryLookupSearch, formOpen]);

  function openCreate() {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditing(null);
    setSelectedCategory(
      exactCategoryId && exactCategoryLabel && exactCategoryStatus
        ? {
            id: exactCategoryId,
            name: exactCategoryLabel,
            status: exactCategoryStatus,
          }
        : null,
    );
    setCategoryLookupSearch('');
    setName('');
    setDescription('');
    setRecordStatus('DRAFT');
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(family: ProductFamilyPageItem) {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditing(family);
    setSelectedCategory({
      id: family.categoryId,
      name: family.categoryName,
      status: family.categoryStatus,
    });
    setCategoryLookupSearch('');
    setName(family.name);
    setDescription(family.description ?? '');
    setRecordStatus(family.status);
    setFormError('');
    setFormOpen(true);
  }

  function chooseCategory(category: CategoryChoice) {
    setSelectedCategory({
      id: category.id,
      name: category.name,
      status: category.status,
    });
    if (
      recordStatus === 'ACTIVE' &&
      category.status !== 'ACTIVE'
    ) {
      setRecordStatus('DRAFT');
    }
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setSelectedCategory(null);
    setCategoryLookupSearch('');
    setCategoryOptions([]);
    setFormError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCategory) return;

    setSaving(true);
    setFormError('');

    try {
      if (editing) {
        const input: UpdateProductFamilyInput = {
          version: editing.version,
          categoryId: selectedCategory.id,
          name: name.trim(),
          description: description.trim() || null,
          status: recordStatus,
        };
        await patchJson<ProductFamilyRecord>(
          `/api/admin/catalog/product-families/${editing.id}`,
          input,
        );
      } else {
        const input: CreateProductFamilyInput = {
          categoryId: selectedCategory.id,
          code: createCode(name),
          name: name.trim(),
          description: description.trim() || null,
          status: 'DRAFT',
        };
        await postJson<ProductFamilyRecord>(
          '/api/admin/catalog/product-families',
          input,
        );
        setPageNumber(1);
      }

      closeFormAfterSave();
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'The Part Group could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  function closeFormAfterSave() {
    setFormOpen(false);
    setEditing(null);
    setSelectedCategory(null);
    setCategoryLookupSearch('');
    setCategoryOptions([]);
    setFormError('');
  }

  function clearExactCategoryFilter() {
    setExactCategoryId('');
    setExactCategoryLabel('');
    setExactCategoryStatus(null);
    setPageNumber(1);
  }

  function resetFilters() {
    setSearch('');
    setCategorySearch('');
    setStatus('ALL');
    setExactCategoryId('');
    setExactCategoryLabel('');
    setExactCategoryStatus(null);
    setPageNumber(1);
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Catalog management</span>
        <h1>Part Groups</h1>
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
        title="Part Groups"
        description="Maintain functional groups between top-level Categories and Product Types without loading the full Catalog hierarchy."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={openCreate}
          >
            + Add Part Group
          </button>
        }
      />

      <CatalogPrimaryNav active="part-groups" />

      {exactCategoryId ? (
        <div className="catalog-setup-note">
          <strong>Category filter:</strong>{' '}
          {exactCategoryLabel || 'Loading Category…'}
          <button
            className="button button--quiet"
            type="button"
            onClick={clearExactCategoryFilter}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="catalog-toolbar catalog-toolbar--filters">
        <div className="catalog-filter">
          <label htmlFor="part-group-search">Search</label>
          <input
            id="part-group-search"
            type="search"
            value={search}
            placeholder="Part Group name, code, or description"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="part-group-category-search">Category</label>
          <input
            id="part-group-category-search"
            type="search"
            value={categorySearch}
            disabled={Boolean(exactCategoryId)}
            placeholder={
              exactCategoryId
                ? exactCategoryLabel || 'Exact Category selected'
                : 'Category name or code'
            }
            onChange={(event) => {
              setCategorySearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="part-group-status">Status</label>
          <select
            id="part-group-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as FilterStatus);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="SUPERSEDED">Superseded</option>
            {statuses.map((item) => (
              <option value={item} key={item}>
                {prettyStatus(item)}
              </option>
            ))}
          </select>
        </div>

        <AdminFilterResetButton
          active={Boolean(search.trim() || categorySearch.trim() || status !== 'ALL' || exactCategoryId)}
          onReset={resetFilters}
        />

        <span className="catalog-count">
          {total} {total === 1 ? 'Part Group' : 'Part Groups'}
        </span>
      </div>

      {formOpen ? (
        <form
          className="category-form"
          ref={formKeyboard.ref}
          onKeyDown={formKeyboard.onKeyDown}
          onSubmit={save}
        >
          <div className="category-form__heading">
            <div>
              <span className="eyebrow">
                {editing ? 'Edit Part Group' : 'New Part Group'}
              </span>
              <h2>{editing?.name ?? 'Create Part Group'}</h2>
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
            <div className="field">
              <span className="field__label">Category *</span>
              {selectedCategory ? (
                <div className="category-parent-note">
                  <strong>{selectedCategory.name}</strong>
                  <span>{prettyStatus(selectedCategory.status)}</span>
                  <small>
                    The Part Group will belong directly to this top-level
                    Category.
                  </small>
                </div>
              ) : null}

              <AdminSearchableCombobox
                id="part-group-category-picker"
                value={selectedCategory?.id ?? ''}
                options={[
                  {
                    id: '',
                    label: 'Choose Category',
                    meta: 'Top-level automotive Category',
                  },
                  ...(selectedCategory &&
                  !categoryOptions.some(
                    (category) => category.id === selectedCategory.id,
                  )
                    ? [
                        {
                          id: selectedCategory.id,
                          label: selectedCategory.name,
                          meta: prettyStatus(selectedCategory.status),
                        },
                      ]
                    : []),
                  ...categoryOptions.map((category) => ({
                    id: category.id,
                    label: category.name,
                    meta: `${category.code} · ${prettyStatus(category.status)}`,
                    keywords: [category.code],
                  })),
                ]}
                placeholder="Choose Category"
                searchPlaceholder="Search Category name or code…"
                onSearchChange={setCategoryLookupSearch}
                onChange={(categoryId) => {
                  if (!categoryId) {
                    setSelectedCategory(null);
                    return;
                  }
                  const category =
                    categoryOptions.find((item) => item.id === categoryId) ??
                    (selectedCategory?.id === categoryId
                      ? {
                          id: selectedCategory.id,
                          name: selectedCategory.name,
                          status: selectedCategory.status,
                          code: '',
                        }
                      : null);
                  if (category) chooseCategory(category);
                }}
              />

              {categoryLookupLoading ? (
                <small className="field__hint">Searching Categories…</small>
              ) : null}
              {categoryLookupError ? (
                <small className="field__hint">{categoryLookupError}</small>
              ) : null}
            </div>

            <label className="field">
              <span className="field__label">Part Group name</span>
              <div className="field__control">
                <input
                  required
                  maxLength={140}
                  value={name}
                  placeholder="Example: Disc Brake Components"
                  onChange={(event) => setName(event.target.value)}
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
                    setRecordStatus(
                      event.target.value as MasterDataStatus,
                    )
                  }
                >
                  {statuses.map((item) => (
                    <option
                      value={item}
                      key={item}
                      disabled={
                        item === 'ACTIVE' &&
                        selectedCategory?.status !== 'ACTIVE'
                      }
                    >
                      {prettyStatus(item)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field category-form__description">
              <span className="field__label">Description</span>
              <textarea
                maxLength={2000}
                value={description}
                placeholder="Optional functional definition"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <LikelyDuplicateWarning
            match={partGroupDuplicate.match}
            checking={partGroupDuplicate.checking}
          />

          <div className="category-form__actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={saving || !selectedCategory || !name.trim()}
            >
              {saving
                ? 'Saving…'
                : editing
                  ? 'Save Part Group'
                  : 'Create Part Group'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <AdminLoadingState message="Loading Part Groups…" /> : null}

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error && families.length === 0 ? (
        <AdminEmptyState
          title="No Part Groups match the current filters"
          description="Change the filters or create the next functional Part Group."
        />
      ) : null}

      {!loading && !error && families.length > 0 ? (
        <div className="admin-library-table part-group-library-table" role="table" aria-label="Part Group library">
          <div
            className="admin-library-table__row admin-library-table__row--header part-group-library-table__row"
            role="row"
          >
            <span role="columnheader">Part Group</span>
            <span role="columnheader">Category</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Actions</span>
          </div>

          {families.map((family) => (
            <div
                className="admin-library-table__row part-group-library-table__row"
                role="row"
                key={family.id}
            >
              <span className="admin-library-table__primary" role="cell">
                <strong>{family.name}</strong>
                <small>{family.code}</small>
              </span>
              <span role="cell">
                {family.categoryName} · {prettyStatus(family.categoryStatus)}
              </span>
              <span role="cell">
                <AdminStatusBadge
                  status={family.status}
                  label={prettyStatus(family.status)}
                />
              </span>
              <span role="cell">v{family.version}</span>
              <span className="part-group-library-table__actions" role="cell">
                <a
                  className="button button--secondary"
                  href={`/admin/catalog/product-types?categoryId=${family.categoryId}&productFamilyId=${family.id}`}
                >
                  Product Types
                </a>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => openEdit(family)}
                >
                  Edit
                </button>
                <AdminMasterLifecycleActions
                  domain="CATALOG"
                  entityType="PRODUCT_FAMILY"
                  entityId={family.id}
                  entityName={family.name}
                  status={family.status}
                  version={family.version}
                  reactivatePath={`/api/admin/catalog/product-families/${family.id}`}
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

      {!loading && !error && total > 0 ? (
        <div className="catalog-pagination">
          <button
            className="button button--quiet"
            type="button"
            disabled={pageNumber <= 1}
            onClick={() =>
              setPageNumber((current) => Math.max(1, current - 1))
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
            onClick={() => setPageNumber((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function createCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 60);
}

function prettyStatus(value: MasterDataStatus): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
