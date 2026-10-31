'use client';

import { useEffect, useState } from 'react';
import { ClientApiError } from '@/lib/client-api';

/** Admin GET requests use the existing same-origin BFF and Admin session cookie. */
async function getReviewJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    let reason = 'Could not load Listing review media.';
    try {
      const payload = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      if (typeof payload.error?.message === 'string') reason = payload.error.message;
    } catch {
      // Do not reveal upstream HTML or private API errors.
    }
    throw new ClientApiError(reason, 'LISTING_MEDIA_LOAD_FAILED', response.status);
  }
  return (await response.json()) as T;
}

type ReviewAsset = {
  id: string; type: 'IMAGE' | 'DOCUMENT'; mimeType: string;
  originalName: string; isPrimary: boolean; sortOrder: number;
};

/** Admin permission checks are enforced at the API; never link to public R2 keys. */
export function AdminListingMedia({ listingId }: { listingId: string }) {
  const [items, setItems] = useState<Array<ReviewAsset & { previewUrl?: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const path = `/api/admin/listings/${listingId}/assets`;
    setLoading(true);
    Promise.resolve().then(async () => {
      const assets = await getReviewJson<ReviewAsset[]>(path);
      return Promise.all(assets.map(async item => {
        try {
          const view = await getReviewJson<{url: string}>(`${path}/${item.id}/preview`);
          return { ...item, previewUrl: view.url };
        } catch {
          return item;
        }
      }));
    }).then(result => { if (active) setItems(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Review media unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listingId]);

  return (
    <section aria-label="Seller Listing media evidence" className="rounded-lg border border-slate-200 p-3">
      <h4 className="mb-2 text-sm font-semibold">Seller-specific Listing images and documents</h4>
      {loading ? <p role="status">Loading private media…</p> : null}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      {!loading && !items.length ? <p className="text-sm">No verified Seller Listing media.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {items.map(item => (
          <li key={item.id} className="space-y-2 rounded border border-slate-200 p-2">
            {item.type === 'IMAGE' && item.previewUrl ? (
              <img src={item.previewUrl} alt={item.originalName}
                className="h-32 w-full rounded object-contain" loading="lazy"/>
            ) : item.previewUrl ? (
              <a href={item.previewUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-700 underline">Review private document</a>
            ) : <p className="text-sm text-amber-800">Private preview unavailable.</p>}
            <p className="break-all text-xs">{item.originalName}</p>
            {item.isPrimary ? <p className="text-xs font-semibold">Primary image</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
