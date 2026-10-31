'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  AdminAccountPage,
  AdminAccountRecord,
  AdminAccountStatus,
  AdminProvisioningRecord,
  ProvisionAdminInput,
  UpdateAdminAccountStatusInput,
} from '@/lib/admin-account-contracts';
import {
  hasAdminAccountManagePermission,
  normalizeProvisionAdminInput,
} from '@/lib/admin-account-management';
import { ClientApiError, patchJson, postJson } from '@/lib/client-api';
import { formatAdminEnumLabel } from '@/lib/admin-display';
import { useAdminPrincipal } from './admin-session';
import { ErrorAlert } from './error-alert';
import { KeyIcon, ShieldIcon, UsersIcon } from './icons';
import { AdminFilterResetButton } from './admin-filter-reset-button';
import { AdminPageHeader } from './admin-page-header';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminEmptyState, AdminLoadingState } from './admin-state';

type AdminAccountStatusFilter = 'ALL' | AdminAccountStatus;

const adminAccountStatuses: AdminAccountStatus[] = [
  'PROVISIONED',
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED',
  'DEACTIVATED',
];

export function AdminAccountsManagement() {
  const principal = useAdminPrincipal();
  const canManage = hasAdminAccountManagePermission(principal.permissions);
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<AdminAccountStatusFilter>('ALL');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [workingId, setWorkingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<AdminProvisioningRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

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
        const searchValue = search.trim();
        if (searchValue) query.set('search', searchValue);
        if (statusFilter !== 'ALL') query.set('status', statusFilter);

        const response = await fetch(
          `/api/admin/accounts/page?${query.toString()}`,
          { credentials: 'same-origin', cache: 'no-store' },
        );
        if (!response.ok) throw new Error('Could not load Admin accounts');

        const page = (await response.json()) as AdminAccountPage;
        if (!active) return;

        setAccounts(page.items);
        setTotal(page.total);
        setPageCount(page.pageCount);
        if (page.pageCount > 0 && pageNumber > page.pageCount) {
          setPageNumber(page.pageCount);
        }
      } catch {
        if (active) setLoadError('Admin accounts could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [canManage, pageNumber, reloadKey, search, statusFilter]);

  async function provisionAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: ProvisionAdminInput = normalizeProvisionAdminInput({ name, email });
    setSaving(true); setFormError(''); setCopyStatus('');
    try {
      const provisioned = await postJson<AdminProvisioningRecord>('/api/admin/accounts/provision', input);
      setResult(provisioned);
      setPageNumber(1);
      setReloadKey((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof ClientApiError ? error.message : 'The Admin account could not be provisioned. Try again.');
    } finally { setSaving(false); }
  }

  async function changeStatus(account: AdminAccountRecord, status: UpdateAdminAccountStatusInput['status']) {
    setWorkingId(account.id); setActionError('');
    try {
      const updated = await patchJson<AdminAccountRecord>(
        `/api/admin/accounts/${account.id}/status`,
        { status },
      );
      setAccounts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setReloadKey((current) => current + 1);
    } catch (error) {
      setActionError(error instanceof ClientApiError ? error.message : 'The Admin account status could not be changed.');
    } finally { setWorkingId(''); }
  }

  async function copyActivationToken() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.activationToken); setCopyStatus('Activation token copied.'); }
    catch { setCopyStatus('Copy was not available. Select the token and copy it manually.'); }
  }

  function resetForm() {
    setName(''); setEmail(''); setResult(null); setFormError(''); setCopyStatus('');
  }

  function resetFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setPageNumber(1);
  }

  if (!canManage) return (
    <section className="account-page"><div className="account-heading"><span className="eyebrow">Privileged access</span><h1>Admin accounts</h1><p>Your administrator account does not have the admin.accounts.manage permission.</p></div></section>
  );

  return (
    <section className="account-page">
      <AdminPageHeader
        eyebrow="Privileged access"
        title="Admin accounts"
        description="Provision administrators, verify MFA readiness and roles, review recent activity, and control privileged account lifecycle."
      />

      {actionError ? <ErrorAlert message={actionError} /> : null}
      {result ? (
        <article className="account-success" aria-live="polite">
          <div className="account-success__icon"><KeyIcon /></div>
          <div className="account-success__content">
            <span className="eyebrow">Sensitive credential</span>
            <h2>Activation token ready</h2>
            <p>Deliver this one-time token through a secure out-of-band channel.</p>
            <div className="account-token"><code>{result.activationToken}</code><button className="button button--secondary" type="button" onClick={() => void copyActivationToken()}>Copy token</button></div>
            {copyStatus ? <p className="account-copy-status" role="status">{copyStatus}</p> : null}
            <button className="button button--quiet" type="button" onClick={resetForm}>Close token</button>
          </div>
        </article>
      ) : null}

      <div className="account-workspace-grid">
        <section className="account-console-card">
          <div className="account-console-heading"><div><span className="eyebrow">Access governance</span><h2>Administrators</h2></div><span className="catalog-count">{total} accounts</span></div>
          <div className="catalog-toolbar catalog-toolbar--filters">
            <div className="catalog-filter">
              <label htmlFor="admin-account-search">Search</label>
              <input
                id="admin-account-search"
                type="search"
                value={search}
                placeholder="Name or email"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageNumber(1);
                }}
              />
            </div>
            <div className="catalog-filter">
              <label htmlFor="admin-account-status">Status</label>
              <select
                id="admin-account-status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value as AdminAccountStatusFilter,
                  );
                  setPageNumber(1);
                }}
              >
                <option value="ALL">All statuses</option>
                {adminAccountStatuses.map((status) => (
                  <option value={status} key={status}>
                    {formatAdminEnumLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <AdminFilterResetButton
          active={Boolean(search.trim() || statusFilter !== 'ALL')}
          onReset={resetFilters}
        />
          </div>
          {loading ? <AdminLoadingState message="Loading Admin accounts…" /> : null}
          {loadError ? <ErrorAlert message={loadError} /> : null}
          {!loading && !loadError && accounts.length === 0 ? (
            <AdminEmptyState title="No Admin accounts found" headingLevel={3} />
          ) : null}
          <div className="admin-account-list" role="table" aria-label="Admin accounts">
            <div
              className="admin-account-row admin-account-row--header"
              role="row"
            >
              <span role="columnheader">Administrator</span>
              <span role="columnheader">MFA</span>
              <span role="columnheader">Last activity</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Actions</span>
            </div>
            {accounts.map((account) => (
              <article className="admin-account-row" role="row" key={account.id}>
                <div className="admin-account-row__identity" role="cell">
                  <strong>{account.name ?? 'Unnamed administrator'}</strong>
                  <span>{account.email ?? account.id}</span>
                  <small>{account.roles.map((role) => role.name).join(', ') || 'No role'} · {account.roles.reduce((n, role) => n + role.permissions.length, 0)} permissions</small>
                </div>
                <div role="cell"><small>MFA</small><strong>{account.mfaEnrolled ? 'Enrolled' : 'Not enrolled'}</strong></div>
                <div role="cell"><small>Last activity</small><strong>{formatActivity(account.lastSeenAt)}</strong></div>
                <AdminStatusBadge status={account.status} role="cell" />
                <div className="admin-account-row__actions" role="cell">
                  {account.status === 'ACTIVE' ? <>
                    <button className="button button--quiet" type="button" disabled={workingId === account.id || account.id === principal.userId} onClick={() => void changeStatus(account, 'SUSPENDED')}>Suspend</button>
                    <button className="button button--quiet" type="button" disabled={workingId === account.id || account.id === principal.userId} onClick={() => void changeStatus(account, 'DEACTIVATED')}>Deactivate</button>
                  </> : account.mfaEnrolled && (account.status === 'SUSPENDED' || account.status === 'DEACTIVATED' || account.status === 'RESTRICTED') ? (
                    <button className="button button--secondary" type="button" disabled={workingId === account.id} onClick={() => void changeStatus(account, 'ACTIVE')}>Reactivate</button>
                  ) : <span className="admin-account-row__state">{account.status === 'PROVISIONED' ? 'Awaiting activation' : 'No action'}</span>}
                </div>
              </article>
            ))}
          </div>
          {!loading && !loadError && total > 0 ? (
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

        <article className="account-provision-card">
          <div className="account-provision-card__intro"><span className="account-provision-card__icon"><UsersIcon /></span><div><span className="eyebrow">New administrator</span><h2>Provision account</h2><p>The platform-admin role is assigned by the secured backend policy.</p></div></div>
          <form className="form-stack" onSubmit={provisionAdmin}>
            <ErrorAlert message={formError} />
            <label className="field"><span className="field__label">Full name</span><span className="field__control"><input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></span></label>
            <label className="field"><span className="field__label">Email address</span><span className="field__control"><input type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></span></label>
            <div className="account-security-note"><ShieldIcon /><p>Provisioning and lifecycle changes are audited. Suspended or deactivated accounts have active sessions revoked.</p></div>
            <button className="button button--primary" disabled={saving} type="submit">{saving ? <span className="spinner" /> : <KeyIcon />}{saving ? 'Provisioning…' : 'Provision Admin'}</button>
          </form>
        </article>
      </div>
    </section>
  );
}

function formatActivity(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
