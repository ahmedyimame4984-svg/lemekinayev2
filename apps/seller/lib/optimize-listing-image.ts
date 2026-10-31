import { MAX_LISTING_MEDIA_BYTES } from './seller-listing-upload';

/**
 * Re-encoding via canvas drops camera EXIF metadata and preserves the complete
 * image (including edge-mounted part numbers). Never crop Seller evidence.
 */
export async function optimizeListingImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (!longest) throw new Error('The image has invalid dimensions.');
    const scale = Math.min(1, 2000 / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image optimization is not available on this device.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image encoding failed.')),
        outputType, outputType === 'image/webp' ? 0.9 : undefined);
    });
    // Never trade legibility for a larger file. Re-encoding also strips metadata.
    if (blob.size > MAX_LISTING_MEDIA_BYTES) {
      throw new Error('Optimized image exceeds 8 MB. Choose a smaller image.');
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, '') +
      (outputType === 'image/png' ? '.png' : '.webp'), {
      type: outputType, lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
