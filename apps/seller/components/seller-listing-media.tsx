'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { AlertCircle, CheckCircle2, FileText, ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import { ClientApiError, getJson, patchJson, postJson } from '@/lib/client-api';
import { optimizeListingImage } from '@/lib/optimize-listing-image';
import type { ListingMediaReadiness } from '@/lib/seller-listing-readiness';
import {
  listingMediaLimit,
  normalizeMediaMimeType,
  putFileToR2, validateListingFile,
  type ListingMediaKind, type ListingMediaPolicy,
} from '@/lib/seller-listing-upload';

type ListingAsset = {
  id: string;
  type: ListingMediaKind;
  mimeType: string;
  originalName: string;
  sortOrder: number;
  isPrimary: boolean;
  isPublished: boolean;
};
type AssetView = ListingAsset & { previewUrl?: string };
type PendingStatus = 'queued' | 'presigning' | 'uploading' | 'verifying' | 'saved' | 'failed';
type PendingFile = {
  id: string;
  file: File;
  kind: ListingMediaKind;
  previewUrl?: string;
  status: PendingStatus;
  percent: number;
  error?: string;
  assetId?: string;
};

const control = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:cursor-not-allowed disabled:opacity-50';
const uploadControl = 'rounded-lg bg-[#a71920] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8b151b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920] disabled:cursor-not-allowed disabled:opacity-50';

function mediaError(context: string, cause: unknown): string {
  if (cause instanceof ClientApiError) {
    const extra = cause.code !== 'REQUEST_FAILED' ? ` (${cause.code})` : '';
    return `${context}: ${cause.message}${extra}`;
  }
  return `${context}: ${cause instanceof Error ? cause.message : 'Request failed'}`;
}

/** Empty-state text is not shown when API loading failed. */
export function SellerListingMediaEmptyState({ loaded, loading, count }: {
  loaded: boolean; loading: boolean; count: number;
}) {
  return loaded && !loading && count === 0
    ? <p className="text-sm text-slate-600">No verified Listing media uploaded yet.</p>
    : null;
}

export type ProposedMediaSelection = { assetIds: string[]; primaryId: string | null; changed: boolean };
export function SellerListingMedia({
  listingId, readOnly = false, reviewMode = false,
  onPendingChange, onSelectionChange, onReadinessChange,
}: {
  listingId: string; readOnly?: boolean; reviewMode?: boolean;
  onPendingChange?: (hasUnuploadedFiles: boolean) => void;
  onSelectionChange?: (selection: ProposedMediaSelection) => void;
  onReadinessChange?: (readiness: ListingMediaReadiness | null) => void;
}) {
  const base = `/api/seller/listings/${listingId}/assets`;
  const fileInputId = useId();
  const previews = useRef(new Map<string, string>());
  const selectionLoaded = useRef(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [policy, setPolicy] = useState<ListingMediaPolicy | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const ownedPreviews = previews.current;
    return () => {
      for (const url of ownedPreviews.values()) URL.revokeObjectURL(url);
      ownedPreviews.clear();
    };
  }, []);

  const reload = useCallback(async (): Promise<AssetView[]> => {
    setLoaded(false);
    try {
      const [items, rules] = await Promise.all([
        getJson<ListingAsset[]>(base).catch(cause => {
          throw new Error(mediaError('Could not load saved Listing media', cause));
        }),
        getJson<ListingMediaPolicy>(`${base}/requirements`).catch(cause => {
          throw new Error(mediaError('Could not load Product Type media requirements', cause));
        }),
      ]);
      const result = await Promise.all(items.map(async (asset): Promise<AssetView> => {
        try {
          const signed = await getJson<{ url: string }>(`${base}/${asset.id}/preview`);
          return { ...asset, previewUrl: signed.url };
        } catch {
          return asset;
        }
      }));
      setAssets(result);
      if (reviewMode && !selectionLoaded.current) {
        selectionLoaded.current = true;
        setSelectedAssetIds(result.map(item => item.id));
        setSelectedPrimaryId(result.find(item => item.isPrimary)?.id ??
          result.find(item => item.type === 'IMAGE')?.id ?? null);
      }
      setPolicy(rules);
      setLoaded(true);
      return result;
    } catch (cause) {
      setLoaded(false);
      setAssets([]);
      setPolicy(null);
      throw cause;
    }
  }, [base, reviewMode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void reload().catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load Listing media.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const discardPreview = (id: string) => {
    const url = previews.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(id);
  };

  function stage(id: string, changes: Partial<PendingFile>) {
    setPending(rows => rows.map(row => row.id === id ? { ...row, ...changes } : row));
  }

function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

  function enqueue(files: File[]) {
    if (!policy || busy || readOnly || !files.length) return;
    const rejected: string[] = [];
    const queued = [...pending];
    const added: PendingFile[] = [];
    for (const file of files) {
      const result = validateListingFile(file, policy);
      if ('error' in result) { rejected.push(`${file.name}: ${result.error}`); continue; }
      const count = assets.filter(a => a.type === result.kind && (!reviewMode || !a.isPublished)).length +
        queued.filter(a => a.kind === result.kind && a.status !== 'saved').length;
      const max = reviewMode ? 20 : listingMediaLimit(result.kind, policy);
      if (count >= max) {
        rejected.push(`${file.name}: maximum ${max} ${result.kind === 'IMAGE' ? 'images' : 'documents'} per Listing.`);
        continue;
      }
      const id = safeRandomId();
      const previewUrl = result.kind === 'IMAGE' ? URL.createObjectURL(file) : undefined;
      if (previewUrl) previews.current.set(id, previewUrl);
      const row: PendingFile = { id, file, kind: result.kind, previewUrl, status: 'queued', percent: 0 };
      queued.push(row);
      added.push(row);
    }
    if (added.length) {
      setPending(queued);
      setNotice(`${added.length} file(s) selected. Starting upload…`);
      void uploadFiles(queued.filter(row => row.status === 'queued' || row.status === 'failed'));
    }
    setError(rejected.join(' '));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    enqueue(Array.from(event.dataTransfer.files));
  }

  async function selectPrimaryIfMissing(items: AssetView[]): Promise<AssetView[]> {
    const images = items.filter(asset => asset.type === 'IMAGE');
    if (!images.length || images.some(asset => asset.isPrimary)) return items;
    await patchJson(`${base}/order`, {
      assetIds: items.map(asset => asset.id),
      primaryId: images[0]!.id,
    });
    return reload();
  }

  async function uploadFiles(overrideEntries?: PendingFile[]) {
    if (busy || readOnly || !loaded) return;
    const entries = overrideEntries ?? pending.filter(row => row.status === 'queued' || row.status === 'failed');
    if (!entries.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    const completed: string[] = [];
    let failures = 0;

    try {
      for (const row of entries) {
        stage(row.id, { status: 'presigning', percent: 0, error: undefined });
        try {
          const uploadFile = row.kind === 'IMAGE' ? await optimizeListingImage(row.file) : row.file;
          const checked = validateListingFile(uploadFile, policy!);
          if ('error' in checked) throw new Error(checked.error);
          const uploadMimeType = normalizeMediaMimeType(uploadFile.type, uploadFile.name);
          const signed = await postJson<{
            assetId: string; uploadUrl: string; mimeType: string;
          }>(`${base}/presign`, {
            mimeType: uploadMimeType,
            sizeBytes: uploadFile.size,
            fileName: uploadFile.name,
            ...(row.assetId ? { replaceDraftAssetId: row.assetId } : {}),
          });
          stage(row.id, { assetId: signed.assetId, status: 'uploading', percent: 0 });
          await putFileToR2(signed.uploadUrl, uploadFile, signed.mimeType, percent => {
            stage(row.id, { percent });
          });
          stage(row.id, { status: 'verifying', percent: 100 });
          await postJson(`${base}/${signed.assetId}/complete`, {});
          stage(row.id, { status: 'saved', percent: 100 });
          completed.push(row.id);
        } catch (cause) {
          failures++;
          stage(row.id, {
            status: 'failed', percent: 0,
            error: mediaError('Could not save this file', cause),
          });
        }
      }

      if (completed.length) {
        for (const id of completed) discardPreview(id);
        setPending(rows => rows.filter(row => !completed.includes(row.id)));
        setNotice(`${completed.length} file(s) saved and verified on this Listing.`);
        try {
          const verified = await reload();
          if (reviewMode) {
            const added = verified.filter(item => !item.isPublished);
            setSelectedAssetIds(ids => [...new Set([...ids, ...added.map(item => item.id)])]);
            setSelectedPrimaryId(id => id ?? verified.find(item => item.type === 'IMAGE')?.id ?? null);
          } else {
            await selectPrimaryIfMissing(verified);
          }
        } catch (cause) {
          setError(mediaError('Files were uploaded, but refresh or primary image selection failed', cause));
        }
      }
      if (failures) {
        setError(`${failures} file(s) failed. Check the reason beside each file and use Retry upload.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeOrder(items: AssetView[], primaryId?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await patchJson(`${base}/order`, {
        assetIds: items.map(item => item.id),
        ...(primaryId ? { primaryId } : {}),
      });
      await reload();
    } catch (cause) {
      setError(mediaError('Could not save image order', cause));
    } finally { setBusy(false); }
  }

  function move(id: string, direction: number) {
    if (reviewMode) {
      const index = selectedAssetIds.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= selectedAssetIds.length) return;
      const ordered = [...selectedAssetIds];
      [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
      setSelectedAssetIds(ordered);
      return;
    }
    const index = assets.findIndex(asset => asset.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= assets.length) return;
    const ordered = [...assets];
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    void changeOrder(ordered, assets.find(asset => asset.isPrimary)?.id);
  }

  async function removeSaved(asset: AssetView) {
    if (reviewMode) {
      if (asset.isPublished) {
        setSelectedAssetIds(ids => ids.filter(id => id !== asset.id));
        if (selectedPrimaryId === asset.id) {
          setSelectedPrimaryId(assets.find(item => item.id !== asset.id && item.type === 'IMAGE' &&
            selectedAssetIds.includes(item.id))?.id ?? null);
        }
      } else {
        // Unpublished staged assets can be deleted without changing buyer-visible images.
        setBusy(true);
        try {
          await postJson(`${base}/${asset.id}/remove`, {});
          const remaining = await reload();
          setSelectedAssetIds(ids => ids.filter(id => id !== asset.id));
          if (selectedPrimaryId === asset.id) {
            setSelectedPrimaryId(remaining.find(item => item.type === 'IMAGE' && item.id !== asset.id)?.id ?? null);
          }
        } catch (cause) { setError(mediaError('Could not discard proposed file', cause)); }
        finally { setBusy(false); }
      }
      return;
    }
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await postJson(`${base}/${asset.id}/remove`, {});
      const remaining = await reload();
      await selectPrimaryIfMissing(remaining);
      setNotice(`${asset.originalName} removed from this Listing.`);
    } catch (cause) {
      setError(mediaError('Could not remove file', cause));
    } finally { setBusy(false); }
  }

  function removeSelected(id: string) {
    if (busy) return;
    const item = pending.find(row => row.id === id);
    if (item?.assetId) {
      postJson(`${base}/${item.assetId}/remove`, {}).catch(() => {});
    }
    discardPreview(id);
    setPending(rows => rows.filter(row => row.id !== id));
  }

  function retryLoad() {
    setLoading(true);
    setError('');
    void reload().catch(cause => {
      setError(cause instanceof Error ? cause.message : 'Could not load Listing media.');
    }).finally(() => setLoading(false));
  }

  const selectedAssets = selectedAssetIds.map(id => assets.find(asset => asset.id === id))
    .filter((asset): asset is AssetView => asset !== undefined);
  const shownAssets = reviewMode ? selectedAssets : assets;
  const displayAssets = reviewMode
    ? [...selectedAssets, ...assets.filter(asset => !selectedAssetIds.includes(asset.id))]
    : assets;
  const images = shownAssets.filter(asset => asset.type === 'IMAGE');
  const documents = shownAssets.filter(asset => asset.type === 'DOCUMENT');
  const neededImages = policy?.image === 'REQUIRED' ? Math.max(1, policy.minimumImageCount) : 0;
  const neededDocuments = policy?.document === 'REQUIRED' ? Math.max(1, policy.minimumDocumentCount) : 0;
  const complete = images.length >= neededImages &&
    (policy === null || images.length <= listingMediaLimit('IMAGE', policy)) &&
    documents.length >= neededDocuments &&
    (images.length === 0 || (reviewMode
      ? images.filter(asset => asset.id === selectedPrimaryId).length === 1
      : images.filter(asset => asset.isPrimary).length === 1));
  const hasPrimaryImage = images.filter(asset => reviewMode
    ? asset.id === selectedPrimaryId : asset.isPrimary).length === 1;
  const readiness = useMemo<ListingMediaReadiness | null>(() => {
    if (!loaded || !policy) return null;
    return {
      imageApplicable: policy.image !== 'NOT_APPLICABLE',
      documentApplicable: policy.document !== 'NOT_APPLICABLE',
      imageCount: images.length,
      minimumImages: neededImages,
      maximumImages: listingMediaLimit('IMAGE', policy),
      documentCount: documents.length,
      minimumDocuments: neededDocuments,
      hasPrimaryImage,
      complete,
    };
  }, [loaded, policy, images.length, documents.length, neededImages, neededDocuments, hasPrimaryImage, complete]);
  useEffect(() => {
    onReadinessChange?.(readiness);
  }, [onReadinessChange, readiness]);
  const waiting = pending.filter(row => row.status === 'queued' || row.status === 'failed').length;
  const published = assets.filter(asset => asset.isPublished);
  const proposedChanged = reviewMode && (
    shownAssets.length !== published.length ||
    shownAssets.some((asset, index) => asset.id !== published[index]?.id) ||
    selectedPrimaryId !== (published.find(asset => asset.isPrimary)?.id ?? null)
  );
  useEffect(() => {
    if (reviewMode && selectionLoaded.current) {
      onSelectionChange?.({ assetIds: selectedAssetIds, primaryId: selectedPrimaryId,
        changed: proposedChanged });
    }
  }, [reviewMode, selectedAssetIds, selectedPrimaryId, proposedChanged, onSelectionChange]);
  useEffect(() => {
    onPendingChange?.(busy || pending.some(row => row.status !== 'saved'));
  }, [busy, pending, onPendingChange]);
  const fileAccept = [
    ...(policy?.image !== 'NOT_APPLICABLE' ? ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp'] : []),
    ...(policy?.document !== 'NOT_APPLICABLE' ? ['application/pdf', '.pdf'] : []),
  ].join(',');

  return (
    <section aria-label="Seller Listing images and documents"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Listing images and documents</h3>
        <p className="text-sm text-slate-600">
          Upload clear photos of the actual part: main view, other angles, visible part number,
          and packaging. For used or refurbished parts, show wear and defects.
          Files are saved only after private Cloudflare R2 verification.
        </p>
      </div>
      {loading ? <p role="status" className="text-sm text-slate-600">Loading Listing media…</p> : null}
      {policy ? (
        <p className="text-sm text-slate-700">
          Images: <strong>{policy.image}</strong> ({images.length} verified, minimum {neededImages}, maximum {listingMediaLimit('IMAGE', policy)}).
          {' '}Documents: <strong>{policy.document}</strong> ({documents.length}/{neededDocuments} minimum).
          {neededImages > 0 ? <span className="ml-1 font-medium">
            {Math.min(images.length, neededImages)} of {neededImages} required images ready.
          </span> : null}
        </p>
      ) : null}

      {!readOnly && loaded && policy &&
        (policy.image !== 'NOT_APPLICABLE' || policy.document !== 'NOT_APPLICABLE') ? (
        <div className="space-y-3">
          <div onDragEnter={event => { event.preventDefault(); if (!busy) setDragging(true); }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={event => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? 'border-[#a71920] bg-red-50' : 'border-slate-300 bg-slate-50'
            }`}>
            <label htmlFor={fileInputId}
              className="flex cursor-pointer flex-col items-center gap-2 text-slate-700">
              <ImagePlus aria-hidden="true" className="h-9 w-9 text-[#a71920]"/>
              <span className="font-semibold">Drag and drop images here</span>
              <span className="text-sm">or select one or multiple files</span>
              <span className="text-xs text-slate-600">JPG, PNG, WebP, and applicable PDF documents · 8 MB per file</span>
            </label>
            <input id={fileInputId} type="file" multiple
              disabled={busy || (!reviewMode && policy.image !== 'NOT_APPLICABLE' &&
                assets.filter(asset => asset.type === 'IMAGE').length >= listingMediaLimit('IMAGE', policy) &&
                policy.document === 'NOT_APPLICABLE')}
              accept={fileAccept}
              aria-label="Choose Listing images or documents"
              className="mt-3 max-w-full rounded-md border border-slate-300 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-[#a71920]"
              onChange={event => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = '';
                enqueue(files);
              }}/>
          </div>
          {pending.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Selected files ({pending.length})</h4>
              <ul className="grid gap-3 sm:grid-cols-2">
                {pending.map(item => (
                  <li key={item.id} className="rounded-lg border border-slate-200 p-3">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={`Selected ${item.file.name}`}
                        className="mb-2 h-28 w-full rounded-md bg-slate-100 object-contain"/>
                    ) : <FileText aria-hidden="true" className="mb-2 h-9 w-9 text-slate-600"/>}
                    <p className="break-all text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-slate-600">{(item.file.size / 1048576).toFixed(2)} MB</p>
                    <div className="mt-2 flex items-center gap-2">
                      {item.status === 'saved' ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-green-700"/> :
                        ['presigning', 'uploading', 'verifying'].includes(item.status) ?
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-[#a71920]"/> : null}
                      <span className="text-xs font-medium" aria-live="polite">
                        {item.status === 'presigning' ? 'Preparing secure upload…' :
                          item.status === 'uploading' ? `Uploading ${item.percent}%` :
                          item.status === 'verifying' ? 'Verifying and saving in R2…' :
                          item.status === 'saved' ? 'Saved' :
                          item.status === 'failed' ? 'Upload failed' : 'Ready to upload'}
                      </span>
                    </div>
                    {item.status === 'uploading' ? (
                      <progress aria-label={`Upload progress for ${item.file.name}`}
                        className="mt-2 w-full accent-[#a71920]"
                        max={100} value={item.percent}/>
                    ) : null}
                    {item.error ? <p role="alert" className="mt-2 text-xs text-red-800">{item.error}</p> : null}
                    {!busy && item.status !== 'saved' ? (
                      <button type="button" className={`${control} mt-2`}
                        onClick={() => removeSelected(item.id)}>
                        <X aria-hidden="true" className="mr-1 inline h-3 w-3"/> Remove selection
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {waiting > 0 ? (
                <button type="button" className={uploadControl} disabled={busy}
                  onClick={() => void uploadFiles()}>
                  <UploadCloud aria-hidden="true" className="mr-2 inline h-4 w-4"/>
                  {busy ? 'Uploading files…' : `Upload ${waiting} file${waiting === 1 ? '' : 's'}`}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {busy ? <p role="status" className="text-sm text-slate-600">Saving and verifying Listing media…</p> : null}
      {error ? <p role="alert" className="flex items-start gap-2 text-sm text-red-800">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>{error}
      </p> : null}
      {notice ? <p role="status" className="text-sm text-green-800">{notice}</p> : null}
      {assets.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{reviewMode ? 'Published and proposed media' : 'Saved Listing media'} ({assets.length})</h4>
          <ol className="grid gap-3 sm:grid-cols-2">
            {displayAssets.map((asset, index) => (
              <li key={asset.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                {asset.type === 'IMAGE' && asset.previewUrl ? (
                  <img src={asset.previewUrl} alt={asset.originalName}
                    className="h-36 w-full rounded-md bg-slate-50 object-contain" loading="lazy"/>
                ) : asset.previewUrl ? (
                  <a href={asset.previewUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-700 underline">Preview private document</a>
                ) : <p className="text-sm text-amber-800">Preview unavailable. Refresh to try again.</p>}
                <p className="break-all text-xs text-slate-700">{asset.originalName}</p>
                {reviewMode ? <p className="text-xs font-semibold text-slate-700">
                  {asset.isPublished ? 'Published' : 'Staged'}
                  {!selectedAssetIds.includes(asset.id) ? ' · Excluded from proposed set' : ''}
                </p> : null}
                {(reviewMode ? selectedPrimaryId === asset.id : asset.isPrimary) ?
                  <p className="text-xs font-semibold text-green-800">Primary image</p> : null}
                {!readOnly ? <div className="flex flex-wrap gap-2">
                  {asset.type === 'IMAGE' && (reviewMode ? selectedPrimaryId !== asset.id : !asset.isPrimary) &&
                    (!reviewMode || selectedAssetIds.includes(asset.id)) ? (
                    <button type="button" className={control} disabled={busy}
                      onClick={() => reviewMode ? setSelectedPrimaryId(asset.id) : void changeOrder(assets, asset.id)}>Make primary</button>
                  ) : null}
                  <button type="button" className={control} disabled={busy || (reviewMode ? !selectedAssetIds.includes(asset.id) || selectedAssetIds.indexOf(asset.id) === 0 : index === 0)}
                    onClick={() => move(asset.id, -1)} aria-label={`Move ${asset.originalName} earlier`}>↑</button>
                  <button type="button" className={control} disabled={busy || (reviewMode ? !selectedAssetIds.includes(asset.id) || selectedAssetIds.indexOf(asset.id) === selectedAssetIds.length - 1 : index === assets.length - 1)}
                    onClick={() => move(asset.id, 1)} aria-label={`Move ${asset.originalName} later`}>↓</button>
                  <button type="button" className={control} disabled={busy}
                    onClick={() => reviewMode && asset.isPublished && !selectedAssetIds.includes(asset.id)
                      ? setSelectedAssetIds(ids => [...ids, asset.id])
                      : void removeSaved(asset)}>
                      {reviewMode ? (asset.isPublished && !selectedAssetIds.includes(asset.id)
                        ? 'Keep in proposal' : 'Exclude from proposal') : 'Remove'}</button>
                </div> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <SellerListingMediaEmptyState loaded={loaded} loading={loading} count={assets.length}/>
      {!loading && !loaded ? (
        <button type="button" className={control} disabled={busy} onClick={retryLoad}>
          Retry loading Listing media
        </button>
      ) : null}
      {policy ? (
        <p role="status" className={complete ? 'text-sm text-green-800' : 'text-sm text-amber-800'}>
          {complete ? (reviewMode ? 'Proposed media meets requirements. Save Listing to submit for Admin review.' : 'Verified media requirements satisfied. You can submit the Listing for review.') :
            'Upload required files and select a primary image before submitting the Listing.'}
        </p>
      ) : null}
    </section>
  );
}
