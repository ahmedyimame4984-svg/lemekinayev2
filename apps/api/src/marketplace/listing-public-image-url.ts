/**
 * Public Listing images use immutable, server-generated object keys.
 * Never accept a client-provided URL or key when building CDN URLs.
 */
export const LISTING_IMAGE_WIDTHS = [320, 640, 1200] as const;
export type ListingImageWidth = typeof LISTING_IMAGE_WIDTHS[number];

const IMAGE_KEY = /^seller-listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;

export function listingImageUrl(
  publicOrigin: string,
  storageKey: string,
  width: ListingImageWidth,
): string {
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== '/' ||
      !IMAGE_KEY.test(storageKey) || !LISTING_IMAGE_WIDTHS.includes(width)) {
    throw new Error('Invalid public Listing image configuration.');
  }
  const path = storageKey.split('/').map(encodeURIComponent).join('/');
  return `${origin.origin}/cdn-cgi/image/width=${width},quality=82,format=auto,fit=scale-down/${path}`;
}

export function listingImageSrcSet(publicOrigin: string, storageKey: string): string {
  return LISTING_IMAGE_WIDTHS.map(width =>
    `${listingImageUrl(publicOrigin, storageKey, width)} ${width}w`,
  ).join(', ');
}
