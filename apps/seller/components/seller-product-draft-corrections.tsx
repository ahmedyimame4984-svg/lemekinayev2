'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SellerArticleSubmissionSummary } from '@/lib/seller-contracts';
import { getJson } from '@/lib/client-api';

export function SellerProductDraftCorrections({
  onCorrect, refreshKey = 0,
}: {
  onCorrect: (productId: string) => void;
  refreshKey?: number;
}) {
  const [drafts, setDrafts] = useState<SellerArticleSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const records = await getJson<SellerArticleSubmissionSummary[]>('/api/seller/catalog/articles');
      setDrafts(records.filter(record => record.status === 'DRAFT'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your pending product information.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey, retry]);

  if (!loading && !error && drafts.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      aria-labelledby="seller-draft-products-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="seller-draft-products-heading" className="text-lg font-semibold text-slate-950">
            Product information requiring attention
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Correct your unfinished product details or check whether catalog verification is pending.
          </p>
        </div>
        <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
          Refresh
        </button>
      </div>
      {loading ? <p role="status" className="mt-3 text-sm text-slate-600">Loading product verification…</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
      {!loading && !error && drafts.length ? (
        <ul className="mt-3 space-y-2">
          {drafts.map(draft => (
            <li key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{draft.name}</p>
                <p className="text-xs text-slate-600">
                  {draft.catalogReviewSubmittedAt ? 'Under catalog review' : 'Product details need completion'}
                </p>
                {draft.reviewFeedback ? <p className="mt-1 text-xs text-amber-800">
                  Review feedback: {draft.reviewFeedback}
                </p> : null}
              </div>
              {!draft.catalogReviewSubmittedAt ? (
                <button type="button" onClick={() => onCorrect(draft.id)}
                  className="rounded-lg border border-[#a71920] px-3 py-2 text-sm font-semibold text-[#a71920] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
                  Correct product information
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
