'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson } from '@/lib/client-api';
import type { SellerArticleSearchResult } from '@/lib/seller-stock-contracts';
import type { SellerArticleSubmissionSummary } from '@/lib/seller-contracts';
import { SellerRecordsTable } from './seller-records-table';

interface ArticleApplication {
  id: string;
  productId: string;
  vehicleConfigurationId: string;
  productName: string;
  productStatus: string;
  brandName: string | null;
  productTypeName: string;
  vehicleLabel: string;
  vehicleCode: string;
  verified: boolean;
}

export function SellerProductVehicleArticlesPanel({ onAddToInventory, onEditDraft, refreshKey = 0 }: {
  onAddToInventory: (article: SellerArticleSearchResult) => void;
  onEditDraft: (articleId: string) => void;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<ArticleApplication[]>([]);
  const [ownDrafts, setOwnDrafts] = useState<SellerArticleSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [applications, submissions] = await Promise.all([
        getJson<ArticleApplication[]>('/api/seller/product-articles'),
        getJson<SellerArticleSubmissionSummary[]>('/api/seller/catalog/articles'),
      ]);
      setItems(applications);
      setOwnDrafts(submissions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Product Article configurations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5" aria-label="Vehicle-specific Product Articles">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">Product Articles by Vehicle Configuration</h2>
        <button type="button" disabled={loading} onClick={() => void load()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:opacity-50">
          Refresh Articles
        </button>
      </div>
      <p className="text-sm text-slate-600">Each Product + Vehicle Configuration pair is a unique Article application. Your new Drafts remain visible before their first fitment.</p>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {loading ? <p role="status" className="text-sm text-slate-600">Loading configurations…</p> : null}

      <SellerRecordsTable
        label="Product Articles"
        rows={[
          ...items.map(item => ({
            key: item.id,
            productId: item.productId,
            name: item.productName,
            type: item.productTypeName,
            vehicle: item.vehicleLabel,
            status: item.productStatus,
            fitment: item.verified ? 'Verified' : 'Awaiting verification',
            brandName: item.brandName,
            ownEditableDraft: ownDrafts.some(draft =>
              draft.id === item.productId && draft.status === 'DRAFT' && !draft.catalogReviewSubmittedAt,
            ),
          })),
          ...ownDrafts.filter(draft => !items.some(item => item.productId === draft.id))
            .map(draft => ({
              key: draft.id,
              productId: draft.id,
              name: draft.name,
              type: 'Own Article Draft',
              vehicle: 'No configured vehicle application yet',
              status: draft.status,
              fitment: draft.catalogReviewSubmittedAt ? 'Submitted for review' : 'Draft',
              brandName: null,
              ownEditableDraft: draft.status === 'DRAFT' && !draft.catalogReviewSubmittedAt,
            })),
        ]}
        rowKey={row => row.key}
        searchText={row => [row.name, row.type, row.vehicle, row.status, row.fitment].join(' ')}
        emptyMessage="No Product Articles yet. Click Add Article to create your first Article."
        columns={[
          { key: 'article', title: 'Product Article', render: row => (
            <div><strong className="block">{row.name}</strong><span className="text-xs text-slate-500">{row.type}</span></div>
          ) },
          { key: 'vehicle', title: 'Vehicle Configuration', render: row => row.vehicle },
          { key: 'fitment', title: 'Fitment', render: row => row.fitment },
          { key: 'status', title: 'Article status', render: row => row.status },
          { key: 'actions', title: 'Actions', render: row => (
            <div className="flex flex-wrap gap-2">
              {row.ownEditableDraft ? (
                <button type="button" onClick={() => onEditDraft(row.productId)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
                  Edit Draft
                </button>
              ) : null}
              <button type="button" onClick={() => onAddToInventory({
                id: row.productId, name: row.name, brandName: row.brandName, primaryManufacturerPartNumber: null,
              })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]">
                Add to Inventory
              </button>
            </div>
          ) },
        ]}
      />
    </section>
  );
}
