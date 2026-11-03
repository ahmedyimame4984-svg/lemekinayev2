import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductAssetType, ProductTypeRequirementLevel } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { assertSellerListingMediaReady } from './seller-listing-media-readiness.js';
import { SellerR2StorageService } from './seller-r2-storage.service.js';

function databaseForMedia(input: {
  image?: ProductTypeRequirementLevel;
  minimumImages?: number;
  maximumImages?: number;
  document?: ProductTypeRequirementLevel;
  minimumDocuments?: number;
  media?: Array<{ type: ProductAssetType; isPrimary: boolean }>;
}) {
  const record = {
    product: {
      imageRequirement: input.image ?? ProductTypeRequirementLevel.REQUIRED,
      minimumImageCount: input.minimumImages ?? 1,
      maximumImageCount: input.maximumImages ?? 20,
      documentRequirement: input.document ?? ProductTypeRequirementLevel.OPTIONAL,
      minimumDocumentCount: input.minimumDocuments ?? 0,
    },
    assets: input.media ?? [],
  };
  return {
    sellerListing: { findUnique: vi.fn().mockResolvedValue(record) },
  } as unknown as DatabaseService;
}
const pic = { type: ProductAssetType.IMAGE, isPrimary: true };
const pdf = { type: ProductAssetType.DOCUMENT, isPrimary: false };

describe('Seller Listing media publication boundary', () => {
  it('rejects missing required media even when Article is already Active', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({}), 'listing'))
      .rejects.toMatchObject({ response: expect.objectContaining({
        code: 'SELLER_LISTING_MEDIA_REQUIRED',
      }) });
  });
  it('requires a primary image, not just one verified image', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({
      media: [{ ...pic, isPrimary: false }],
    }), 'listing')).rejects.toMatchObject({ response: expect.objectContaining({
      code: 'SELLER_LISTING_PRIMARY_IMAGE_REQUIRED',
    }) });
  });
  it('rejects multiple main images rather than publishing an ambiguous product card', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({
      minimumImages: 2, media: [pic, pic],
    }), 'listing')).rejects.toMatchObject({ response: expect.objectContaining({
      code: 'SELLER_LISTING_PRIMARY_IMAGE_REQUIRED',
    }) });
  });
  it('requires both images and documents at Listing level', async () => {
    const db = databaseForMedia({
      minimumImages: 2, document: ProductTypeRequirementLevel.REQUIRED,
      minimumDocuments: 1, media: [pic, { ...pic, isPrimary: false }, pdf],
    });
    await expect(assertSellerListingMediaReady(db, 'listing')).resolves.toBeUndefined();
  });
  it('rejects excess verified images even if required minimum was satisfied', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({
      minimumImages: 1, maximumImages: 2,
      media: [pic, { ...pic, isPrimary: false }, { ...pic, isPrimary: false }],
    }), 'listing')).rejects.toMatchObject({ response: expect.objectContaining({
      code: 'SELLER_LISTING_IMAGE_LIMIT_EXCEEDED',
    }) });
  });
  it('allows exactly the configured image maximum', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({
      minimumImages: 2, maximumImages: 2,
      media: [pic, { ...pic, isPrimary: false }],
    }), 'listing')).resolves.toBeUndefined();
  });

  it('allows optional Listing media to be absent', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({
      image: ProductTypeRequirementLevel.OPTIONAL, media: [],
    }), 'listing')).resolves.toBeUndefined();
  });
  it('rejects media for NOT_APPLICABLE policies', async () => {
    await expect(assertSellerListingMediaReady(databaseForMedia({
      image: ProductTypeRequirementLevel.NOT_APPLICABLE,
      media: [pic],
    }), 'listing')).rejects.toMatchObject({ response: expect.objectContaining({
      code: 'SELLER_LISTING_MEDIA_NOT_APPLICABLE',
    }) });
  });
});

describe('Cloudflare R2 SigV4 media presigner', () => {
  const service = new SellerR2StorageService();
  const key = 'seller-listings/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg';
  beforeEach(() => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'a'.repeat(32));
    vi.stubEnv('CLOUDFLARE_ACCESS_KEY_ID', 'test-access');
    vi.stubEnv('CLOUDFLARE_SECRET_ACCESS_KEY', 'test-secret');
    vi.stubEnv('CLOUDFLARE_R2_BUCKET_NAME', 'seller-media');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('limits a signed PUT to a concrete Seller path, Content-Type and short expiry', () => {
    const url = new URL(service.sign(key, 'PUT', 300, 'image/jpeg'));
    expect(url.hostname).toBe(`${'a'.repeat(32)}.r2.cloudflarestorage.com`);
    expect(url.pathname).toContain('/seller-media/seller-listings/');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
    expect(url.toString()).not.toContain('test-secret');
  });
  it('never signs arbitrary keys or long-lived credentials', () => {
    expect(() => service.sign('other-user/private.pdf', 'GET', 60)).toThrow('Invalid');
    expect(() => service.sign(key, 'GET', 3600)).toThrow('lifetime');
  });
  it('reports R2 access-denied during upload verification as a storage error, not a corrupt image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(null, { status: 403 }),
    ));
    await expect(service.verifyUploaded(key, 'image/jpeg', 4096))
      .rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SELLER_R2_ACCESS_DENIED' }),
      });
  });

  it('seals a browser-uploaded object under a new server-only key', async () => {
    const jpeg = new Uint8Array([255, 216, 255, 0, 0, 0, 255, 217]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(jpeg, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: {
        'content-type': 'image/jpeg', 'content-length': String(jpeg.length),
      } }))
      .mockResolvedValueOnce(new Response(jpeg, { status: 206 }))
      .mockResolvedValueOnce(new Response(jpeg, { status: 206 }));
    vi.stubGlobal('fetch', fetchMock);

    const sealedKey = await service.sealUpload(key, 'image/jpeg', jpeg.length);
    expect(sealedKey).not.toBe(key);
    expect(sealedKey).toMatch(/\.jpg$/);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const signedPut = fetchMock.mock.calls[1]?.[0] as string;
    expect(signedPut).toContain(sealedKey);
    expect(signedPut).not.toContain(key);
  });

  it('fails closed when R2 is unconfigured', () => {
    vi.stubEnv('CLOUDFLARE_ACCESS_KEY_ID', '');
    expect(() => service.sign(key, 'GET', 30)).toThrow('not configured');
  });
});
