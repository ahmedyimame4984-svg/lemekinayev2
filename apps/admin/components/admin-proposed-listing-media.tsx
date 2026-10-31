'use client';

import { useEffect, useState } from 'react';
import type { ReviewListingDetail } from '@/lib/listing-review-contracts';

type ProposedAsset = ReviewListingDetail['proposedMediaAssets'][number] & { previewUrl?: string };

/**
 * Preview immutable staged assets only after they belong to an Admin-reviewable
 * pending revision. The permission-guarded BFF issues short-lived R2 read URLs.
 */
export function AdminProposedListingMedia({
  listingId, revisionId, assetIds, assets, primaryId,
}: {
  listingId: string;
  revisionId: string;
  assetIds: string[];
  assets: ReviewListingDetail['proposedMediaAssets'];
  primaryId: string | null;
}) {
  const [previews, setPreviews] = useState<ProposedAsset[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setError('');
    setLoading(true);
    void Promise.all(assets.map(async (asset): Promise<ProposedAsset> => {
      const url = `/api/admin/listings/${encodeURIComponent(listingId)}/assets/${encodeURIComponent(asset.id)}/preview`;
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return asset;
      const payload = await response.json() as { url: string };
      return { ...asset, previewUrl: payload.url };
    })).then(result => { if (active) setPreviews(result); })
      .catch(() => { if (active) setError('Could not load all proposed media previews.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId, revisionId, assets]);

  return <section className="space-y-3" aria-label="Proposed images and documents">
    <h3 className="text-base font-semibold">Proposed media after approval</h3>
    <p className="text-sm text-slate-600">
      Currently published files stay visible to buyers until this exact set is approved.
      Any published image missing from this set will be retired only on approval.
    </p>
    {loading ? <p role="status">Loading proposed images…</p> : null}
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
    {!loading && previews.length !== assetIds.length ? (
      <p role="alert" className="text-sm text-red-800">
        One or more proposed files are unavailable. Approval must be blocked.
      </p>
    ) : null}
    {assetIds.length === 0 ? <p className="text-sm">No media in the proposed set.</p> : null}
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {previews.map((asset, index) => (
        <li key={asset.id} className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">
            {index + 1}. {asset.isPublished ? 'Keep published image' : 'New staged image'}
          </p>
          {asset.type === 'IMAGE' && asset.previewUrl ? (
            <img src={asset.previewUrl} alt={asset.originalName}
              className="h-40 w-full rounded-lg bg-slate-50 object-contain"/>
          ) : asset.previewUrl ? (
            <a href={asset.previewUrl} target="_blank" rel="noopener noreferrer"
              className="text-blue-700 underline">Open proposed document</a>
          ) : <p role="alert" className="text-xs text-amber-800">Preview unavailable.</p>}
          <p className="mt-2 break-all text-xs">{asset.originalName}</p>
          {asset.id === primaryId ? <p className="text-xs font-bold text-green-800">Proposed primary image</p> : null}
        </li>
      ))}
    </ol>
  </section>;
}
