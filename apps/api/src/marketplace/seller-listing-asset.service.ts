import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import {
  MasterDataStatus, ProductAssetType, ProductTypeRequirementLevel,
  SellerListingStatus, SellerListingRevisionStatus, Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { SellerService } from './seller.service.js';
import { SellerR2StorageService } from './seller-r2-storage.service.js';

export const SELLER_MEDIA_MIME_TYPES: Readonly<Record<string, { type: ProductAssetType; extension: string }>> = {
  'image/jpeg': { type: ProductAssetType.IMAGE, extension: 'jpg' },
  'image/png': { type: ProductAssetType.IMAGE, extension: 'png' },
  'image/webp': { type: ProductAssetType.IMAGE, extension: 'webp' },
  'application/pdf': { type: ProductAssetType.DOCUMENT, extension: 'pdf' },
};
const MAX_ASSET_SIZE = 8 * 1024 * 1024;
const MAX_IMAGES = 20;
const MAX_DOCUMENTS = 20;
const MUTABLE: SellerListingStatus[] = [
  SellerListingStatus.DRAFT,
  SellerListingStatus.REJECTED,
];
const LIVE: SellerListingStatus[] = [
  SellerListingStatus.ACTIVE,
  SellerListingStatus.OUT_OF_STOCK,
  SellerListingStatus.PAUSED,
];

@Injectable()
export class SellerListingAssetService {
  private readonly logger = new Logger(SellerListingAssetService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly sellers: SellerService,
    private readonly storage: SellerR2StorageService,
  ) {}

  private async owned(listingId: string, userId: string, editing = false) {
    const seller = await this.sellers.requireOperationalSellerByUser(userId);
    const listing = await this.database.sellerListing.findFirst({
      where: { id: listingId, sellerId: seller.id },
      select: {
        id: true, sellerId: true, status: true,
        product: { select: {
          imageRequirement: true, minimumImageCount: true, maximumImageCount: true,
          documentRequirement: true, minimumDocumentCount: true,
        } },
      },
    });
    if (!listing) throw new NotFoundException('Seller Listing not found.');
    if (editing && ![...MUTABLE, ...LIVE].includes(listing.status)) {
      throw new ConflictException('Listing media cannot be changed in its current state.');
    }
    return listing;
  }

  private async assertMutableTransaction(
    tx: Prisma.TransactionClient, listingId: string, sellerId: string,
  ) {
    const listing = await tx.sellerListing.findFirst({
      where: { id: listingId, sellerId, status: { in: MUTABLE } },
      select: { id: true },
    });
    if (!listing) {
      throw new ConflictException('Listing is no longer editable. Reload its approval status.');
    }
  }

  /** Staged uploads are permitted on live Listings, but never after a revision is submitted. */
  private async assertUploadMutable(
    tx: Prisma.TransactionClient, listingId: string, sellerId: string,
  ) {
    const listing = await tx.sellerListing.findFirst({
      where: { id: listingId, sellerId, status: { in: [...MUTABLE, ...LIVE] } },
      select: { status: true },
    });
    if (!listing) throw new ConflictException('Listing can no longer accept image updates.');
    if (LIVE.includes(listing.status)) {
      const pending = await tx.sellerListingRevision.findFirst({
        where: { listingId, status: SellerListingRevisionStatus.PENDING },
        select: { id: true },
      });
      if (pending) throw new ConflictException('Wait for Admin to review the current Listing revision.');
    }
    return LIVE.includes(listing.status);
  }

  async requirements(listingId: string, userId: string) {
    const { product } = await this.owned(listingId, userId);
    return {
      image: product.imageRequirement,
      minimumImageCount: product.minimumImageCount,
      maximumImageCount: product.maximumImageCount,
      document: product.documentRequirement,
      minimumDocumentCount: product.minimumDocumentCount,
    };
  }

  async begin(
    listingId: string, userId: string,
    input: { mimeType: string; sizeBytes: number; fileName: string },
  ) {
    const listing = await this.owned(listingId, userId, true);
    const kind = SELLER_MEDIA_MIME_TYPES[input.mimeType];
    if (!kind) throw new BadRequestException('Only JPG, PNG, WebP and PDF files are permitted.');
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MAX_ASSET_SIZE) {
      throw new BadRequestException('Files must be between 1 byte and 8 MB.');
    }
    const requirement = kind.type === ProductAssetType.IMAGE
      ? listing.product.imageRequirement : listing.product.documentRequirement;
    if (requirement === ProductTypeRequirementLevel.NOT_APPLICABLE) {
      throw new BadRequestException('This Product Type does not allow the selected media type.');
    }
    const fileKey = `seller-listings/${listing.sellerId}/${listingId}/${randomUUID()}.${kind.extension}`;
    const filename = input.fileName.split(/[\\/]/u).pop()?.trim().slice(0, 180) || 'Seller media';
    // Fail before writing a pending row if R2 configuration is unavailable.
    const uploadUrl = this.storage.sign(fileKey, 'PUT', 300, input.mimeType);
    const record = await this.database.$transaction(async tx => {
      const staging = await this.assertUploadMutable(tx, listingId, listing.sellerId);
      // Clean up stale abandoned draft intents older than 5 minutes so they don't block retries
      await tx.sellerListingAsset.updateMany({
        where: {
          listingId, type: kind.type, status: MasterDataStatus.DRAFT,
          createdAt: { lt: new Date(Date.now() - 5 * 60_000) },
        },
        data: { status: MasterDataStatus.ARCHIVED },
      }).catch(() => undefined);
      const count = await tx.sellerListingAsset.count({
        where: {
          listingId, type: kind.type,
          ...(staging ? { isPublished: false } : {}),
          OR: [
            { status: MasterDataStatus.ACTIVE },
            { status: MasterDataStatus.DRAFT,
              createdAt: { gte: new Date(Date.now() - 5 * 60_000) } },
          ],
        },
      });
      // Replacements can temporarily exceed the published cap. The final proposed
      // set is validated against Article limits when Seller saves for review.
      const limit = kind.type === ProductAssetType.IMAGE
        ? (staging ? MAX_IMAGES : Math.min(MAX_IMAGES, listing.product.maximumImageCount))
        : MAX_DOCUMENTS;
      if (count >= limit) {
        throw new BadRequestException({
          code: 'SELLER_LISTING_MEDIA_LIMIT_REACHED',
          message: kind.type === ProductAssetType.IMAGE
            ? `This Product Type permits at most ${limit} Listing image(s).`
            : 'The Listing has reached its document upload limit.',
        });
      }
      return tx.sellerListingAsset.create({
        data: {
          listingId, type: kind.type, storageKey: fileKey,
          mimeType: input.mimeType, sizeBytes: input.sizeBytes,
          originalName: filename, status: MasterDataStatus.DRAFT,
          isPublished: !staging,
          createdById: userId,
        },
        select: { id: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({
          code: 'SELLER_LISTING_MEDIA_CONCURRENT_UPDATE',
          message: 'The Listing media changed during upload preparation. Retry with the latest image count.',
        });
      }
      throw error;
    });
    return { assetId: record.id, uploadUrl, mimeType: input.mimeType, expiresInSeconds: 300 };
  }

  async complete(listingId: string, assetId: string, userId: string) {
    const owner = await this.owned(listingId, userId, true);
    const asset = await this.database.sellerListingAsset.findFirst({
      where: { id: assetId, listingId, status: { not: MasterDataStatus.ARCHIVED } },
    });
    if (!asset) throw new NotFoundException('Pending media upload not found.');
    if (asset.status === MasterDataStatus.ACTIVE) {
      return { id: assetId, status: MasterDataStatus.ACTIVE, replayed: true };
    }
    if (asset.status !== MasterDataStatus.DRAFT) {
      throw new ConflictException('The file is not pending upload.');
    }
    try {
      await this.storage.verifyUploaded(asset.storageKey, asset.mimeType, asset.sizeBytes);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof TypeError || (error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError'))) {
        this.logger.warn('R2 upload verification could not reach storage.');
        throw new ServiceUnavailableException({
          code: 'SELLER_R2_VERIFICATION_UNAVAILABLE',
          message: 'Uploaded media cannot be verified because R2 is temporarily unreachable.',
        });
      }
      throw new BadRequestException({
        code: 'SELLER_R2_FILE_INVALID',
        message: 'Uploaded file is missing, truncated or has an invalid format. Select a valid file and retry.',
      });
    }
    // Browser PUT never targets the verified server-owned object.
    let sealedKey: string;
    try {
      sealedKey = await this.storage.sealUpload(
        asset.storageKey, asset.mimeType, asset.sizeBytes,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn('R2 uploaded file could not be finalized for Listing review.');
      throw new ServiceUnavailableException({
        code: 'SELLER_R2_FINALIZATION_FAILED',
        message: 'The uploaded file could not be finalized in private storage. Retry the upload.',
      });
    }
    try {
      await this.database.$transaction(async tx => {
        await this.assertUploadMutable(tx, listingId, owner.sellerId);
        const result = await tx.sellerListingAsset.updateMany({
          where: { id: assetId, listingId, status: MasterDataStatus.DRAFT },
          data: { status: MasterDataStatus.ACTIVE, storageKey: sealedKey },
        });
        if (result.count !== 1) throw new ConflictException('This upload has already been completed.');
        await tx.auditLog.create({ data: {
          actorId: userId, action: 'SELLER_LISTING_ASSET_VERIFIED',
          entityType: 'SellerListingAsset', entityId: assetId,
          metadata: { listingId, type: asset.type, mimeType: asset.mimeType },
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // A second completion may have won. Never leave a second sealed file.
      await this.storage.remove(sealedKey).catch(() => this.logger.warn('Sealed R2 media cleanup pending after Listing transaction conflict.'));
      throw error;
    }
    // Temporary signed PUT remains valid briefly, but can no longer change
    // the immutable object that Admin will review.
    await this.storage.remove(asset.storageKey).catch(() => this.logger.warn('Temporary R2 upload cleanup pending.'));
    return { id: assetId, status: MasterDataStatus.ACTIVE };
  }

  async listForSeller(listingId: string, userId: string) {
    await this.owned(listingId, userId);
    return this.records(listingId, true);
  }

  async listForAdmin(listingId: string) {
    const exists = await this.database.sellerListing.findUnique({
      where: { id: listingId }, select: { id: true },
    });
    if (!exists) throw new NotFoundException('Listing not found.');
    return this.records(listingId);
  }

  private async records(listingId: string, includeStaged = false) {
    try {
      // A stale generated Prisma Client has no SellerListingAsset delegate.
      // Fail with an actionable service code instead of a TypeError / HTTP 500.
      const assets = this.database.sellerListingAsset;
      if (!assets || typeof assets.findMany !== 'function') {
        this.logger.error('Seller Listing media Prisma client is outdated. Run db:generate and restart the API.');
        throw new ServiceUnavailableException({
          code: 'SELLER_LISTING_MEDIA_SCHEMA_NOT_READY',
          message: 'Listing media is temporarily unavailable. Please contact support.',
        });
      }
      return await assets.findMany({
        where: { listingId, status: MasterDataStatus.ACTIVE,
          ...(!includeStaged ? { isPublished: true } : {}),
        },
        select: {
          id: true, type: true, mimeType: true, sizeBytes: true,
          originalName: true, sortOrder: true, isPrimary: true, createdAt: true,
          isPublished: true, stagedForRevisionId: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2021' || error.code === 'P2022')
      ) {
        // P2021/P2022 mean the API model and connected database disagree.
        // Never expose Prisma SQL, table names or connection details to Sellers.
        this.logger.error(
          'Seller Listing media schema is unavailable. Verify the connected database and apply the pending Seller Listing media migration.',
        );
        throw new ServiceUnavailableException({
          code: 'SELLER_LISTING_MEDIA_SCHEMA_NOT_READY',
          message: 'Listing media is temporarily unavailable. Please contact support.',
        });
      }
      throw error;
    }
  }

  async preview(listingId: string, assetId: string, userId?: string) {
    if (userId) await this.owned(listingId, userId);
    else {
      const listing = await this.database.sellerListing.findUnique({
        where: { id: listingId }, select: { id: true },
      });
      if (!listing) throw new NotFoundException('Listing not found.');
    }
    const asset = await this.database.sellerListingAsset.findFirst({
      where: {
        id: assetId, listingId, status: MasterDataStatus.ACTIVE,
        ...(userId ? {} : { OR: [
          { isPublished: true },
          { stagedForRevision: { is: { status: SellerListingRevisionStatus.PENDING } } },
        ] }),
      },
      select: { storageKey: true, mimeType: true },
    });
    if (!asset) throw new NotFoundException('Listing media not found.');
    return {
      url: this.storage.sign(asset.storageKey, 'GET', 120),
      expiresInSeconds: 120, mimeType: asset.mimeType,
    };
  }

  async order(listingId: string, userId: string, assetIds: string[], primaryId?: string) {
    const owner = await this.owned(listingId, userId, true);
    if (assetIds.length > MAX_IMAGES + MAX_DOCUMENTS ||
        new Set(assetIds).size !== assetIds.length) {
      throw new BadRequestException('Media order must contain unique asset IDs.');
    }
    await this.database.$transaction(async tx => {
      await this.assertMutableTransaction(tx, listingId, owner.sellerId);
      const existing = await tx.sellerListingAsset.findMany({
        where: { listingId, status: MasterDataStatus.ACTIVE },
        select: { id: true, type: true },
      });
      if (existing.length !== assetIds.length ||
          existing.some(row => !assetIds.includes(row.id))) {
        throw new BadRequestException('Include each active Listing asset exactly once.');
      }
      if (primaryId && !existing.some(row =>
        row.id === primaryId && row.type === ProductAssetType.IMAGE)) {
        throw new BadRequestException('Primary media must be an existing Listing image.');
      }
      await tx.sellerListingAsset.updateMany({
        where: { listingId, status: MasterDataStatus.ACTIVE },
        data: { isPrimary: false },
      });
      for (let i = 0; i < assetIds.length; i++) {
        await tx.sellerListingAsset.update({
          where: { id: assetIds[i]! },
          data: { sortOrder: i, isPrimary: assetIds[i] === primaryId },
        });
      }
      await tx.auditLog.create({ data: {
        actorId: userId, action: 'SELLER_LISTING_ASSETS_ORDERED',
        entityType: 'SellerListing', entityId: listingId,
        metadata: { assetIds, primaryId: primaryId ?? null },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.records(listingId);
  }

  async remove(listingId: string, assetId: string, userId: string) {
    const owner = await this.owned(listingId, userId, true);
    const asset = await this.database.sellerListingAsset.findFirst({
      where: { id: assetId, listingId, status: { not: MasterDataStatus.ARCHIVED } },
      select: { storageKey: true, status: true, isPublished: true },
    });
    if (!asset) throw new NotFoundException('Listing media not found.');
    // Revoke database visibility before deleting R2 content. If R2 is temporarily
    // unavailable the orphan cannot be served via the authenticated preview API.
    await this.database.$transaction(async tx => {
      if (asset.isPublished) {
        await this.assertMutableTransaction(tx, listingId, owner.sellerId);
      } else {
        await this.assertUploadMutable(tx, listingId, owner.sellerId);
      }
      const updated = await tx.sellerListingAsset.updateMany({
        where: { id: assetId, listingId, status: { not: MasterDataStatus.ARCHIVED } },
        data: { status: MasterDataStatus.ARCHIVED, isPrimary: false },
      });
      if (updated.count !== 1) throw new ConflictException('Media was already removed.');
      await tx.auditLog.create({ data: {
        actorId: userId, action: 'SELLER_LISTING_ASSET_REMOVED',
        entityType: 'SellerListingAsset', entityId: assetId,
        metadata: { listingId },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try {
      await this.storage.remove(asset.storageKey);
    } catch {
      // Do not reactivate a potentially compromised asset. Ops can purge
      // archived keys using the immutable stored key after R2 recovers.
      throw new ConflictException('Media removed from Listing; R2 cleanup needs an operator retry.');
    }
    return { removed: true };
  }


}
