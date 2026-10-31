'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ClientApiError, postJson } from '@/lib/client-api';
import {
  allowedApplicationActions,
  allApplicationDocumentsVerified,
  formatApplicationStatus,
  validateApplicationDecision,
  type SellerApplicationDecision,
  type SellerApplicationDetail,
  type SellerApplicationPage,
  type SellerApplicationReviewAction,
  type SellerApplicationStatus,
  type SellerApplicationSummary,
} from '@/lib/seller-application-review';
import { AdminPageHeader } from './admin-page-header';
import { SellerManagementTabs } from './seller-management-tabs';
import { AdminStatusBadge } from './admin-status-badge';
import { SellerApplicationDocuments } from './seller-application-documents';
import { useAdminPrincipal } from './admin-session';

const statusFilters: Array<{ label: string; value: SellerApplicationStatus | '' }> = [
  { label: 'All applications', value: '' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Changes Requested', value: 'CHANGES_REQUESTED' },
  { label: 'Resubmitted', value: 'RESUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const actionLabels: Record<SellerApplicationReviewAction, string> = {
  START_REVIEW: 'Start review',
  REQUEST_CORRECTIONS: 'Request corrections',
  APPROVE: 'Approve application',
  REJECT: 'Reject application',
};

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ClientApiError ? error.message : fallback;
}

export function SellerApplicationReview() {
  const principal = useAdminPrincipal();
  const canManage = principal.permissions.includes('seller.manage');

  const [status, setStatus] = useState<SellerApplicationStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [results, setResults] = useState<SellerApplicationPage | null>(null);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const [application, setApplication] = useState<SellerApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<SellerApplicationReviewAction | null>(null);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setListLoading(true);
      setListError('');
      try {
        const query = new URLSearchParams({ page: String(page) });
        if (search.trim()) query.set('search', search.trim());
        if (status) query.set('status', status);
        const response = await fetch(
          `/api/admin/seller-applications?${query.toString()}`,
          { credentials: 'same-origin', cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error('Application review service is unavailable.');
        const result = (await response.json()) as SellerApplicationPage;
        if (!Array.isArray(result.items)) throw new Error('Invalid application list.');
        if (!controller.signal.aborted) setResults(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults(null);
          setListError(error instanceof Error ? error.message : 'Could not load applications.');
        }
      } finally {
        if (!controller.signal.aborted) setListLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [canManage, status, search, page, reload]);

  useEffect(() => {
    if (!canManage || !selectedId) return;
    const controller = new AbortController();
    setApplication(null);
    setAction(null);
    setReason('');
    setDetailError('');
    setSuccess('');
    setDetailLoading(true);
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/seller-applications/${encodeURIComponent(selectedId)}`,
          { credentials: 'same-origin', cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error('Application details could not be loaded.');
        const result = (await response.json()) as SellerApplicationDetail;
        if (result.id !== selectedId || !Array.isArray(result.documents)) {
          throw new Error('Invalid application details.');
        }
        if (!controller.signal.aborted) setApplication(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setDetailError(error instanceof Error ? error.message : 'Unable to load this application.');
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => controller.abort();
  }, [canManage, selectedId, reload]);

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application || !action || working) return;
    const decision: SellerApplicationDecision = {
      action,
      version: application.version,
      ...(action === 'REJECT' || action === 'REQUEST_CORRECTIONS'
        ? { reason: reason.trim() }
        : {}),
    };
    const validationError = validateApplicationDecision(
      application.status,
      decision,
      application.documents,
    );
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setWorking(true);
    setActionError('');
    setSuccess('');
    try {
      const updated = await postJson<SellerApplicationDetail>(
        `/api/admin/seller-applications/${application.id}/decision`,
        decision,
      );
      setApplication(updated);
      setAction(null);
      setReason('');
      setSuccess('The application decision was saved. Review the updated status.');
      setReload((value) => value + 1);
    } catch (error) {
      setActionError(errorMessage(error, 'This decision could not be saved.'));
    } finally {
      setWorking(false);
    }
  }

  async function reviewDocument(
    documentId: string,
    status: 'VERIFIED' | 'REJECTED',
    reason = '',
  ) {
    if (!application || working) return;
    reason = reason.trim();
    if (status === 'REJECTED' && reason.length < 10) {
      setActionError('Explain why the document was rejected (at least 10 characters).');
      return;
    }
    setWorking(true);
    setActionError('');
    setSuccess('');
    try {
      const updated = await postJson<SellerApplicationDetail>(
        `/api/admin/seller-applications/${application.id}/documents/${documentId}/review`,
        {
          status,
          version: application.version,
          ...(status === 'REJECTED' ? { reason } : {}),
        },
      );
      setApplication(updated);
      setSuccess('Document review saved.');
    } catch (error) {
      setActionError(errorMessage(error, 'Document review could not be saved.'));
    } finally {
      setWorking(false);
    }
  }

  function selectApplication(item: SellerApplicationSummary) {
    setSelectedId(item.id);
    setAction(null);
    setActionError('');
    setSuccess('');
  }

  return (
    <div className="catalog-page">
      <AdminPageHeader
        eyebrow="Marketplace / Seller onboarding"
        title="Seller applications"
        description="Review business registrations before approving Seller accounts. Application decisions are separate from existing Seller Governance."
      />

      <SellerManagementTabs activeTab="applications" />

      {!canManage ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your Admin account needs the seller.manage permission to review applications.
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1.15fr)]">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Application queue">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <label className="text-sm font-medium text-slate-700">
                Search reference or business
                <input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                  maxLength={120}
                  placeholder="Search applications"
                  type="search"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Status
                <select
                  value={status}
                  onChange={(event) => { setStatus(event.target.value as SellerApplicationStatus | ''); setPage(1); }}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  {statusFilters.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {listError ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{listError}</p> : null}
            {listLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading applications…</p> : null}
            {!listLoading && results?.items.length === 0 ? <p className="mt-5 text-sm text-slate-600">No applications match the selected filters.</p> : null}
            {results ? (
              <>
                <div className="mt-4 divide-y divide-slate-100">
                  {results.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selectedId === item.id}
                      onClick={() => selectApplication(item)}
                      className={`flex w-full flex-col gap-1.5 px-2 py-3 text-left transition hover:bg-slate-50 ${selectedId === item.id ? 'bg-red-50' : ''}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-950">{item.businessName}</span>
                        <AdminStatusBadge status={item.status} />
                      </div>
                      <span className="text-xs text-slate-500">{item.referenceCode}</span>
                      <span className="text-xs text-slate-500">Submitted {displayDate(item.submittedAt)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">
                    Page {results.page} of {Math.max(results.pageCount, 1)} · {results.total} applications
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">Previous</button>
                    <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= results.pageCount} className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">Next</button>
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Application review">
            {!selectedId ? <p className="text-sm text-slate-600">Select an application to review its submitted details and document verification statuses.</p> : null}
            {detailLoading ? <p role="status" className="text-sm text-slate-500">Loading application details…</p> : null}
            {detailError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{detailError}</p> : null}
            {application && !detailLoading ? (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">{application.businessName}</h2>
                    <AdminStatusBadge status={application.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{application.referenceCode} · Revision {application.version} · {formatApplicationStatus(application.status)}</p>
                </div>

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {([
                    ['Contact name', application.contactName],
                    ['Contact email', application.contactEmail],
                    ['Contact phone', application.contactPhone],
                    ['Business email', application.businessEmail],
                    ['Business phone', application.businessPhone],
                    ['Trading name', application.displayName],
                    ['Seller type', application.sellerType],
                    ['Location', `${application.city}, ${application.region}`],
                    ['Physical address', application.address],
                    ['Commercial registration', application.commercialRegistrationNumber],
                    ['Trade licence', application.tradeLicenseNumber],
                    ['TIN', application.tinNumber],
                    ['VAT registration', application.vatRegistrationNumber],
                  ] as Array<[string, string]>).map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-slate-50 p-2.5">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 break-words font-medium text-slate-900">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>

                <SellerApplicationDocuments
                  key={application.id}
                  application={application}
                  working={working}
                  onReview={reviewDocument}
                />

                {application.correctionReason ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <strong>Latest applicant-facing correction reason</strong>
                    <p className="mt-1 whitespace-pre-wrap">{application.correctionReason}</p>
                  </div>
                ) : null}

                {success ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p> : null}
                {actionError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionError}</p> : null}

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-950">Review decision</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allowedApplicationActions(application.status).map((nextAction) => (
                      <button
                        key={nextAction}
                        type="button"
                        onClick={() => { setAction(nextAction); setReason(''); setActionError(''); }}
                        disabled={working || (nextAction === 'APPROVE' && !allApplicationDocumentsVerified(application.documents))}
                        aria-pressed={action === nextAction}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${action === nextAction ? 'border-[#a71920] bg-red-50 text-[#a71920]' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        {actionLabels[nextAction]}
                      </button>
                    ))}
                  </div>
                  {action ? (
                    <form onSubmit={submitDecision} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      {(action === 'REJECT' || action === 'REQUEST_CORRECTIONS') ? (
                        <label className="block text-sm font-medium text-slate-800">
                          Reason shown to the applicant
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            minLength={10}
                            maxLength={1000}
                            rows={4}
                            required
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
                            placeholder="Explain what must be corrected or why this application was rejected."
                          />
                        </label>
                      ) : null}
                      {action === 'APPROVE' ? (
                        <p className="text-sm text-amber-800">
                          Approval requires verified documents and a completed identity review.
                          Account provisioning and invitation email must be enforced by the backend.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => setAction(null)} disabled={working} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
                        <button type="submit" disabled={working} className="rounded-lg bg-[#a71920] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          {working ? 'Saving…' : `Confirm: ${actionLabels[action]}`}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {application.status === 'APPROVED' ? (
                    <p className="mt-3 text-xs text-slate-600">Approval is recorded separately from account activation. The secure invitation is issued by the provisioned account workflow.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
