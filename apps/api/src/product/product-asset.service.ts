import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MasterDataStatus, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  CreateProductAssetDto,
  ProductAssetAdminQueryDto,
  ProductAssetResponseDto,
  UpdateProductAssetDto,
} from './dto/product-asset.dto.js';

const assetSelect = {
  id: true,
  productId: true,
  type: true,
  title: true,
  storageReference: true,
  mimeType: true,
  visibility: true,
  sortOrder: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductAssetSelect;

@Injectable()
export class ProductAssetService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    productId: string,
    query: ProductAssetAdminQueryDto,
  ): Promise<ProductAssetResponseDto[]> {
    await this.requireProduct(productId);
    return this.database.productAsset.findMany({
      where: {
        productId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: assetSelect,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async create(
    productId: string,
    input: CreateProductAssetDto,
    actorId: string,
  ): Promise<ProductAssetResponseDto> {
    await this.requireProduct(productId);

    try {
      return await this.database.$transaction(async (transaction) => {
        const asset = await transaction.productAsset.create({
          data: {
            productId,
            type: input.type,
            title: input.title.trim(),
            storageReference: input.storageReference.trim(),
            mimeType: this.optional(input.mimeType),
            visibility: input.visibility,
            sortOrder: input.sortOrder ?? 0,
            status: input.status ?? MasterDataStatus.DRAFT,
            createdById: actorId,
            updatedById: actorId,
          },
          select: assetSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PRODUCT_ASSET_CREATED',
            entityType: 'ProductAsset',
            entityId: asset.id,
            metadata: {
              productId,
              type: asset.type,
              visibility: asset.visibility,
              storageReference: asset.storageReference,
            },
          },
        });
        return asset;
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    productId: string,
    id: string,
    input: UpdateProductAssetDto,
    actorId: string,
  ): Promise<ProductAssetResponseDto> {
    const current = await this.database.productAsset.findFirst({
      where: { id, productId },
      select: assetSelect,
    });
    if (!current) throw this.assetNotFound();
    if (current.version !== input.version) throw this.assetVersionConflict();

    try {
      return await this.database.$transaction(async (transaction) => {
        const asset = await transaction.productAsset.update({
          where: { id, version: input.version },
          data: {
            type: input.type,
            title: input.title?.trim(),
            storageReference: input.storageReference?.trim(),
            mimeType:
              input.mimeType === undefined
                ? undefined
                : this.optional(input.mimeType),
            visibility: input.visibility,
            sortOrder: input.sortOrder,
            status: input.status,
            version: { increment: 1 },
            updatedById: actorId,
          },
          select: assetSelect,
        });

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PRODUCT_ASSET_UPDATED',
            entityType: 'ProductAsset',
            entityId: asset.id,
            metadata: {
              productId,
              previousVersion: input.version,
              nextVersion: input.version + 1,
              status: asset.status,
              visibility: asset.visibility,
            },
          },
        });
        return asset;
      });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private async requireProduct(productId: string): Promise<void> {
    const product = await this.database.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found',
      });
    }
  }

  private optional(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private assetNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PRODUCT_ASSET_NOT_FOUND',
      message: 'Product asset was not found',
    });
  }

  private assetVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'PRODUCT_ASSET_VERSION_CONFLICT',
      message: 'The Product asset changed; reload before updating',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PRODUCT_ASSET_ALREADY_EXISTS',
        message: 'This Product already uses the same asset reference',
      });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.assetVersionConflict();
    }
    throw error;
  }
}
