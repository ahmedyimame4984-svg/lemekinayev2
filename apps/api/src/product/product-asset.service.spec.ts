import {
  MasterDataStatus,
  ProductAssetType,
  ProductAssetVisibility,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { ProductAssetService } from './product-asset.service.js';

describe('ProductAssetService', () => {
  const product = { findUnique: vi.fn() };
  const productAsset = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    product,
    productAsset,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ productAsset, auditLog }),
    ),
  };
  const service = new ProductAssetService(
    database as unknown as DatabaseService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const productId = '11111111-1111-4111-8111-111111111111';
  const assetId = '22222222-2222-4222-8222-222222222222';
  const now = new Date('2026-09-28T08:00:00.000Z');

  const asset = {
    id: assetId,
    productId,
    type: ProductAssetType.IMAGE,
    title: 'Front photo',
    storageReference: 'products/example/front.jpg',
    mimeType: 'image/jpeg',
    visibility: ProductAssetVisibility.PUBLIC,
    sortOrder: 0,
    status: MasterDataStatus.DRAFT,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockResolvedValue({ id: productId });
    productAsset.create.mockResolvedValue(asset);
    auditLog.create.mockResolvedValue({});
  });

  it('creates auditable canonical asset metadata without storing binary content', async () => {
    await expect(
      service.create(
        productId,
        {
          type: ProductAssetType.IMAGE,
          title: ' Front photo ',
          storageReference: ' products/example/front.jpg ',
          mimeType: ' image/jpeg ',
          visibility: ProductAssetVisibility.PUBLIC,
          status: MasterDataStatus.DRAFT,
        },
        actorId,
      ),
    ).resolves.toMatchObject(asset);

    expect(productAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        title: 'Front photo',
        storageReference: 'products/example/front.jpg',
        mimeType: 'image/jpeg',
      }),
      select: expect.any(Object),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_ASSET_CREATED',
          entityType: 'ProductAsset',
          entityId: assetId,
        }),
      }),
    );
  });

  it('rejects stale asset updates', async () => {
    productAsset.findFirst.mockResolvedValue({ ...asset, version: 3 });

    await expect(
      service.update(
        productId,
        assetId,
        { version: 2, title: 'Updated' },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_ASSET_VERSION_CONFLICT' },
    });
    expect(productAsset.update).not.toHaveBeenCalled();
  });
});
