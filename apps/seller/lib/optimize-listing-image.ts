import { MAX_LISTING_MEDIA_BYTES } from './seller-listing-upload';

/**
 * Re-encoding via canvas drops camera EXIF metadata and preserves the complete
 * image (including edge-mounted part numbers). Never crop Seller evidence.
 */
export async function optimizeListingImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
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

      // Preserve PNG as PNG, WebP as WebP, JPEG as JPEG.
      // Keeping JPEG as JPEG avoids browser WebP canvas fallback bugs (e.g. Safari returning PNG).
      const targetType = file.type === 'image/png'
        ? 'image/png'
        : file.type === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
      const quality = targetType === 'image/png' ? undefined : 0.88;

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, targetType, quality);
      });

      if (!blob) return file;
      if (blob.size > MAX_LISTING_MEDIA_BYTES) {
        if (file.size <= MAX_LISTING_MEDIA_BYTES) return file;
        throw new Error('Optimized image exceeds 8 MB. Choose a smaller image.');
      }

      // Determine actual MIME type from the encoded blob (handles any browser fallback)
      const actualType = blob.type && ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)
        ? blob.type
        : targetType;
      const ext = actualType === 'image/jpeg' ? '.jpg' : actualType === 'image/png' ? '.png' : '.webp';

      return new File([blob], file.name.replace(/\.[^.]+$/, '') + ext, {
        type: actualType,
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    if (file.size <= MAX_LISTING_MEDIA_BYTES) {
      return file;
    }
    throw error;
  }
}
