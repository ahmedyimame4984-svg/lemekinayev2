'use client';

import Link from 'next/link';
import { CheckCircle2, Clock3, FileCheck2, LockKeyhole, PencilLine } from 'lucide-react';
import type { SellerApplicationDetail } from '@/lib/seller-application-workspace';

const statusNames: Record<SellerApplicationDetail['status'], string> = {
  SUBMITTED: 'Awaiting Admin review',
  RESUBMITTED: 'Resubmitted — awaiting review',
  UNDER_REVIEW: 'Under review',
  CHANGES_REQUESTED: 'Corrections requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function SellerApplicationTracker({
  application,
  onEdit,
}: {
  application: SellerApplicationDetail;
  onEdit: () => void;
}) {
  const events = [
    { action: 'SUBMITTED', toStatus: 'SUBMITTED', createdAt: application.submittedAt, reason: null },
    ...application.reviewEvents,
  ];
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">My Application</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Business verification</h1>
          <p className="mt-2 text-sm text-slate-600">Track your application and Admin review progress in one place.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
          {statusNames[application.status]}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-rose-50 p-3 text-rose-800"><FileCheck2 size={22} /></span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">{application.businessName}</h2>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">{application.referenceCode}</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Submitted</dt><dd className="mt-1 text-sm font-medium text-slate-800">{new Date(application.submittedAt).toLocaleDateString()}</dd></div>
            <div><dt className="text-xs text-slate-500">Current status</dt><dd className="mt-1 text-sm font-medium text-slate-800">{statusNames[application.status]}</dd></div>
            <div><dt className="text-xs text-slate-500">Contact email</dt><dd className="mt-1 break-all text-sm font-medium text-slate-800">{application.contactEmail}</dd></div>
            <div><dt className="text-xs text-slate-500">Documents</dt><dd className="mt-1 text-sm font-medium text-slate-800">{application.documents.length} on file</dd></div>
          </dl>
          {application.correctionReason ? (
            <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Admin feedback</strong><p className="mt-1 whitespace-pre-wrap">{application.correctionReason}</p>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            {application.canEdit ? (
              <button type="button" onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#851318] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
                <PencilLine size={16}/> Edit application
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                <LockKeyhole size={16}/> {application.status === 'UNDER_REVIEW'
                  ? 'Editing is locked while Admin reviews your application.'
                  : 'This application is read-only.'}
              </span>
            )}
            <Link href="/articles" className="text-sm font-semibold text-rose-800 hover:underline">Browse approved Articles</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">Review timeline</h2>
          <p className="mt-1 text-xs text-slate-500">All published decisions in chronological order.</p>
          <ol className="mt-5 space-y-4">
            {events.map((event, index) => (
              <li key={`${event.action}-${event.createdAt}-${index}`} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  {index === events.length - 1 ? <Clock3 size={16}/> : <CheckCircle2 size={16}/>}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{event.toStatus.replaceAll('_', ' ')}</p>
                  <time className="text-xs text-slate-500" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                  {event.reason ? <p className="mt-1 text-xs text-slate-600">{event.reason}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          {!['APPROVED', 'REJECTED'].includes(application.status) ? (
            <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              We will notify your verified email when the application status changes.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
