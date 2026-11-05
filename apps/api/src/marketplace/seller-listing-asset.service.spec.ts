import { describe, expect, it, vi } from 'vitest';
import { MasterDataStatus, Prisma, ProductTypeRequirementLevel, SellerListingStatus } from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerService } from './seller.service.js';
import type { SellerR2StorageService } from './seller-r2-storage.service.js';
import { SellerListingAssetService } from './seller-listing-asset.service.js';

const sellerId = '11111111-1111-4111-8111-111111111111';
const listingId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function arrange(input: { status?: SellerListingStatus; image?: ProductTypeRequirementLevel; maximumImages?: number; owner?: boolean } = {}) {
  const tx = {
    sellerListing: {
      findUnique: vi.fn().mockResolvedValue({ id: listingId }),
      findFirst: vi.fn().mockImplementation(({ where }: any = {}) => {
        if (input.owner === false) return Promise.resolve(null);
        const currentStatus = input.status ?? SellerListingStatus.DRAFT;
        if (where?.status?.in && !where.status.in.includes(currentStatus)) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: listingId, sellerId,
          status: currentStatus,
          product: {
            imageRequirement: input.image ?? ProductTypeRequirementLevel.REQUIRED,
            minimumImageCount: 1,
            maximumImageCount: input.maximumImages ?? 20,
            documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
            minimumDocumentCount: 0,
          },
        });
      }),
    },
    sellerListingRevision: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    sellerListingAsset: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'asset-uuid' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const seller = { requireOperationalSellerByUser: vi.fn().mockResolvedValue({ id: sellerId }) };
  const r2 = {
    sign: vi.fn().mockReturnValue('https://example.r2.cloudflarestorage.com/signed'),
    remove: vi.fn().mockResolvedValue(undefined),
    verifyUploaded: vi.fn().mockResolvedValue(undefined),
    sealUpload: vi.fn().mockResolvedValue('seller-listings/sealed.jpg'),
  };
  return {
    db, seller, r2,
    service: new SellerListingAssetService(
      db as unknown as DatabaseService,
      seller as unknown as SellerService,
      r2 as unknown as SellerR2StorageService,
    ),
  };
}

describe('Seller Listing private media ownership and policy', () => {
  const upload = { mimeType: 'image/jpeg', fileName: '../item.jpg', sizeBytes: 4096 };

  it('rejects another Seller Listing without revealing any asset URL', async () => {
    const { service, r2, db } = arrange({ owner: false });
    await expect(service.begin(listingId, actorId, upload)).rejects.toThrow('not found');
    expect(r2.sign).not.toHaveBeenCalled();
    expect(db.sellerListingAsset.create).not.toHaveBeenCalled();
  });

  it('refuses new photos on an already submitted Listing', async () => {
    const { service, r2 } = arrange({ status: SellerListingStatus.SUBMITTED });
    await expect(service.begin(listingId, actorId, upload)).rejects.toThrow('current state');
    expect(r2.sign).not.toHaveBeenCalled();
  });

  it('respects NOT_APPLICABLE image policy before signing upload credentials', async () => {
    const { service, r2 } = arrange({ image: ProductTypeRequirementLevel.NOT_APPLICABLE });
    await expect(service.begin(listingId, actorId, upload)).rejects.toThrow('does not allow');
    expect(r2.sign).not.toHaveBeenCalled();
  });

  it('allows a verified file type and stores its key only under the Seller/Listing prefix', async () => {
    const { service, r2, db } = arrange();
    const result = await service.begin(listingId, actorId, upload);
    expect(result.assetId).toBe('asset-uuid');
    expect(result.expiresInSeconds).toBe(300);
    expect(r2.sign).toHaveBeenCalledWith(
      expect.stringMatching(/^seller-listings\/11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/.*\.jpg$/),
      'PUT', 300, 'image/jpeg',
    );
    expect(db.sellerListingAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: MasterDataStatus.DRAFT, listingId,
        originalName: 'item.jpg',
      }),
      select: { id: true },
    });
  });

  it('stages replacement images on active Listings without publishing them', async () => {
    const { service, db } = arrange({ status: SellerListingStatus.ACTIVE, maximumImages: 1 });
    db.sellerListingAsset.count.mockResolvedValue(0);
    await expect(service.begin(listingId, actorId, upload)).resolves.toMatchObject({
      assetId: 'asset-uuid',
    });
    expect(db.sellerListingAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isPublished: false }),
    }));
    expect(db.sellerListingAsset.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isPublished: false }),
    }));
  });

  it('blocks additional staged uploads while an Admin revision is pending', async () => {
    const { service, db } = arrange({ status: SellerListingStatus.ACTIVE });
    db.sellerListingRevision.findFirst.mockResolvedValue({ id: 'existing-review' });
    await expect(service.begin(listingId, actorId, upload)).rejects.toThrow('Wait for Admin');
    expect(db.sellerListingAsset.create).not.toHaveBeenCalled();
  });

  it('rejects photos exceeding the published Article image cap', async () => {
    const { service, db } = arrange({ maximumImages: 2 });
    db.sellerListingAsset.count.mockResolvedValue(2);
    await expect(service.begin(listingId, actorId, upload)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SELLER_LISTING_MEDIA_LIMIT_REACHED' }),
    });
    expect(db.sellerListingAsset.create).not.toHaveBeenCalled();
  });

  it('turns simultaneous presign serializability failures into retryable conflicts', async () => {
    const { service, db } = arrange({ maximumImages: 1 });
    db.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Serialization failed', {
        code: 'P2034', clientVersion: '7.10.0',
      }),
    );
    await expect(service.begin(listingId, actorId, upload)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SELLER_LISTING_MEDIA_CONCURRENT_UPDATE' }),
    });
  });

  it('permits uploads exactly until the Admin maximum is reached', async () => {
    const { service, db } = arrange({ maximumImages: 2 });
    db.sellerListingAsset.count.mockResolvedValue(1);
    await expect(service.begin(listingId, actorId, upload)).resolves.toMatchObject({ assetId: 'asset-uuid' });
  });

  it('rejects oversize or mislabeled files before creating metadata', async () => {
    const { service, db } = arrange();
    await expect(service.begin(listingId, actorId, { ...upload, sizeBytes: 9 * 1024 * 1024 }))
      .rejects.toThrow('8 MB');
    await expect(service.begin(listingId, actorId, { ...upload, mimeType: 'image/svg+xml' }))
      .rejects.toThrow('JPG, PNG, WebP and PDF');
    expect(db.sellerListingAsset.create).not.toHaveBeenCalled();
  });
  it('distinguishes a successfully loaded empty media list from a missing media table', async () => {
    const { service, db } = arrange();
    await expect(service.listForSeller(listingId, actorId)).resolves.toEqual([]);
    expect(db.sellerListingAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { listingId, status: MasterDataStatus.ACTIVE },
    }));

    db.sellerListingAsset.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Missing media table', {
        code: 'P2021', clientVersion: '7.10.0',
      }),
    );
    await expect(service.listForSeller(listingId, actorId)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SELLER_LISTING_MEDIA_SCHEMA_NOT_READY',
      }),
    });
  });

  it('never exposes an unpublished staged image in the Admin public media list', async () => {
    const { service, db } = arrange({ status: SellerListingStatus.ACTIVE });
    await expect(service.listForAdmin(listingId)).resolves.toEqual([]);
    expect(db.sellerListingAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { listingId, status: MasterDataStatus.ACTIVE, isPublished: true },
    }));
  });

  it('reports the media schema as unavailable when Prisma columns are missing', async () => {
    const { service, db } = arrange();
    db.sellerListingAsset.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Missing media column', {
        code: 'P2022', clientVersion: '7.10.0',
      }),
    );
    await expect(service.listForSeller(listingId, actorId)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SELLER_LISTING_MEDIA_SCHEMA_NOT_READY',
      }),
    });
  });

  it('identifies a stale generated Prisma Client without a Listing media delegate', async () => {
    const { service, db } = arrange();
    Reflect.deleteProperty(db.sellerListingAsset, 'findMany');
    await expect(service.listForSeller(listingId, actorId)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SELLER_LISTING_MEDIA_SCHEMA_NOT_READY',
      }),
    });
  });

  it('persists verified image order and primary on Draft Listings only', async () => {
    const { service, db } = arrange();
    const first = '44444444-4444-4444-8444-444444444444';
    const second = '55555555-5555-4555-8555-555555555555';
    db.sellerListingAsset.findMany.mockResolvedValue([
      { id: first, type: 'IMAGE' }, { id: second, type: 'IMAGE' },
    ]);
    await service.order(listingId, actorId, [second, first], second);
    expect(db.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { isPrimary: false },
    }));
    expect(db.sellerListingAsset.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: second },
      data: { sortOrder: 0, isPrimary: true },
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'SELLER_LISTING_ASSETS_ORDERED' }),
    }));
  });

  it('refuses direct mutation of a published Listing image', async () => {
    const { service, db, r2 } = arrange({ status: SellerListingStatus.ACTIVE });
    db.sellerListingAsset.findFirst.mockResolvedValue({
      storageKey: 'seller-listings/object.webp', status: MasterDataStatus.ACTIVE,
      isPublished: true,
    });
    await expect(service.remove(listingId, actorId, actorId)).rejects.toThrow('no longer editable');
    expect(r2.remove).not.toHaveBeenCalled();
  });

  it('archives removed Draft media before deleting its R2 object', async () => {
    const { service, db, r2 } = arrange();
    db.sellerListingAsset.findFirst.mockResolvedValue({
      storageKey: 'seller-listings/object.webp', status: MasterDataStatus.ACTIVE,
      isPublished: true,
    });
    await expect(service.remove(listingId, actorId, actorId)).resolves.toEqual({ removed: true });
    expect(db.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: MasterDataStatus.ARCHIVED, isPrimary: false },
    }));
    expect(r2.remove).toHaveBeenCalledWith('seller-listings/object.webp');
  });

  it('issues a private preview for a verified asset but never a pending binary', async () => {
    const { service, db, r2 } = arrange();
    db.sellerListingAsset.findFirst.mockResolvedValue({
      storageKey: 'seller-listings/verified.webp', mimeType: 'image/webp',
    });
    await expect(service.preview(listingId, actorId, actorId)).resolves.toMatchObject({
      mimeType: 'image/webp', expiresInSeconds: 120,
    });
    expect(r2.sign).toHaveBeenCalledWith('seller-listings/verified.webp', 'GET', 120);
    expect(db.sellerListingAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: MasterDataStatus.ACTIVE }),
    }));
  });

  it('normalizes image/jpg to image/jpeg during presign', async () => {
    const { service, r2, db } = arrange();
    const result = await service.begin(listingId, actorId, {
      mimeType: 'image/jpg',
      sizeBytes: 1024,
      fileName: 'photo.jpg',
    });
    expect(result.mimeType).toBe('image/jpeg');
    expect(r2.sign).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), 'PUT', 300, 'image/jpeg');
    expect(db.sellerListingAsset.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mimeType: 'image/jpeg' }),
    }));
  });

  it('archives draft asset when replaceDraftAssetId is provided during retry', async () => {
    const { service, db } = arrange();
    const replaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await service.begin(listingId, actorId, {
      ...upload,
      replaceDraftAssetId: replaceId,
    });
    expect(db.sellerListingAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: replaceId,
        listingId,
        status: MasterDataStatus.DRAFT,
      },
      data: { status: MasterDataStatus.ARCHIVED },
    });
  });

  it('automatically elects the first verified image as primary in complete()', async () => {
    const { service, db } = arrange();
    const pendingAssetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    db.sellerListingAsset.findFirst.mockImplementation(({ where }: any = {}) => {
      if (where?.id === pendingAssetId) {
        return Promise.resolve({
          id: pendingAssetId,
          listingId,
          type: 'IMAGE',
          mimeType: 'image/jpeg',
          sizeBytes: 4096,
          storageKey: 'seller-listings/temp.jpg',
          status: MasterDataStatus.DRAFT,
        });
      }
      if (where?.isPrimary === true) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const result = await service.complete(listingId, pendingAssetId, actorId);
    expect(result).toEqual({ id: pendingAssetId, status: MasterDataStatus.ACTIVE });
    expect(db.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: pendingAssetId, listingId, status: MasterDataStatus.DRAFT },
      data: expect.objectContaining({
        status: MasterDataStatus.ACTIVE,
        storageKey: 'seller-listings/sealed.jpg',
        isPrimary: true,
      }),
    }));
  });

  it('elects the next active image as primary when the primary image is removed', async () => {
    const { service, db } = arrange();
    const removeAssetId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const nextImageId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    let findFirstCalls = 0;
    db.sellerListingAsset.findFirst.mockImplementation(({ where }: any = {}) => {
      findFirstCalls++;
      if (findFirstCalls === 1) {
        return Promise.resolve({
          id: removeAssetId,
          storageKey: 'seller-listings/primary.jpg',
          status: MasterDataStatus.ACTIVE,
          isPublished: true,
        });
      }
      if (where?.isPrimary === true) {
        return Promise.resolve(null);
      }
      return Promise.resolve({ id: nextImageId });
    });

    const result = await service.remove(listingId, removeAssetId, actorId);
    expect(result).toEqual({ removed: true });
    expect(db.sellerListingAsset.update).toHaveBeenCalledWith({
      where: { id: nextImageId },
      data: { isPrimary: true },
    });
  });

});
