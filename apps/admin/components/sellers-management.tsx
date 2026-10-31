'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { AdminSavedViewRecord } from '@/lib/admin-saved-view-contracts';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import type {
  ProvisionSellerAccountInput,
  SellerApprovalStatus,
  SellerPage,
  SellerProvisioningRecord,
  SellerRecord,
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
  UpdateSellerInput,
} from '@/lib/marketplace-contracts';
import { ErrorAlert } from './error-alert';
import { ShieldIcon } from './icons';
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
import { SellerManagementTabs } from './seller-management-tabs';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';
import { useAdminPrincipal } from './admin-session';
import { useAdminInlineFormKeyboard } from '@/lib/use-admin-inline-form-keyboard';
import { sellerAccountAction } from '@/lib/seller-invitation-action';

type SellerStatusFilter = 'ALL' | SellerStatus;
type SellerAdminSortBy =
  | 'UPDATED_AT'
  | 'CREATED_AT'
  | 'BUSINESS_NAME'
  | 'DISPLAY_NAME'
  | 'SELLER_CODE'
  | 'SELLER_TYPE'
  | 'STATUS'
  | 'VERIFICATION_STATUS'
  | 'APPROVAL_STATUS';
type SortDirection = 'ASC' | 'DESC';

const SELLER_SAVED_VIEW_SCOPE = 'MARKETPLACE_SELLERS';

const sellerSortOptions: Array<{ value: SellerAdminSortBy; label: string }> = [
  { value: 'UPDATED_AT', label: 'Updated time' },
  { value: 'CREATED_AT', label: 'Created date' },
  { value: 'BUSINESS_NAME', label: 'Business name' },
  { value: 'DISPLAY_NAME', label: 'Display name' },
  { value: 'SELLER_CODE', label: 'Seller code' },
  { value: 'SELLER_TYPE', label: 'Seller type' },
  { value: 'STATUS', label: 'Seller status' },
  { value: 'VERIFICATION_STATUS', label: 'Verification status' },
  { value: 'APPROVAL_STATUS', label: 'Approval status' },
];

const sellerTypes: SellerType[] = [
  'IMPORTER',
  'DISTRIBUTOR',
  'WHOLESALER',
  'RETAILER',
  'HYBRID',
  'OTHER',
];
const sellerStatuses: SellerStatus[] = [
  'APPLICATION',
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
  'BLOCKED',
];
const sellerVerificationStatuses: SellerVerificationStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
];
const sellerApprovalStatuses: SellerApprovalStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

export function SellersManagement() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('seller.manage');

  const [sellers, setSellers] = useState<SellerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<SellerStatusFilter>('ALL');
  const [verificationFilter, setVerificationFilter] =
    useState<'ALL' | SellerVerificationStatus>('ALL');
  const [approvalFilter, setApprovalFilter] =
    useState<'ALL' | SellerApprovalStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SellerType>('ALL');
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(50);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [sortBy, setSortBy] = useState<SellerAdminSortBy>('UPDATED_AT');
  const [sortDirection, setSortDirection] =
    useState<SortDirection>('DESC');
  const [savedViews, setSavedViews] = useState<AdminSavedViewRecord[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewSaving, setSavedViewSaving] = useState(false);
  const [savedViewError, setSavedViewError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SellerRecord | null>(null);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sellerCode, setSellerCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sellerType, setSellerType] = useState<SellerType>('RETAILER');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [provisioned, setProvisioned] =
    useState<SellerProvisioningRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [workingSellerId, setWorkingSellerId] = useState('');
  const [governanceError, setGovernanceError] = useState('');
  const [rejectingSellerId, setRejectingSellerId] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  const sellerFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: formOpen,
    saving,
    focusKey: editing?.id ?? 'create',
    onEscape: resetForm,
  });
  const rejectionFormKeyboard = useAdminInlineFormKeyboard<HTMLFormElement>({
    open: Boolean(rejectingSellerId),
    saving: Boolean(workingSellerId),
    focusKey: rejectingSellerId,
    onEscape: () => {
      setRejectingSellerId('');
      setDecisionReason('');
    },
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
          `/api/admin/preferences/saved-views?scope=${SELLER_SAVED_VIEW_SCOPE}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Seller saved views');

        const records = (await response.json()) as AdminSavedViewRecord[];
        if (active) setSavedViews(records);
      } catch {
        if (active) {
          setSavedViewError(
            'Saved views could not be loaded. Seller governance is still available.',
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
        if (searchValue) query.set('search', searchValue);
        if (statusFilter !== 'ALL') query.set('status', statusFilter);
        if (verificationFilter !== 'ALL') {
          query.set('verificationStatus', verificationFilter);
        }
        if (approvalFilter !== 'ALL') {
          query.set('approvalStatus', approvalFilter);
        }
        if (typeFilter !== 'ALL') query.set('sellerType', typeFilter);
        query.set('sortBy', sortBy);
        query.set('sortDirection', sortDirection);

        const response = await fetch(
          `/api/admin/sellers/page?${query.toString()}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
          },
        );
        if (!response.ok) throw new Error('Could not load Sellers');

        const page = (await response.json()) as SellerPage;
        if (!active) return;

        setSellers(page.items);
        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch {
        if (active) {
          setLoadError(
            'Seller profiles could not be loaded. Check that the API and database are running.',
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
    approvalFilter,
    canManage,
    pageNumber,
    pageSize,
    reloadKey,
    search,
    sortBy,
    sortDirection,
    statusFilter,
    typeFilter,
    verificationFilter,
  ]);

  const visibleSellers = sellers;

  function resetFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setVerificationFilter('ALL');
    setApprovalFilter('ALL');
    setTypeFilter('ALL');
    setPageNumber(1);
    setSelectedSavedViewId('');
    setSavedViewName('');
  }

  function currentSellerSavedViewState(): Record<string, unknown> {
    return {
      search,
      status: statusFilter,
      verificationStatus: verificationFilter,
      approvalStatus: approvalFilter,
      sellerType: typeFilter,
      sortBy,
      sortDirection,
      pageSize,
    };
  }

  function applySellerSavedView(view: AdminSavedViewRecord) {
    const state = view.state;

    setSearch(typeof state.search === 'string' ? state.search : '');
    setStatusFilter(
      isSellerStatusFilter(state.status) ? state.status : 'ALL',
    );
    setVerificationFilter(
      isSellerVerificationFilter(state.verificationStatus)
        ? state.verificationStatus
        : 'ALL',
    );
    setApprovalFilter(
      isSellerApprovalFilter(state.approvalStatus)
        ? state.approvalStatus
        : 'ALL',
    );
    setTypeFilter(
      isSellerTypeFilter(state.sellerType) ? state.sellerType : 'ALL',
    );
    setSortBy(isSellerSortBy(state.sortBy) ? state.sortBy : 'UPDATED_AT');
    setSortDirection(state.sortDirection === 'ASC' ? 'ASC' : 'DESC');
    setPageSize(normalizeAdminPageSize(state.pageSize));
    setPageNumber(1);
    setSelectedSavedViewId(view.id);
    setSavedViewName(view.name);
    setSavedViewError('');
  }

  async function saveSellerView() {
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
          scope: SELLER_SAVED_VIEW_SCOPE,
          name,
          state: currentSellerSavedViewState(),
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
          : 'The current Seller view could not be saved.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function updateSellerSavedView() {
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
          state: currentSellerSavedViewState(),
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
          : 'The saved Seller view could not be updated.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  async function deleteSellerSavedView() {
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
          payload?.error?.message ?? 'The saved Seller view could not be deleted.',
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
          : 'The saved Seller view could not be deleted.',
      );
    } finally {
      setSavedViewSaving(false);
    }
  }

  function clearFormFields() {
    setEditing(null);
    setContactName('');
    setPhone('');
    setEmail('');
    setSellerCode('');
    setBusinessName('');
    setDisplayName('');
    setSellerType('RETAILER');
    setFormError('');
  }

  function resetForm() {
    setFormOpen(false);
    clearFormFields();
  }

  function openEdit(seller: SellerRecord) {
    if (formOpen && !sellerFormKeyboard.confirmDiscard()) return;
    setProvisioned(null);
    setCopyStatus('');
    setEditing(seller);
    setContactName('');
    setPhone('');
    setEmail('');
    setSellerCode(seller.sellerCode);
    setBusinessName(seller.businessName);
    setDisplayName(seller.displayName);
    setSellerType(seller.sellerType);
    setFormError('');
    setFormOpen(true);
  }

  function handleBusinessNameChange(value: string) {
    if (!editing) {
      const previousGenerated = createSellerCode(businessName);
      if (!sellerCode || sellerCode === previousGenerated) {
        setSellerCode(createSellerCode(value));
      }
    }
    setBusinessName(value);
  }

  async function saveSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setCopyStatus('');

    try {
      if (editing) {
        const input: UpdateSellerInput = {
          version: editing.version,
          businessName: businessName.trim(),
          displayName: displayName.trim(),
          sellerType,
        };
        const updated = await patchJson<SellerRecord>(
          `/api/admin/sellers/${editing.id}`,
          input,
        );
        setSellers((current) =>
          current.map((seller) =>
            seller.id === updated.id ? updated : seller,
          ),
        );
        setReloadKey((current) => current + 1);
        resetForm();
      } else {
        const input: ProvisionSellerAccountInput = {
          name: contactName.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          sellerCode: sellerCode.trim(),
          businessName: businessName.trim(),
          displayName: displayName.trim(),
          sellerType,
        };
        const result = await postJson<SellerProvisioningRecord>(
          '/api/admin/sellers/provision',
          input,
        );
        setProvisioned(result);
        setFormOpen(false);
        clearFormFields();

        setPageNumber(1);
        setReloadKey((current) => current + 1);
      }
    } catch (requestError) {
      setFormError(
        requestError instanceof ClientApiError
          ? requestError.message
          : editing
            ? 'The Seller profile could not be saved. Try again.'
            : 'The Seller account could not be provisioned. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyGovernance(
    seller: SellerRecord,
    changes: Pick<UpdateSellerInput, 'verificationStatus' | 'approvalStatus' | 'status' | 'decisionReason'>,
  ) {
    setWorkingSellerId(seller.id);
    setGovernanceError('');
    try {
      const updated = await patchJson<SellerRecord>(
        `/api/admin/sellers/${seller.id}`,
        { version: seller.version, ...changes },
      );
      setSellers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setReloadKey((current) => current + 1);
      setRejectingSellerId('');
      setDecisionReason('');
    } catch (error) {
      setGovernanceError(
        error instanceof ClientApiError
          ? error.message
          : 'The Seller governance action could not be completed.',
      );
    } finally {
      setWorkingSellerId('');
    }
  }

  async function rejectSeller() {
    const seller = sellers.find((item) => item.id === rejectingSellerId);
    if (!seller || !decisionReason.trim()) return;
    await applyGovernance(seller, {
      approvalStatus: 'REJECTED',
      status: 'INACTIVE',
      decisionReason: decisionReason.trim(),
    });
  }

  async function copyActivationToken() {
    if (!provisioned) return;

    try {
      await navigator.clipboard.writeText(provisioned.activationToken);
      setCopyStatus('Activation token copied.');
    } catch {
      setCopyStatus(
        'Copy was not available. Select the token and copy it manually.',
      );
    }
  }

  if (!canManage) {
    return (
      <section className="catalog-page">
        <span className="eyebrow">Marketplace operations</span>
        <h1>Sellers</h1>
        <p>
          Your administrator account does not have the seller.manage
          permission.
        </p>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <AdminPageHeader
        eyebrow="Marketplace operations"
        title="Seller governance"
        description="Review and manage existing Seller business accounts. Sellers register and verify their credentials themselves."
      />

      <SellerManagementTabs activeTab="sellers" />

      {provisioned ? (
        <article className="account-success" aria-live="polite">
          <div className="account-success__content">
            <span className="eyebrow">Seller account provisioned</span>
            <h2>Activation token ready</h2>
            <p>
              Deliver this one-time token to the Seller through a secure
              channel. The Seller uses it to create credentials. Credential
              activation does not bypass verification or Admin approval.
            </p>

            <div className="account-token">
              <code>{provisioned.activationToken}</code>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void copyActivationToken()}
              >
                Copy token
              </button>
            </div>

            {copyStatus ? (
              <p className="account-copy-status" role="status">
                {copyStatus}
              </p>
            ) : null}

            <dl className="account-result-meta">
              <div>
                <dt>Token expires</dt>
                <dd>{formatExpiry(provisioned.expiresAt)}</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>Deliver token securely, then complete verification.</dd>
              </div>
            </dl>

            <div className="account-security-note">
              <ShieldIcon />
              <p>
                Keep the Seller in Application until credentials are activated,
                documents are verified, and Admin approval is complete. The API
                enforces these gates before Active status.
              </p>
            </div>

            <button
              className="button button--quiet"
              type="button"
              onClick={() => {
                setProvisioned(null);
                setCopyStatus('');
              }}
            >
              Close
            </button>
          </div>
        </article>
      ) : null}

      <AdminLibraryToolbar ariaLabel="Seller library filters">
        <div className="catalog-filter">
          <label htmlFor="seller-search">Search</label>
          <input
            id="seller-search"
            type="search"
            value={search}
            placeholder="Business, display name, or Seller code"
            onChange={(event) => {
              setSearch(event.target.value);
              setPageNumber(1);
            }}
          />
        </div>

        <div className="catalog-filter">
          <label htmlFor="seller-status-filter">Seller status</label>
          <select
            id="seller-status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as SellerStatusFilter);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All statuses</option>
            {sellerStatuses.map((status) => (
              <option value={status} key={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="seller-verification-filter">Verification</label>
          <select
            id="seller-verification-filter"
            value={verificationFilter}
            onChange={(event) => {
              setVerificationFilter(
                event.target.value as 'ALL' | SellerVerificationStatus,
              );
              setPageNumber(1);
            }}
          >
            <option value="ALL">All verification</option>
            {sellerVerificationStatuses.map((status) => (
              <option value={status} key={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="seller-approval-filter">Approval</label>
          <select
            id="seller-approval-filter"
            value={approvalFilter}
            onChange={(event) => {
              setApprovalFilter(
                event.target.value as 'ALL' | SellerApprovalStatus,
              );
              setPageNumber(1);
            }}
          >
            <option value="ALL">All approval</option>
            {sellerApprovalStatuses.map((status) => (
              <option value={status} key={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="seller-type-filter">Seller type</label>
          <select
            id="seller-type-filter"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as 'ALL' | SellerType);
              setPageNumber(1);
            }}
          >
            <option value="ALL">All types</option>
            {sellerTypes.map((type) => (
              <option value={type} key={type}>
                {label(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="seller-sort-by">Sort by</label>
          <select
            id="seller-sort-by"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as SellerAdminSortBy);
              setPageNumber(1);
            }}
          >
            {sellerSortOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="catalog-filter">
          <label htmlFor="seller-sort-direction">Direction</label>
          <select
            id="seller-sort-direction"
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
              verificationFilter !== 'ALL' ||
              approvalFilter !== 'ALL' ||
              typeFilter !== 'ALL',
          )}
          onReset={resetFilters}
        />

        <AdminLibraryCount
          count={total}
          singular="Seller"
          plural="Sellers"
        />
      </AdminLibraryToolbar>

      <AdminSavedViewsToolbar
        idPrefix="seller-governance"
        savedViews={savedViews}
        loading={savedViewsLoading}
        saving={savedViewSaving}
        selectedId={selectedSavedViewId}
        name={savedViewName}
        namePlaceholder="Pending verification retailers"
        error={savedViewError}
        onSelect={(view) => {
          if (view) applySellerSavedView(view);
          else {
            setSelectedSavedViewId('');
            setSavedViewName('');
          }
        }}
        onNameChange={setSavedViewName}
        onSaveAsNew={() => void saveSellerView()}
        onUpdate={() => void updateSellerSavedView()}
        onDelete={() => void deleteSellerSavedView()}
      />

      {formOpen ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Seller editor"
            disabled={saving}
            onClick={sellerFormKeyboard.requestClose}
          />
          <aside
            className="catalog-drawer seller-editor-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Edit Seller' : 'Provision Seller'}
          >
            <form
                      className="catalog-drawer__form seller-editor-form"
                      ref={sellerFormKeyboard.ref}
                      onKeyDown={sellerFormKeyboard.onKeyDown}
                      onSubmit={saveSeller}
                    >
                      <div className="catalog-drawer__heading">
                        <div>
                          <span className="eyebrow">
                            {editing ? 'Seller lifecycle' : 'Seller onboarding'}
                          </span>
                          <h2>
                            {editing ? editing.displayName : 'Provision Seller account'}
                          </h2>
                          <p>
                            {editing
                              ? 'Edit the business profile here. Use the audited governance actions in the Seller list for verification, approval, activation, suspension, or rejection.'
                              : 'Create the Seller identity and business profile together. A one-time activation token will be shown after provisioning.'}
                          </p>
                        </div>
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={sellerFormKeyboard.requestClose}
                        >
                          Close
                        </button>
                      </div>

                      <ErrorAlert message={formError} />

                      <div className="category-form__grid">
                        {!editing ? (
                          <>
                            <label className="field">
                              <span className="field__label">Seller owner / contact name</span>
                              <div className="field__control">
                                <input
                                  required
                                  minLength={2}
                                  maxLength={100}
                                  autoComplete="name"
                                  value={contactName}
                                  placeholder="Example: Abebe Bekele"
                                  onChange={(event) => setContactName(event.target.value)}
                                />
                              </div>
                            </label>

                            <label className="field">
                              <span className="field__label">Phone</span>
                              <div className="field__control">
                                <input
                                  required
                                  inputMode="tel"
                                  autoComplete="tel"
                                  pattern="^\+[1-9]\d{7,14}$"
                                  value={phone}
                                  placeholder="+251911223344"
                                  onChange={(event) => setPhone(event.target.value)}
                                />
                              </div>
                              <small className="field__hint">
                                Use international E.164 format, including the leading +.
                              </small>
                            </label>

                            <label className="field">
                              <span className="field__label">Email (optional)</span>
                              <div className="field__control">
                                <input
                                  type="email"
                                  autoComplete="email"
                                  maxLength={254}
                                  value={email}
                                  placeholder="seller@example.com"
                                  onChange={(event) => setEmail(event.target.value)}
                                />
                              </div>
                            </label>
                          </>
                        ) : (
                          <div className="product-master-form__locked">
                            <span>Linked Seller identity</span>
                            <strong>Provisioned account</strong>
                            <small>
                              Identity ownership is fixed after Seller provisioning.
                            </small>
                          </div>
                        )}

                        <label className="field">
                          <span className="field__label">Registered business name</span>
                          <div className="field__control">
                            <input
                              required
                              minLength={2}
                              maxLength={180}
                              value={businessName}
                              placeholder="Example: Addis Auto Parts PLC"
                              onChange={(event) =>
                                handleBusinessNameChange(event.target.value)
                              }
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span className="field__label">Marketplace display name</span>
                          <div className="field__control">
                            <input
                              required
                              minLength={2}
                              maxLength={160}
                              value={displayName}
                              placeholder="Example: Addis Auto Parts"
                              onChange={(event) => setDisplayName(event.target.value)}
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span className="field__label">Seller type</span>
                          <select
                            className="category-form__select"
                            value={sellerType}
                            onChange={(event) =>
                              setSellerType(event.target.value as SellerType)
                            }
                          >
                            {sellerTypes.map((type) => (
                              <option value={type} key={type}>
                                {label(type)}
                              </option>
                            ))}
                          </select>
                        </label>

                        {editing ? (
                          <div className="product-master-form__locked">
                            <span>Governance lifecycle</span>
                            <strong>
                              {label(editing.verificationStatus)} · {label(editing.approvalStatus)} · {label(editing.status)}
                            </strong>
                            <small>
                              Verification, approval and operational state are controlled by
                              explicit governance actions in the Seller list.
                            </small>
                          </div>
                        ) : null}
                      </div>

                      <details className="catalog-workspace-advanced">
                        <summary>Advanced technical fields</summary>
                        <label className="field">
                          <span className="field__label">Seller code</span>
                          <div className="field__control">
                            <input
                              required
                              minLength={2}
                              maxLength={50}
                              disabled={Boolean(editing)}
                              value={sellerCode}
                              placeholder="ADDIS_AUTO_PARTS_PLC"
                              onChange={(event) =>
                                setSellerCode(createSellerCode(event.target.value))
                              }
                            />
                          </div>
                          <small className="field__hint">
                            Generated from the registered business name. Change only when a
                            governance or migration rule requires a specific identifier.
                          </small>
                        </label>
                      </details>

                      <div className="catalog-drawer__actions seller-editor-actions">
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={saving}
                        >
                          {saving
                            ? 'Saving…'
                            : editing
                              ? 'Save Seller'
                              : 'Provision Seller'}
                        </button>
                      </div>
                    </form>
          </aside>
        </div>
      ) : null}

      {governanceError ? <ErrorAlert message={governanceError} /> : null}

      {rejectingSellerId ? (
        <div className="catalog-drawer-layer" role="presentation">
          <button
            className="catalog-drawer-scrim"
            type="button"
            aria-label="Close Seller rejection"
            disabled={Boolean(workingSellerId)}
            onClick={rejectionFormKeyboard.requestClose}
          />
          <aside
            className="catalog-drawer catalog-drawer--compact seller-rejection-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Reject Seller application"
          >
            <form
                      className="catalog-drawer__form seller-rejection-form"
                      ref={rejectionFormKeyboard.ref}
                      onKeyDown={rejectionFormKeyboard.onKeyDown}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void rejectSeller();
                      }}
                    >
                      <div className="catalog-drawer__heading">
                        <div>
                          <span className="eyebrow">Governance decision</span>
                          <h2>Reject Seller application</h2>
                          <p>Record the reason in the audit trail before closing the application.</p>
                        </div>
                        <button className="button button--quiet" type="button" onClick={rejectionFormKeyboard.requestClose}>
                          Cancel
                        </button>
                      </div>
                      <label className="field">
                        <span className="field__label">Decision reason</span>
                        <textarea required maxLength={500} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
                      </label>
                      <div className="catalog-drawer__actions seller-editor-actions">
                        <button className="button button--primary" type="submit" disabled={!decisionReason.trim() || Boolean(workingSellerId)}>
                          Reject application
                        </button>
                      </div>
                    </form>
          </aside>
        </div>
      ) : null}

      {loading ? <AdminLoadingState message="Loading Seller profiles…" /> : null}

      {loadError ? <ErrorAlert message={loadError} /> : null}

      {!loading && !loadError && visibleSellers.length === 0 ? (
        <AdminEmptyState
          title="No Seller profiles found"
          description="No Seller profiles match this view. Sellers register their own accounts; check Open Applications or adjust the current filters."
        />
      ) : null}

      {!loading && !loadError && visibleSellers.length > 0 ? (
        <div
          className="admin-library-table seller-governance-table"
          role="table"
          aria-label="Seller Governance library"
        >
          <div
            className="admin-library-table__row admin-library-table__row--header seller-governance-table__row"
            role="row"
          >
            <span role="columnheader">Seller</span>
            <span role="columnheader">Business / Type</span>
            <span role="columnheader">Verification</span>
            <span role="columnheader">Approval</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Next required step</span>
            <span role="columnheader">Actions</span>
          </div>

          {visibleSellers.map((seller) => (
            <div
              className="admin-library-table__row seller-governance-table__row"
              role="row"
              key={seller.id}
            >
              <span className="admin-library-table__primary" role="cell">
                <strong>{seller.displayName}</strong>
                <small>{seller.sellerCode}</small>
              </span>
              <span className="seller-governance-table__stack" role="cell">
                <strong>{seller.businessName}</strong>
                <small>{label(seller.sellerType)}</small>
              </span>
              <span className="seller-governance-state" role="cell">
                {label(seller.verificationStatus)}
              </span>
              <span className="seller-governance-state" role="cell">
                {label(seller.approvalStatus)}
              </span>
              <span role="cell">
                <AdminStatusBadge
                  status={seller.status}
                  label={label(seller.status)}
                />
              </span>
              <span
                className={`seller-governance-next-step seller-governance-next-step--${sellerNextStep(seller).tone}`}
                role="cell"
              >
                {sellerNextStep(seller).message}
              </span>
              <span className="seller-governance-table__actions" role="cell">
                {sellerAccountAction(seller) === 'REACTIVATE' ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={Boolean(workingSellerId)}
                    onClick={() => void applyGovernance(seller, { status: 'ACTIVE' })}
                  >
                    Reactivate
                  </button>
                ) : null}
                {seller.status === 'ACTIVE' ? (
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={workingSellerId === seller.id}
                    onClick={() =>
                      void applyGovernance(seller, { status: 'SUSPENDED' })
                    }
                  >
                    Suspend
                  </button>
                ) : null}
                {seller.approvalStatus !== 'REJECTED' &&
                seller.status !== 'ACTIVE' ? (
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={workingSellerId === seller.id}
                    onClick={() => {
                      setRejectingSellerId(seller.id);
                      setDecisionReason('');
                      setGovernanceError('');
                    }}
                  >
                    Reject
                  </button>
                ) : null}
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => openEdit(seller)}
                >
                  Edit
                </button>
              </span>
            </div>
          ))}
        </div>
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


function sellerNextStep(
  seller: SellerRecord,
): { tone: 'ready' | 'attention' | 'blocked'; message: string } {
  if (
    seller.verificationStatus === 'REJECTED' ||
    seller.approvalStatus === 'REJECTED' ||
    seller.status === 'BLOCKED'
  ) {
    return {
      tone: 'blocked',
      message: 'Blocked by governance decision. Review the Seller record before any activation action.',
    };
  }

  if (seller.verificationStatus !== 'VERIFIED') {
    return {
      tone: 'attention',
      message:
        seller.verificationStatus === 'UNDER_REVIEW'
          ? 'Complete verification review before approval.'
          : 'Verify Seller identity and documents before approval.',
    };
  }

  if (seller.approvalStatus !== 'APPROVED') {
    return {
      tone: 'attention',
      message: 'Approve this verified Seller before activation.',
    };
  }

  if (seller.status === 'ACTIVE') {
    return {
      tone: 'ready',
      message: 'Ready. Seller is approved, verified, and active.',
    };
  }

  if (seller.status === 'SUSPENDED') {
    return {
      tone: 'attention',
      message: 'Reactivate only after the suspension condition is cleared.',
    };
  }

  return {
    tone: 'attention',
    message: 'The Seller is not operational. Check the application status or contact Support for legacy account activation.',
  };
}

function isSellerSortBy(value: unknown): value is SellerAdminSortBy {
  return (
    value === 'UPDATED_AT' ||
    value === 'CREATED_AT' ||
    value === 'BUSINESS_NAME' ||
    value === 'DISPLAY_NAME' ||
    value === 'SELLER_CODE' ||
    value === 'SELLER_TYPE' ||
    value === 'STATUS' ||
    value === 'VERIFICATION_STATUS' ||
    value === 'APPROVAL_STATUS'
  );
}

function isSellerStatusFilter(
  value: unknown,
): value is SellerStatusFilter {
  return (
    value === 'ALL' ||
    sellerStatuses.some((status) => status === value)
  );
}

function isSellerVerificationFilter(
  value: unknown,
): value is 'ALL' | SellerVerificationStatus {
  return (
    value === 'ALL' ||
    sellerVerificationStatuses.some((status) => status === value)
  );
}

function isSellerApprovalFilter(
  value: unknown,
): value is 'ALL' | SellerApprovalStatus {
  return (
    value === 'ALL' ||
    sellerApprovalStatuses.some((status) => status === value)
  );
}

function isSellerTypeFilter(
  value: unknown,
): value is 'ALL' | SellerType {
  return value === 'ALL' || sellerTypes.some((type) => type === value);
}

function createSellerCode(value: string): string {
  const normalized = value
    .trim()
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');

  if (normalized) return normalized.slice(0, 50);

  const codePoints = Array.from(value.trim())
    .map((character) => character.codePointAt(0)?.toString(16).toUpperCase())
    .filter((part): part is string => Boolean(part))
    .join('_');

  return `SELLER_${codePoints || 'ACCOUNT'}`.slice(0, 50);
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function label(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}
