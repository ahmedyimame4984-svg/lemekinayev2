'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { SellerApplicationDocument } from '@/lib/seller-application-review';
import {
  getSellerDocumentPreviewMimeType,
  type SellerDocumentPreviewMimeType,
} from '@/lib/seller-document-preview';

interface DocumentPreview {
  url: string;
  mimeType: SellerDocumentPreviewMimeType;
}

interface SellerApplicationDocumentViewerProps {
  applicationId: string;
  document: SellerApplicationDocument;
  title: string;
}

export function SellerApplicationDocumentViewer({
  applicationId,
  document,
  title,
}: SellerApplicationDocumentViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const titleId = useId();
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);

  const documentPath = `/api/admin/seller-applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(document.id)}`;

  useEffect(() => () => {
    abortRef.current?.abort();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function clearPreview() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreview(null);
    setLoading(false);
    setError('');
    setZoom(1);
  }

  function openViewer() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setZoom(1);

    // Defer private file loading until the reviewer explicitly opens the popup.
    void (async () => {
      try {
        const response = await fetch(`${documentPath}/preview`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            response.status === 401 || response.status === 403
              ? 'You no longer have permission to preview this document.'
              : 'The document could not be previewed. You can still download it securely.',
          );
        }

        const mimeType = getSellerDocumentPreviewMimeType(
          response.headers.get('content-type'),
        );
        if (!mimeType) throw new Error('This document format cannot be previewed.');

        const file = await response.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(new Blob([file], { type: mimeType }));
        objectUrlRef.current = url;
        setPreview({ url, mimeType });
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'The document preview is unavailable.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
  }

  const isPdf = preview?.mimeType === 'application/pdf';

  return (
    <>
      <button
        type="button"
        onClick={openViewer}
        aria-haspopup="dialog"
        className="rounded-lg border border-[#a71920] bg-white px-3 py-2 text-xs font-semibold text-[#a71920] hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"
      >
        View full screen
      </button>

      <dialog
        ref={dialogRef}
        onClose={clearPreview}
        aria-labelledby={titleId}
        className="m-auto h-[94vh] w-[96vw] max-w-[1400px] rounded-2xl border border-slate-300 bg-white p-0 shadow-2xl backdrop:bg-slate-950/75"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-1 max-w-[60vw] truncate text-xs text-slate-600">{document.originalName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {preview && !isPdf ? (
                <>
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.max(1, Math.round((value - 0.25) * 100) / 100))}
                    disabled={zoom <= 1}
                    aria-label="Zoom out document image"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="min-w-12 text-center text-xs text-slate-600" aria-live="polite">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((value) => Math.min(3, Math.round((value + 0.25) * 100) / 100))}
                    disabled={zoom >= 3}
                    aria-label="Zoom in document image"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    +
                  </button>
                </>
              ) : null}
              <a
                href={`${documentPath}/download`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"
              >
                Download securely
              </a>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close document viewer"
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a71920]"
              >
                Close
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
            {loading ? (
              <p role="status" className="py-12 text-center text-sm text-slate-600">
                Loading private document…
              </p>
            ) : error ? (
              <p role="alert" className="mx-auto max-w-md py-12 text-center text-sm text-red-800">
                {error}
              </p>
            ) : isPdf && preview ? (
              <iframe
                src={preview.url}
                title={`PDF preview: ${title}`}
                referrerPolicy="no-referrer"
                className="h-full min-h-[65vh] w-full rounded-lg bg-white"
              />
            ) : preview ? (
              // Authenticated in-memory Blob URLs are not supported by next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={`Uploaded ${title}`}
                className="mx-auto block h-auto max-w-none object-contain"
                style={{ width: `${zoom * 100}%` }}
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
