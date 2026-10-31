'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  CategoryPage,
  CategoryPageItem,
  CategoryRecord,
  CreateCategoryInput,
  MasterDataStatus,
  UpdateCategoryInput,
} from '@/lib/catalog-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { useAdminPrincipal } from './admin-session';
import { CatalogPrimaryNav } from './catalog-primary-nav';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { AdminMasterLifecycleActions } from './admin-master-lifecycle-actions';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { LikelyDuplicateWarning } from './likely-duplicate-warning';
import { useLikelyDuplicate } from '@/lib/use-likely-duplicate';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';

type FilterStatus = 'ALL' | MasterDataStatus;

const categoryStatuses: MasterDataStatus[] = [
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
];

export function CategoriesManagement() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('catalog.manage');

  const [categories, setCategories] = useState<CategoryPageItem[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('ALL');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(
    null,
  );
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [categoryStatus, setCategoryStatus] =
    useState<MasterDataStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const formKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editingCategory?.id ?? 'create',
    onEscape: closeForm,
  });

  const categoryDuplicate = useLikelyDuplicate({
    enabled: formOpen && !editingCategory,
    name,
    code,
    searchUrl: '/api/admin/catalog/categories/page?rootOnly=true',
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
        setError('');

        const query = new URLSearchParams({
          page: String(pageNumber),
          pageSize: '50',
        });
        const searchValue = search.trim();
        if (searchValue) query.set('search', searchValue);
        if (status !== 'ALL') query.set('status', status);

        const response = await fetch(
          `/api/admin/catalog/categories/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Categories');

        const page = (await response.json()) as CategoryPage;
        if (!active) return;

        setCategories(page.items);
        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setError(
            'Categories could not be loaded. Check that the API and database are running.',
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
  }, [canManage, pageNumber, reloadKey, search, status]);

  function resetFilters() {
    setSearch('');
    setStatus('ALL');
    setPageNumber(1);
  }

  function openCreateForm() {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    setEditingCategory(null);
    setName('');
    setCode('');
    setSlug('');
    setDescription('');
    setSortOrder('0');
    setCategoryStatus('DRAFT');
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(category: CategoryPageItem) {
    if (formOpen && !formKeyboard.confirmDiscard()) return;
    if (category.parentId !== null || category.level !== 0) return;

    setEditingCategory(category);
    setName(category.name);
    setCode(category.code);
    setSlug(category.slug);
    setDescription(category.description ?? '');
    setSortOrder(String(category.sortOrder));
    setCategoryStatus(category.status);
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setFormError('');
    setEditingCategory(null);
  }

  function handleNameChange(value: string) {
    const generatedCode = createCode(value);
    const generatedSlug = createSlug(value);
    const previousGeneratedCode = createCode(name);
    const previousGeneratedSlug = createSlug(name);

    if (!editingCategory && (!code || code === previousGeneratedCode)) {
      setCode(generatedCode);
    }
    if (!slug || slug === previousGeneratedSlug) {
      setSlug(generatedSlug);
    }
    setName(value);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      if (editingCategory) {
        const input: UpdateCategoryInput = {
          version: editingCategory.version,
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          status: categoryStatus,
        };
        await patchJson<CategoryRecord>(
          `/api/admin/catalog/categories/${editingCategory.id}`,
          input,
        );
      } else {
        const input: CreateCategoryInput = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim() || null,
          sortOrder: 0,
          status: 'DRAFT',
        };
        await postJson<CategoryRecord>('/api/admin/catalog/categories', input);
        setPageNumber(1);
      }

      setFormOpen(false);
      setEditingCategory(null);
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof ClientApiError
          ? requestError.message
          : 'The Category could not be saved. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Catalog management</span>
        <h2>Categories</h2>
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
        title="Categories"
        description="Govern broad top-level automotive Categories. Part Groups provide the functional middle layer before Product Types."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={openCreateForm}
          >
            + Add Category
          </button>
        }
      />

      <CatalogPrimaryNav active="categories" />

      <div className="catalog-toolbar catalog-toolbar--filters">
        <div className="catalog-filter">
          <label htmlFor="category-search">Search</label>
          <input
            id="category-search"
            type="search"
            value={search}
            placeholder="Name, code, slug, or description"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>
        <div className="catalog-filter">
          <label htmlFor="category-status">Status</label>
          <select
            id="category-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as FilterStatus);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="DEPRECATED">Deprecated</option>
            <option value="SUPERSEDED">Superseded</option>
            {categoryStatuses.map((item) => (
              <option value={item} key={item}>
                {prettyStatus(item)}
              </option>
            ))}
          </select>
        </div>
        <AdminFilterResetButton
          active={Boolean(search.trim() || status !== 'ALL')}
          onReset={resetFilters}
        />
        <span className="catalog-count">
          {total} {total === 1 ? 'Category' : 'Categories'}
        </span>
      </div>

      {formOpen ? (
        <form
          className="category-form"
          ref={formKeyboard.ref}
          onKeyDown={formKeyboard.onKeyDown}
          onSubmit={saveCategory}
        >
          <div className="category-form__heading">
            <div>
              <span className="eyebrow">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </span>
              <h2>
                {editingCategory ? editingCategory.name : 'Create Category'}
              </h2>
            </div>
            <button
              className="button button--quiet"
              type="button"
              onClick={formKeyboard.requestClose}
              disabled={saving}
            >
              Cancel
            </button>
          </div>

          <div className="category-parent-note">
            <strong>Catalog level</strong>
            <span>Top-level Category</span>
            <small>
              New nested Categories are not supported. Use Category → Part
              Group → Product Type.
            </small>
          </div>

          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="category-form__grid">
            <label className="field">
              <span className="field__label">Category name</span>
              <div className="field__control">
                <input
                  required
                  maxLength={120}
                  value={name}
                  placeholder="Example: Braking System"
                  onChange={(event) => handleNameChange(event.target.value)}
                />
              </div>
            </label>

            {editingCategory ? (
              <label className="field">
                <span className="field__label">Status</span>
                <select
                  className="category-form__select"
                  value={categoryStatus}
                  onChange={(event) =>
                    setCategoryStatus(
                      event.target.value as MasterDataStatus,
                    )
                  }
                >
                  {categoryStatuses.map((item) => (
                    <option value={item} key={item}>
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
                placeholder="Optional Category definition"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <LikelyDuplicateWarning
            match={categoryDuplicate.match}
            checking={categoryDuplicate.checking}
          />

          {editingCategory ? (
            <details className="catalog-workspace-advanced">
              <summary>Advanced technical fields</summary>
              <div className="category-form__grid">
                <label className="field">
                  <span className="field__label">Canonical code</span>
                  <div className="field__control">
                    <input disabled value={code} />
                  </div>
                  <small className="field__hint">
                    Stable internal identifier generated at creation.
                  </small>
                </label>

                <label className="field">
                  <span className="field__label">Slug</span>
                  <div className="field__control">
                    <input
                      required
                      maxLength={140}
                      value={slug}
                      onChange={(event) =>
                        setSlug(createSlug(event.target.value))
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
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value)}
                    />
                  </div>
                </label>
              </div>
            </details>
          ) : null}

          <div className="category-form__actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving…' : editingCategory ? 'Save changes' : 'Create Category'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <AdminLoadingState message="Loading Categories…" /> : null}

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error && categories.length === 0 ? (
        <AdminEmptyState
          title="No Categories match this view"
          description="Change the search or lifecycle filter, or create a new Category."
        />
      ) : null}

      {!loading && !error && categories.length > 0 ? (
        <div className="admin-library-table category-library-table" role="table" aria-label="Category library">
          <div
            className="admin-library-table__row admin-library-table__row--header category-library-table__row"
            role="row"
          >
            <span role="columnheader">Category</span>
            <span role="columnheader">Catalog context</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Sort</span>
            <span role="columnheader">Actions</span>
          </div>

          {categories.map((category) => {
            const legacyNested =
              category.parentId !== null || category.level !== 0;
            return (
              <div
                className="admin-library-table__row category-library-table__row"
                role="row"
                key={category.id}
              >
                <span className="admin-library-table__primary" role="cell">
                  <strong>{category.name}</strong>
                  <small>{category.code}</small>
                </span>
                <span role="cell">
                  {legacyNested
                    ? `Legacy child of ${category.parentName ?? 'unknown parent'}`
                    : 'Top-level Category'}
                </span>
                <span role="cell">
                  <AdminStatusBadge
                    status={category.status}
                    label={prettyStatus(category.status)}
                  />
                </span>
                <span role="cell">{category.sortOrder}</span>
                <span className="category-library-table__actions" role="cell">
                  {!legacyNested ? (
                    <a
                      className="button button--secondary"
                      href={`/admin/catalog/part-groups?categoryId=${category.id}`}
                    >
                      Part Groups
                    </a>
                  ) : null}
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={legacyNested}
                    title={
                      legacyNested
                        ? 'Legacy nested Categories are read-only. Migrate them into the canonical Category → Part Group hierarchy.'
                        : undefined
                    }
                    onClick={() => openEditForm(category)}
                  >
                    {legacyNested ? 'Legacy read-only' : 'Edit'}
                  </button>
                  <AdminMasterLifecycleActions
                    domain="CATALOG"
                    entityType="CATEGORY"
                    entityId={category.id}
                    entityName={category.name}
                    status={category.status}
                    version={category.version}
                    reactivatePath={`/api/admin/catalog/categories/${category.id}`}
                    disabled={!canManage}
                    onCompleted={() =>
                      setReloadKey((current) => current + 1)
                    }
                  />
                </span>
              </div>
            );
          })}
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
    .slice(0, 50);
}

function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 140);
}

function prettyStatus(value: MasterDataStatus): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
