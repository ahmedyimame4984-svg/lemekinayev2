export type ListingMediaKind = 'IMAGE' | 'DOCUMENT';
export type MediaRequirement = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';

export type ListingMediaPolicy = {
  image: MediaRequirement;
  minimumImageCount: number;
  maximumImageCount: number;
  document: MediaRequirement;
  minimumDocumentCount: number;
};

export const MAX_LISTING_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_LISTING_IMAGES = 20;
export const MAX_LISTING_DOCUMENTS = 20;

/** The Article-frozen Product Type image cap never exceeds the hard system limit. */
export function listingMediaLimit(kind: ListingMediaKind, policy: ListingMediaPolicy): number {
  return kind === 'IMAGE'
    ? Math.min(MAX_LISTING_IMAGES, policy.maximumImageCount)
    : MAX_LISTING_DOCUMENTS;
}

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentTypes = new Set(['application/pdf']);

export function kindOfMedia(mimeType: string): ListingMediaKind | null {
  if (imageTypes.has(mimeType)) return 'IMAGE';
  if (documentTypes.has(mimeType)) return 'DOCUMENT';
  return null;
}

export function validateListingFile(
  file: Pick<File, 'size' | 'type'>,
  policy: ListingMediaPolicy,
): { kind: ListingMediaKind } | { error: string } {
  const kind = kindOfMedia(file.type);
  if (!kind) return { error: 'Use JPG, PNG or WebP images, or PDF documents. GIF is not supported.' };
  if (file.size < 1 || file.size > MAX_LISTING_MEDIA_BYTES) {
    return { error: 'Each file must be larger than zero and at most 8 MB.' };
  }
  if ((kind === 'IMAGE' ? policy.image : policy.document) === 'NOT_APPLICABLE') {
    return { error: `The Product Type does not allow ${kind === 'IMAGE' ? 'images' : 'documents'}.` };
  }
  return { kind };
}

/**
 * Presigned PUT URLs are bearer credentials. Never log or expose their query
 * strings in the UI; never allow an API response to redirect an upload to an
 * arbitrary host.
 */
export function assertR2SignedUploadUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' ||
      !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/i.test(parsed.hostname) ||
      parsed.username || parsed.password) {
    throw new Error('The upload service returned an invalid Cloudflare R2 address.');
  }
  return value;
}

export function r2UploadFailure(status: number): string {
  if (status === 403) return 'Cloudflare R2 rejected the upload (403). Check the R2 signing credentials, signature and Content-Type.';
  if (status === 0) return 'The browser could not finish the R2 upload. This can be caused by network, CORS, an expired signature, or an R2 rejection hidden by CORS. Inspect the OPTIONS and PUT requests, then retry with a fresh upload URL.';
  if (status === 408 || status === 504) return 'Cloudflare R2 timed out. Retry the file.';
  return `Cloudflare R2 did not accept the file (HTTP ${status}).`;
}

/**
 * The existing fetch() PUT did not expose upload progress. Native XHR is used
 * only for binary PUT to a server-generated, allowlisted R2 URL. All Seller API
 * requests continue through the existing authenticated Next.js BFF.
 */
export function putFileToR2(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  assertR2SignedUploadUrl(url);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.timeout = 120_000;
    xhr.withCredentials = false;
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round(100 * event.loaded / event.total)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(r2UploadFailure(xhr.status)));
      }
    };
    xhr.onerror = () => reject(new Error(r2UploadFailure(0)));
    xhr.ontimeout = () => reject(new Error('Cloudflare R2 upload timed out. Retry the file.'));
    xhr.onabort = () => reject(new Error('The file upload was cancelled.'));
    xhr.send(file);
  });
}
