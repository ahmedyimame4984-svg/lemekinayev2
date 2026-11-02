import { describe, expect, it, vi } from 'vitest';
import { MasterDataStatus, ProductAssetType, ProductTypeRequirementLevel, type Prisma } from '@prisma/client';
import { parseProposedMedia, publishProposedMedia, validateProposedMedia } from './seller-listing-media-revision.js';

const listingId = '22222222-2222-4222-8222-222222222222';
const prior = '33333333-3333-4333-8333-333333333333';
const replacement = '44444444-4444-4444-8444-444444444444';
const revisionId = '55555555-5555-4555-8555-555555555555';
const policy = {
  imageRequirement: ProductTypeRequirementLevel.REQUIRED,
  minimumImageCount: 1,
  maximumImageCount: 1,
  documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
  minimumDocumentCount: 0,
};

function transaction(records: Array<{ id: string; type: ProductAssetType; isPublished: boolean; stagedForRevisionId: string | null }> = [
  { id: prior, type: ProductAssetType.IMAGE, isPublished: true, stagedForRevisionId: null },
  { id: replacement, type: ProductAssetType.IMAGE, isPublished: false, stagedForRevisionId: null },
]) {
  const mock = {
    sellerListingAsset: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { id?: { in: string[] } } }) =>
        Promise.resolve(where.id ? records.filter(row => where.id!.in.includes(row.id))
          : records.filter(row => row.isPublished))),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { mock, tx: mock as unknown as Prisma.TransactionClient };
}

describe('Seller Listing staged-media publication', () => {
  it('rejects duplicate, missing and invalid proposed IDs', async () => {
    const { tx } = transaction();
    await expect(validateProposedMedia(tx, listingId, {
      assetIds: [prior, prior], primaryId: prior,
    }, policy)).rejects.toThrow('unique');
    await expect(validateProposedMedia(tx, listingId, {
      assetIds: [replacement], primaryId: null,
    }, policy)).rejects.toThrow('primary');
    await expect(validateProposedMedia(tx, listingId, {
      assetIds: ['66666666-6666-4666-8666-666666666666'], primaryId: null,
    }, policy)).rejects.toThrow('removed');
  });

  it('allows a verified replacement while the currently published image remains live', async () => {
    const { tx } = transaction();
    const result = await validateProposedMedia(tx, listingId, {
      assetIds: [replacement], primaryId: replacement,
    }, policy);
    expect(result[0]?.isPublished).toBe(false);
  });

  it('enforces the final Product Type maximum, not the transient staged image total', async () => {
    const { tx } = transaction();
    await expect(validateProposedMedia(tx, listingId, {
      assetIds: [prior, replacement], primaryId: prior,
    }, policy)).rejects.toThrow('limits');
  });

  it('will not include images staged for a different Admin revision', async () => {
    const { tx } = transaction([{
      id: replacement, type: ProductAssetType.IMAGE,
      isPublished: false, stagedForRevisionId: revisionId,
    }]);
    await expect(validateProposedMedia(tx, listingId, {
      assetIds: [replacement], primaryId: replacement,
    }, policy)).rejects.toThrow('another revision');
  });

  it('retires excluded published images and promotes selected staged images atomically', async () => {
    const { tx, mock } = transaction([
      { id: prior, type: ProductAssetType.IMAGE, isPublished: true, stagedForRevisionId: null },
      { id: replacement, type: ProductAssetType.IMAGE, isPublished: false, stagedForRevisionId: revisionId },
    ]);
    await publishProposedMedia(tx, listingId, revisionId, {
      assetIds: [replacement], primaryId: replacement,
    }, policy);
    expect(mock.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [prior] } }),
      data: expect.objectContaining({ status: MasterDataStatus.ARCHIVED, isPublished: false }),
    }));
    expect(mock.sellerListingAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: replacement }),
      data: expect.objectContaining({ isPublished: true, stagedForRevisionId: null, isPrimary: true }),
    }));
  });

  it('rejects malformed database JSON rather than publishing an arbitrary set', () => {
    expect(parseProposedMedia({ assetIds: [prior], primaryId: prior })).toEqual({
      assetIds: [prior], primaryId: prior,
    });
    expect(() => parseProposedMedia({ assetIds: [prior, prior], primaryId: prior })).toThrow();
    expect(() => parseProposedMedia({ assetIds: [prior], primaryId: replacement })).toThrow();
  });
});
