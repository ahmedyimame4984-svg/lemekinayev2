import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  MasterDataStatus, ProductAssetType, ProductTypeRequirementLevel, Prisma,
} from '@prisma/client';

export type ProposedListingMedia = {
  assetIds: string[];
  primaryId: string | null;
};

type MediaPolicy = {
  imageRequirement: ProductTypeRequirementLevel;
  minimumImageCount: number;
  maximumImageCount: number;
  documentRequirement: ProductTypeRequirementLevel;
  minimumDocumentCount: number;
};

/** Parse stored review data defensively; never publish arbitrary JSON. */
export function parseProposedMedia(value: Prisma.JsonValue | null): ProposedListingMedia | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ConflictException('The pending media revision is invalid.');
  }
  const ids = value.assetIds;
  const primary = value.primaryId;
  if (!Array.isArray(ids) || ids.length > 40 ||
      ids.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) ||
      new Set(ids).size !== ids.length ||
      (primary !== null && (typeof primary !== 'string' || !ids.includes(primary)))) {
    throw new ConflictException('The pending media revision contains invalid asset references.');
  }
  return { assetIds: ids as string[], primaryId: primary as string | null };
}

/**
 * Validate the complete proposed image/document set, including removals.
 * New staged assets are never counted as public before Admin approval.
 */
export async function validateProposedMedia(
  tx: Prisma.TransactionClient,
  listingId: string,
  proposal: ProposedListingMedia,
  policy: MediaPolicy,
  reviewRevisionId?: string,
): Promise<Array<{ id: string; type: ProductAssetType; isPublished: boolean; stagedForRevisionId: string | null }>> {
  if (proposal.assetIds.length > 40 || new Set(proposal.assetIds).size !== proposal.assetIds.length) {
    throw new BadRequestException('The proposed media set must contain at most 40 unique assets.');
  }
  const assets = await tx.sellerListingAsset.findMany({
    where: { id: { in: proposal.assetIds }, listingId, status: MasterDataStatus.ACTIVE },
    select: { id: true, type: true, isPublished: true, stagedForRevisionId: true },
  });
  if (assets.length !== proposal.assetIds.length || assets.some(asset =>
    !asset.isPublished && asset.stagedForRevisionId !== (reviewRevisionId ?? null))) {
    throw new ConflictException('A proposed image was removed, not verified or belongs to another revision.');
  }
  const images = assets.filter(asset => asset.type === ProductAssetType.IMAGE);
  const docs = assets.filter(asset => asset.type === ProductAssetType.DOCUMENT);
  const minimumImages = policy.imageRequirement === ProductTypeRequirementLevel.REQUIRED
    ? Math.max(1, policy.minimumImageCount) : 0;
  const minimumDocuments = policy.documentRequirement === ProductTypeRequirementLevel.REQUIRED
    ? Math.max(1, policy.minimumDocumentCount) : 0;
  if (images.length < minimumImages || images.length > policy.maximumImageCount ||
      docs.length < minimumDocuments || docs.length > 20 ||
      (policy.imageRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && images.length > 0) ||
      (policy.documentRequirement === ProductTypeRequirementLevel.NOT_APPLICABLE && docs.length > 0)) {
    throw new BadRequestException('The proposed images or documents do not satisfy the Product Type media limits.');
  }
  if (images.length > 0 && !images.some(asset => asset.id === proposal.primaryId)) {
    throw new BadRequestException('Select a verified primary Listing image.');
  }
  if (images.length === 0 && proposal.primaryId !== null) {
    throw new BadRequestException('The primary image must belong to the proposed image set.');
  }
  return assets;
}

/** Swap only verified, validated Listing assets inside the Admin approval transaction. */
export async function publishProposedMedia(
  tx: Prisma.TransactionClient,
  listingId: string,
  reviewRevisionId: string,
  proposed: ProposedListingMedia,
  policy: MediaPolicy,
): Promise<string[]> {
  const assets = await validateProposedMedia(tx, listingId, proposed, policy, reviewRevisionId);
  const selected = new Set(assets.map(asset => asset.id));
  const old = await tx.sellerListingAsset.findMany({
    where: { listingId, status: MasterDataStatus.ACTIVE, isPublished: true },
    select: { id: true, storageKey: true },
  });
  const removed = old.filter(asset => !selected.has(asset.id));
  const removedIds = removed.map(asset => asset.id);
  if (removedIds.length) {
    await tx.sellerListingAsset.updateMany({
      where: { id: { in: removedIds }, listingId, status: MasterDataStatus.ACTIVE, isPublished: true },
      data: { status: MasterDataStatus.ARCHIVED, isPublished: false, isPrimary: false },
    });
  }
  await tx.sellerListingAsset.updateMany({
    where: { listingId, status: MasterDataStatus.ACTIVE, isPublished: true },
    data: { isPrimary: false },
  });
  for (let index = 0; index < proposed.assetIds.length; index++) {
    const assetId = proposed.assetIds[index]!;
    const changed = await tx.sellerListingAsset.updateMany({
      where: {
        id: assetId, listingId, status: MasterDataStatus.ACTIVE,
        OR: [{ isPublished: true }, { stagedForRevisionId: reviewRevisionId }],
      },
      data: {
        isPublished: true, stagedForRevisionId: null,
        sortOrder: index, isPrimary: assetId === proposed.primaryId,
      },
    });
    if (changed.count !== 1) throw new ConflictException('Proposed images changed during review.');
  }
  return removed.map(asset => asset.storageKey);
}
