'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApplicantApplication } from '@/lib/application-contracts';
import { applicationCanEdit } from '@/lib/application-contracts';
import { ClientApiError, postJson } from '@/lib/client-api';

const documentNames: Record<ApplicantApplication['documents'][number]['documentType'], string> = {
  COMMERCIAL_REGISTRATION: 'Commercial Registration Certificate',
  TRADE_LICENSE: 'Trade / Business Licence',
  TIN_CERTIFICATE: 'TIN Certificate',
  VAT_REGISTRATION: 'VAT Registration Certificate',
};

export function ApplicationStatusView() {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicantApplication | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await fetch('/api/seller/application/status', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (result.status === 401) {
          router.replace('/application');
          return;
        }
        if (!result.ok) throw new Error('Application status is temporarily unavailable.');
        const data = (await result.json()) as ApplicantApplication;
        if (!controller.signal.aborted) setApplication(data);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(
          requestError instanceof Error ? requestError.message : 'Unable to load application.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [router]);

  async function signOut() {
    try {
      await postJson<void>('/api/seller/application/access/logout', {});
      router.replace('/application');
    } catch (requestError) {
      setError(requestError instanceof ClientApiError
        ? requestError.message
        : 'Could not sign out. Try again.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#a71920]">Lemekinaye Seller</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Your application</h1>
          </div>
          <button type="button" onClick={() => void signOut()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            Sign out
          </button>
        </div>
        {loading ? <p role="status">Loading your application…</p> : null}
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
        {application ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Application reference</p>
                  <p className="mt-1 font-semibold text-slate-950">{application.referenceCode}</p>
                </div>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  {application.status.replaceAll('_', ' ')}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-slate-900">{application.businessName}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {applicationCanEdit(application.status)
                  ? 'You may edit the entire application until Admin starts reviewing it.'
                  : 'Your application is read-only during review and after a final decision.'}
              </p>
              {application.correctionReason && application.status === 'CHANGES_REQUESTED' ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Reviewer feedback: {application.correctionReason}
                </p>
              ) : null}
              {applicationCanEdit(application.status) ? (
                <Link
                  href="/application/edit"
                  className="mt-5 inline-flex rounded-lg bg-[#a71920] px-5 py-3 text-sm font-semibold text-white hover:bg-[#8f151b]"
                >
                  Edit full application
                </Link>
              ) : null}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Verification documents</h2>
              <div className="mt-3 space-y-3">
                {application.documents.map((document) => (
                  <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-2">
                    <div>
                      <p className="text-sm font-medium">{documentNames[document.documentType]}</p>
                      <p className="text-xs text-slate-500">{document.originalName}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{document.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
