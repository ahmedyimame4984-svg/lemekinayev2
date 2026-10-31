'use client';

import { useState } from 'react';
import {
  applicationDocumentNames,
  requiredApplicationDocumentTypes,
  type SellerApplicationDetail,
} from '@/lib/seller-application-review';
import { AdminStatusBadge } from './admin-status-badge';
import { SellerApplicationDocumentViewer } from './seller-application-document-viewer';

interface SellerApplicationDocumentsProps {
  application: SellerApplicationDetail;
  working: boolean;
  onReview: (
    documentId: string,
    status: 'VERIFIED' | 'REJECTED',
    reason?: string,
  ) => Promise<void>;
}

export function SellerApplicationDocuments({
  application,
  working,
  onReview,
}: SellerApplicationDocumentsProps) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const canReview = application.status === 'UNDER_REVIEW';
  const uploadedCount = requiredApplicationDocumentTypes.filter((type) =>
    application.documents.some((document) =>
      document.documentType === type && document.isCurrent,
    ),
  ).length;

  return (
    <section className="space-y-3" aria-labelledby="seller-verification-documents-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="seller-verification-documents-title" className="text-base font-semibold text-slate-950">
            Business verification documents
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            View each document in full screen or download it securely. Document decisions
            become available after starting review.
          </p>
        </div>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
          {uploadedCount} of 4 uploaded
        </span>
      </div>

      <div className="space-y-3">
        {requiredApplicationDocumentTypes.map((type) => {
          const document = application.documents.find(
            (item) => item.documentType === type && item.isCurrent,
          );

          return (
            <div key={type} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950">
                    {applicationDocumentNames[type]}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-600">
                    {document?.originalName ?? 'Missing document'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge status={document?.status ?? 'PENDING'} />
                  {document ? (
                    <>
                      <a
                        href={`/api/admin/seller-applications/${application.id}/documents/${document.id}/download`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"
                      >
                        Download securely
                      </a>
                      <SellerApplicationDocumentViewer
                        applicationId={application.id}
                        document={document}
                        title={applicationDocumentNames[type]}
                      />
                    </>
                  ) : null}
                </div>
              </div>

              {document?.reviewNote ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Previous review feedback: {document.reviewNote}
                </p>
              ) : null}

              {document && canReview ? (
                <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                  <label
                    htmlFor={`seller-document-rejection-${document.id}`}
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Rejection reason (required only when rejecting)
                  </label>
                  <textarea
                    id={`seller-document-rejection-${document.id}`}
                    rows={2}
                    maxLength={1000}
                    value={reasons[document.id] ?? ''}
                    onChange={(event) => setReasons((current) => ({
                      ...current,
                      [document.id]: event.target.value,
                    }))}
                    placeholder="Explain what needs to be corrected in this document."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void onReview(document.id, 'VERIFIED')}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Verify document
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void onReview(document.id, 'REJECTED', reasons[document.id] ?? '')}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject document
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
