import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleIdentifierType,
  MasterDataStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import {
  assertDirectMasterStatusChange,
  assertMasterCreateStatusAllowed,
  assertMasterRecordEditable,
} from '../common/master-data-lifecycle-policy.js';
import { DatabaseService } from '../database/database.service.js';
import {
  articleIdentifierGlobalKey,
  canonicalArticleIdentifierValue,
  expectedGtinLength,
  hasValidGtinCheckDigit,
  isGtinType,
  normalizeArticleIdentifierValue,
} from './article-identifier.js';
import type {
  ArticleIdentifierAdminQueryDto,
  ArticleIdentifierPublicResponseDto,
  ArticleIdentifierResponseDto,
  CreateArticleIdentifierDto,
  UpdateArticleIdentifierDto,
} from './dto/article-identifier.dto.js';

const articleIdentifierPublicSelect = {
  type: true,
  value: true,
} satisfies Prisma.ArticleIdentifierSelect;

const articleIdentifierSelect = {
  id: true,
  productId: true,
  type: true,
  value: true,
  rawValue: true,
  normalizedValue: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleIdentifierSelect;

@Injectable()
export class ArticleIdentifierService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    productId: string,
    query: ArticleIdentifierAdminQueryDto = {},
  ): Promise<ArticleIdentifierResponseDto[]> {
    await this.requireProduct(productId);

    return this.database.articleIdentifier.findMany({
      where: {
        productId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      select: articleIdentifierSelect,
      orderBy: [{ type: 'asc' }, { normalizedValue: 'asc' }, { id: 'asc' }],
    });
  }

  async listPublished(
    productId: string,
  ): Promise<ArticleIdentifierPublicResponseDto[]> {
    const product = await this.requireProduct(productId);
    if (product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Active Manufacturer Article was not found',
      });
    }

    return this.database.articleIdentifier.findMany({
      where: {
        productId,
        status: MasterDataStatus.ACTIVE,
      },
      select: articleIdentifierPublicSelect,
      orderBy: [{ type: 'asc' }, { normalizedValue: 'asc' }, { id: 'asc' }],
    });
  }

  async create(
    productId: string,
    input: CreateArticleIdentifierDto,
    actorId: string,
  ): Promise<ArticleIdentifierResponseDto> {
    const product = await this.requireProduct(productId);
    const status = input.status ?? MasterDataStatus.DRAFT;
    assertMasterCreateStatusAllowed(status);
    this.validateLifecycle(product.status, status);

    const prepared = this.prepare(input.type, input.value);
    await this.assertGlobalIdentityAvailable(
      prepared.globalIdentityKey,
      productId,
    );

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const record = await transaction.articleIdentifier.create({
            data: {
              productId,
              type: input.type,
              value: prepared.value,
              rawValue: input.rawValue?.trim() || null,
              normalizedValue: prepared.normalizedValue,
              globalIdentityKey: prepared.globalIdentityKey,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: articleIdentifierSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ARTICLE_IDENTIFIER_CREATED',
              entityType: 'ArticleIdentifier',
              entityId: record.id,
              metadata: {
                productId,
                type: record.type,
                normalizedValue: record.normalizedValue,
              },
            },
          });

          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    productId: string,
    id: string,
    input: UpdateArticleIdentifierDto,
    actorId: string,
  ): Promise<ArticleIdentifierResponseDto> {
    const product = await this.requireProduct(productId);
    const current = await this.database.articleIdentifier.findFirst({
      where: { id, productId },
      select: articleIdentifierSelect,
    });
    if (!current) throw this.identifierNotFound();
    if (current.version !== input.version) throw this.versionConflict();

    assertMasterRecordEditable(current.status);
    assertDirectMasterStatusChange(current.status, input.status);

    const type = input.type ?? current.type;
    const candidateValue = input.value ?? current.value;
    const status = input.status ?? current.status;
    this.validateLifecycle(product.status, status);
    const prepared = this.prepare(type, candidateValue);

    await this.assertGlobalIdentityAvailable(
      prepared.globalIdentityKey,
      productId,
      id,
    );

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const record = await transaction.articleIdentifier.update({
            where: { id, version: input.version },
            data: {
              ...(input.type !== undefined ? { type } : {}),
              ...(input.value !== undefined
                ? {
                    value: prepared.value,
                    normalizedValue: prepared.normalizedValue,
                    globalIdentityKey: prepared.globalIdentityKey,
                  }
                : input.type !== undefined
                  ? {
                      value: prepared.value,
                      normalizedValue: prepared.normalizedValue,
                      globalIdentityKey: prepared.globalIdentityKey,
                    }
                  : {}),
              ...(input.rawValue !== undefined
                ? { rawValue: input.rawValue?.trim() || null }
                : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: articleIdentifierSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ARTICLE_IDENTIFIER_UPDATED',
              entityType: 'ArticleIdentifier',
              entityId: record.id,
              metadata: {
                productId,
                previousVersion: input.version,
                nextVersion: input.version + 1,
                type: record.type,
                normalizedValue: record.normalizedValue,
                status: record.status,
              },
            },
          });

          return record;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private prepare(type: ArticleIdentifierType, inputValue: string): {
    value: string;
    normalizedValue: string;
    globalIdentityKey: string | null;
  } {
    const value = canonicalArticleIdentifierValue(type, inputValue);
    const normalizedValue = normalizeArticleIdentifierValue(type, inputValue);

    if (!normalizedValue) {
      throw new BadRequestException({
        code: 'ARTICLE_IDENTIFIER_INVALID',
        message: 'Article identifier must contain meaningful characters',
      });
    }

    if (isGtinType(type)) {
      const expectedLength = expectedGtinLength(type);
      if (!/^\d+$/u.test(normalizedValue) || normalizedValue.length !== expectedLength) {
        throw new BadRequestException({
          code: 'ARTICLE_GTIN_FORMAT_INVALID',
          message: `${type} must contain exactly ${expectedLength} digits`,
        });
      }
      if (!hasValidGtinCheckDigit(normalizedValue)) {
        throw new BadRequestException({
          code: 'ARTICLE_GTIN_CHECK_DIGIT_INVALID',
          message: `${type} has an invalid GS1 check digit`,
        });
      }
    }

    return {
      value,
      normalizedValue,
      globalIdentityKey: articleIdentifierGlobalKey(type, normalizedValue),
    };
  }

  private validateLifecycle(
    productStatus: ProductStatus,
    status: MasterDataStatus,
  ): void {
    if (
      status === MasterDataStatus.ACTIVE &&
      productStatus !== ProductStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'ARTICLE_IDENTIFIER_PRODUCT_NOT_ACTIVE',
        message:
          'Active GTIN/trade identifiers require an Active Manufacturer Article',
      });
    }
  }

  private async assertGlobalIdentityAvailable(
    globalIdentityKey: string | null,
    productId: string,
    excludeId?: string,
  ): Promise<void> {
    if (!globalIdentityKey) return;

    const duplicate = await this.database.articleIdentifier.findFirst({
      where: {
        globalIdentityKey,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, productId: true },
    });

    if (!duplicate) return;

    if (duplicate.productId === productId) {
      throw new ConflictException({
        code: 'ARTICLE_IDENTIFIER_ALREADY_EXISTS',
        message:
          'This Manufacturer Article already has the same GTIN identifier',
      });
    }

    throw new ConflictException({
      code: 'ARTICLE_GTIN_ALREADY_EXISTS',
      message: 'This GTIN already identifies another Manufacturer Article',
      articleId: duplicate.productId,
    });
  }

  private async requireProduct(productId: string): Promise<{
    id: string;
    status: ProductStatus;
  }> {
    const product = await this.database.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product was not found',
      });
    }
    return product;
  }

  private identifierNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ARTICLE_IDENTIFIER_NOT_FOUND',
      message: 'Article identifier was not found',
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: 'ARTICLE_IDENTIFIER_VERSION_CONFLICT',
      message: 'Article identifier changed; reload it before updating',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target.map(String)
        : typeof target === 'string'
          ? [target]
          : [];

      if (
        fields.some(
          (field) =>
            field.includes('global_identity_key') ||
            field.includes('globalIdentityKey'),
        )
      ) {
        throw new ConflictException({
          code: 'ARTICLE_GTIN_ALREADY_EXISTS',
          message: 'This GTIN already identifies another Manufacturer Article',
        });
      }

      throw new ConflictException({
        code: 'ARTICLE_IDENTIFIER_ALREADY_EXISTS',
        message:
          'This Manufacturer Article already has the same identifier type and normalized value',
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2025' || error.code === 'P2034')
    ) {
      throw this.versionConflict();
    }
    throw error;
  }
}
