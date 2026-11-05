import { MAX_LISTING_MEDIA_BYTES, normalizeMediaMimeType } from './seller-listing-upload';

/**
 * Re-encoding via canvas drops camera EXIF metadata and preserves the complete
 * image (including edge-mounted part numbers). Never crop Seller evidence.
 * If optimization fails or is unsupported for any reason, gracefully falls back
 * to the original file to prevent upload failures.
 */
export async function optimizeListingImage(file: File): Promise<File> {
  const normalizedType = normalizeMediaMimeType(file.type, file.name);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(normalizedType)) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const longest = Math.max(bitmap.width, bitmap.height);
      if (!longest) return file;
      const scale = Math.min(1, 2000 / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // Keep original format where possible; never force JPEG into WebP which breaks on browsers
      // that do not support canvas WebP encoding (e.g. Safari returning a PNG blob).
      const outputType = normalizedType === 'image/png'
        ? 'image/png'
        : normalizedType === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
      const quality = outputType === 'image/png' ? undefined : 0.88;

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, outputType, quality);
      });

      if (!blob || blob.size === 0) return file;

      // Never trade legibility for a larger file.
      if (blob.size > MAX_LISTING_MEDIA_BYTES) {
        return file;
      }

      // Respect the actual format produced by the browser's canvas (handles Safari PNG fallback).
      const finalType = blob.type && ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)
        ? blob.type
        : outputType;
      const ext = finalType === 'image/png' ? '.png' : finalType === 'image/webp' ? '.webp' : '.jpg';
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';

      return new File([blob], `${baseName}${ext}`, {
        type: finalType,
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    // If canvas or createImageBitmap fails (e.g. unusual format or browser memory limits),
    // fall back to the original file so the seller can still upload their image.
    console.warn('Listing image optimization skipped, using original file:', error);
    return file;
  }
}
