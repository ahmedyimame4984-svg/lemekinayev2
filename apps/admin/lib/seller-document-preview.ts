/** Only formats accepted during registration may be rendered in Admin. */
export type SellerDocumentPreviewMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png';

const PREVIEW_MIME_TYPES = new Set<SellerDocumentPreviewMimeType>([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export function getSellerDocumentPreviewMimeType(
  value: string | null,
): SellerDocumentPreviewMimeType | null {
  const mimeType = value?.split(';', 1)[0]?.trim().toLowerCase();
  return mimeType && PREVIEW_MIME_TYPES.has(mimeType as SellerDocumentPreviewMimeType)
    ? (mimeType as SellerDocumentPreviewMimeType)
    : null;
}
