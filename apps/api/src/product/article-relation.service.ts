import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArticleRelationType,
  MasterDataStatus,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import type {
  ArticleRelationAdminQueryDto,
  ArticleRelationPublicResponseDto,
  ArticleRelationResponseDto,
  CreateArticleRelationDto,
  UpdateArticleRelationDto,
} from './dto/article-relation.dto.js';

const articleRelationSelect = {
  id: true,
  sourceArticleId: true,
  targetArticleId: true,
  type: true,
  note: true,
  componentQuantity: true,
  componentRole: true,
  componentOrder: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleRelationSelect;

const articleRelationPublicSelect = {
  id: true,
  sourceArticleId: true,
  targetArticleId: true,
  type: true,
  componentQuantity: true,
  componentRole: true,
  componentOrder: true,
} satisfies Prisma.ArticleRelationSelect;

const activePeerRelationTypes: ArticleRelationType[] = [
  ArticleRelationType.INTERCHANGEABLE,
  ArticleRelationType.ACCESSORY,
  ArticleRelationType.REPAIR_KIT,
  ArticleRelationType.CONTAINS,
  ArticleRelationType.CONTAINED_IN,
  ArticleRelationType.PAIRED_WITH,
  ArticleRelationType.RELATED,
];

type ArticleRelationArticle = {
  id: string;
  brandId: string | null;
  productTypeId: string;
  status: ProductStatus;
};

@Injectable()
export class ArticleRelationService {
  constructor(private readonly database: DatabaseService) {}

  async listAdmin(
    articleId: string,
    query: ArticleRelationAdminQueryDto,
  ): Promise<ArticleRelationResponseDto[]> {
    await this.requireArticle(articleId, false);
    const rows = await this.database.articleRelation.findMany({
      where: {
        OR: [
          { sourceArticleId: articleId },
          { targetArticleId: articleId },
        ],
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: articleRelationSelect,
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async listPublished(
    articleId: string,
  ): Promise<ArticleRelationPublicResponseDto[]> {
    await this.requireArticle(articleId, true);
    const rows = await this.database.articleRelation.findMany({
      where: {
        status: MasterDataStatus.ACTIVE,
        OR: [
          { sourceArticleId: articleId },
          { targetArticleId: articleId },
        ],
        AND: [
          {
            OR: [
              {
                type: ArticleRelationType.SUPERSEDES,
                sourceArticle: { status: ProductStatus.ACTIVE },
                targetArticle: {
                  status: {
                    in: [ProductStatus.ACTIVE, ProductStatus.DEPRECATED],
                  },
                },
              },
              {
                type: { in: activePeerRelationTypes },
                sourceArticle: { status: ProductStatus.ACTIVE },
                targetArticle: { status: ProductStatus.ACTIVE },
              },
            ],
          },
        ],
      },
      select: articleRelationPublicSelect,
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toPublicResponse(row));
  }

  async create(
    sourceArticleId: string,
    input: CreateArticleRelationDto,
    actorId: string,
  ): Promise<ArticleRelationResponseDto> {
    if (sourceArticleId === input.targetArticleId) {
      throw new BadRequestException({
        code: 'ARTICLE_RELATION_SELF_NOT_ALLOWED',
        message: 'A Manufacturer Article cannot relate to itself',
      });
    }
    if (input.status === MasterDataStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'ARTICLE_RELATION_CREATE_ARCHIVED',
        message: 'Create the Article relation as Draft, Active or Inactive',
      });
    }

    try {
      return await this.database.$transaction(
        async (transaction) => {
          const [sourceArticle, targetArticle] = await Promise.all([
            this.requireArticleInTransaction(
              transaction,
              sourceArticleId,
            ),
            this.requireArticleInTransaction(
              transaction,
              input.targetArticleId,
            ),
          ]);

          const status = input.status ?? MasterDataStatus.DRAFT;
          const componentMetadata = this.normalizeComponentMetadata(
            input.type,
            {
              componentQuantity: input.componentQuantity ?? null,
              componentRole: input.componentRole ?? null,
              componentOrder: input.componentOrder ?? null,
            },
            status,
          );
          this.validateRelationSemantics(
            sourceArticle,
            targetArticle,
            input.type,
            status,
            componentMetadata,
          );
          const relationKey = this.relationKey(
            sourceArticle.id,
            targetArticle.id,
            input.type,
          );

          const duplicate = await transaction.articleRelation.findUnique({
            where: { relationKey },
            select: { id: true },
          });
          if (duplicate) throw this.relationAlreadyExists();

          if (input.type === ArticleRelationType.SUPERSEDES) {
            await this.assertNoSupersessionCycle(
              transaction,
              sourceArticle.id,
              targetArticle.id,
            );
          }
          if (this.isContainmentType(input.type)) {
            await this.assertNoContainmentCycle(
              transaction,
              sourceArticle.id,
              targetArticle.id,
              input.type,
            );
          }

          const relation = await transaction.articleRelation.create({
            data: {
              sourceArticleId: sourceArticle.id,
              targetArticleId: targetArticle.id,
              type: input.type,
              relationKey,
              note: input.note?.trim() || null,
              componentQuantity: componentMetadata.componentQuantity,
              componentRole: componentMetadata.componentRole,
              componentOrder: componentMetadata.componentOrder,
              status,
              createdById: actorId,
              updatedById: actorId,
            },
            select: articleRelationSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ARTICLE_RELATION_CREATED',
              entityType: 'ArticleRelation',
              entityId: relation.id,
              metadata: {
                sourceArticleId: relation.sourceArticleId,
                targetArticleId: relation.targetArticleId,
                after: this.relationSnapshot(relation),
              },
            },
          });

          return this.toResponse(relation);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    id: string,
    input: UpdateArticleRelationDto,
    actorId: string,
  ): Promise<ArticleRelationResponseDto> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const current = await transaction.articleRelation.findUnique({
            where: { id },
            select: {
              ...articleRelationSelect,
              sourceArticle: {
                select: {
                  id: true,
                  brandId: true,
                  productTypeId: true,
                  status: true,
                },
              },
              targetArticle: {
                select: {
                  id: true,
                  brandId: true,
                  productTypeId: true,
                  status: true,
                },
              },
            },
          });
          if (!current) throw this.relationNotFound();
          if (current.version !== input.version) {
            throw this.relationVersionConflict();
          }

          const nextStatus = input.status ?? current.status;
          const componentMetadata = this.normalizeComponentMetadata(
            current.type,
            {
              componentQuantity:
                input.componentQuantity !== undefined
                  ? input.componentQuantity
                  : current.componentQuantity === null
                    ? null
                    : Number(current.componentQuantity),
              componentRole:
                input.componentRole !== undefined
                  ? input.componentRole
                  : current.componentRole,
              componentOrder:
                input.componentOrder !== undefined
                  ? input.componentOrder
                  : current.componentOrder,
            },
            nextStatus,
          );
          if (nextStatus !== MasterDataStatus.ARCHIVED) {
            this.validateRelationSemantics(
              current.sourceArticle,
              current.targetArticle,
              current.type,
              nextStatus,
              componentMetadata,
            );
            if (current.type === ArticleRelationType.SUPERSEDES) {
              await this.assertNoSupersessionCycle(
                transaction,
                current.sourceArticleId,
                current.targetArticleId,
                current.id,
              );
            }
            if (this.isContainmentType(current.type)) {
              await this.assertNoContainmentCycle(
                transaction,
                current.sourceArticleId,
                current.targetArticleId,
                current.type,
                current.id,
              );
            }
          }

          const relation = await transaction.articleRelation.update({
            where: { id, version: input.version },
            data: {
              ...(input.note !== undefined
                ? { note: input.note?.trim() || null }
                : {}),
              ...(input.componentQuantity !== undefined
                ? { componentQuantity: componentMetadata.componentQuantity }
                : {}),
              ...(input.componentRole !== undefined
                ? { componentRole: componentMetadata.componentRole }
                : {}),
              ...(input.componentOrder !== undefined
                ? { componentOrder: componentMetadata.componentOrder }
                : {}),
              ...(input.status !== undefined
                ? { status: input.status }
                : {}),
              version: { increment: 1 },
              updatedById: actorId,
            },
            select: articleRelationSelect,
          });

          await transaction.auditLog.create({
            data: {
              actorId,
              action: 'ARTICLE_RELATION_UPDATED',
              entityType: 'ArticleRelation',
              entityId: relation.id,
              metadata: {
                sourceArticleId: relation.sourceArticleId,
                targetArticleId: relation.targetArticleId,
                before: this.relationSnapshot(current),
                after: this.relationSnapshot(relation),
              },
            },
          });

          return this.toResponse(relation);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  private relationSnapshot(value: {
    id: string;
    sourceArticleId: string;
    targetArticleId: string;
    type: ArticleRelationType;
    note: string | null;
    componentQuantity: Prisma.Decimal | number | null;
    componentRole: string | null;
    componentOrder: number | null;
    status: MasterDataStatus;
    version: number;
  }): Prisma.InputJsonObject {
    return {
      id: value.id,
      sourceArticleId: value.sourceArticleId,
      targetArticleId: value.targetArticleId,
      type: value.type,
      note: value.note,
      componentQuantity:
        value.componentQuantity === null
          ? null
          : Number(value.componentQuantity),
      componentRole: value.componentRole,
      componentOrder: value.componentOrder,
      status: value.status,
      version: value.version,
    };
  }

  private validateRelationSemantics(
    source: ArticleRelationArticle,
    target: ArticleRelationArticle,
    type: ArticleRelationType,
    status: MasterDataStatus,
    componentMetadata: {
      componentQuantity: number | null;
      componentRole: string | null;
      componentOrder: number | null;
    },
  ): void {
    if (
      source.status === ProductStatus.ARCHIVED ||
      target.status === ProductStatus.ARCHIVED
    ) {
      throw new ConflictException({
        code: 'ARTICLE_RELATION_ARTICLE_ARCHIVED',
        message: 'Archived Manufacturer Articles cannot receive new live relations',
      });
    }

    if (status === MasterDataStatus.ACTIVE) {
      if (type === ArticleRelationType.SUPERSEDES) {
        if (
          source.status !== ProductStatus.ACTIVE ||
          (target.status !== ProductStatus.ACTIVE &&
            target.status !== ProductStatus.DEPRECATED)
        ) {
          throw new ConflictException({
            code: 'ARTICLE_SUPERSESSION_LIFECYCLE_INVALID',
            message:
              'An Active supersession requires an Active replacement Article and an Active or Deprecated superseded Article',
          });
        }
      } else if (
        source.status !== ProductStatus.ACTIVE ||
        target.status !== ProductStatus.ACTIVE
      ) {
        throw new ConflictException({
          code: 'ARTICLE_RELATION_ARTICLE_NOT_ACTIVE',
          message:
            'Active non-supersession Article relations require both Manufacturer Articles to be Active',
        });
      }
    }

    if (type === ArticleRelationType.SUPERSEDES) {
      if (
        !source.brandId ||
        !target.brandId ||
        source.brandId !== target.brandId
      ) {
        throw new ConflictException({
          code: 'ARTICLE_SUPERSESSION_BRAND_MISMATCH',
          message:
            'A superseding Article must use the same Manufacturer Brand as the superseded Article',
        });
      }
      if (source.productTypeId !== target.productTypeId) {
        throw new ConflictException({
          code: 'ARTICLE_SUPERSESSION_PRODUCT_TYPE_MISMATCH',
          message:
            'A superseding Article must use the same Product Type as the superseded Article',
        });
      }
    }

    if (
      type === ArticleRelationType.INTERCHANGEABLE &&
      source.productTypeId !== target.productTypeId
    ) {
      throw new ConflictException({
        code: 'ARTICLE_INTERCHANGE_PRODUCT_TYPE_MISMATCH',
        message:
          'Interchangeable Articles must use the same Product Type',
      });
    }

    if (
      this.isContainmentType(type) &&
      status === MasterDataStatus.ACTIVE &&
      componentMetadata.componentQuantity === null
    ) {
      throw new ConflictException({
        code: 'ARTICLE_COMPONENT_QUANTITY_REQUIRED',
        message:
          'Active kit/component relations require a positive component quantity',
      });
    }
  }

  private async assertNoSupersessionCycle(
    transaction: Prisma.TransactionClient,
    sourceArticleId: string,
    targetArticleId: string,
    excludeRelationId?: string,
  ): Promise<void> {
    const visited = new Set<string>();
    let frontier = [targetArticleId];

    while (frontier.length > 0) {
      const pending = frontier.filter((articleId) => !visited.has(articleId));
      if (pending.length === 0) return;
      for (const articleId of pending) visited.add(articleId);

      const edges = await transaction.articleRelation.findMany({
        where: {
          type: ArticleRelationType.SUPERSEDES,
          status: { not: MasterDataStatus.ARCHIVED },
          sourceArticleId: { in: pending },
          ...(excludeRelationId
            ? { id: { not: excludeRelationId } }
            : {}),
        },
        select: { targetArticleId: true },
      });

      if (
        edges.some((edge) => edge.targetArticleId === sourceArticleId)
      ) {
        throw new ConflictException({
          code: 'ARTICLE_SUPERSESSION_CYCLE',
          message:
            'This supersession would create a circular Manufacturer Article replacement chain',
        });
      }

      frontier = edges.map((edge) => edge.targetArticleId);
    }
  }

  private normalizeComponentMetadata(
    type: ArticleRelationType,
    input: {
      componentQuantity: number | null;
      componentRole: string | null;
      componentOrder: number | null;
    },
    status: MasterDataStatus,
  ): {
    componentQuantity: number | null;
    componentRole: string | null;
    componentOrder: number | null;
  } {
    const componentQuantity = input.componentQuantity;
    const componentRole = input.componentRole?.trim() || null;
    const componentOrder = input.componentOrder;

    if (
      componentQuantity !== null &&
      (!Number.isFinite(componentQuantity) ||
        componentQuantity <= 0 ||
        componentQuantity > 9999999.999)
    ) {
      throw new BadRequestException({
        code: 'ARTICLE_COMPONENT_QUANTITY_INVALID',
        message:
          'Component quantity must be a positive number not greater than 9999999.999',
      });
    }
    if (
      componentOrder !== null &&
      (!Number.isInteger(componentOrder) ||
        componentOrder < 0 ||
        componentOrder > 10000)
    ) {
      throw new BadRequestException({
        code: 'ARTICLE_COMPONENT_ORDER_INVALID',
        message: 'Component order must be an integer from 0 to 10000',
      });
    }

    if (
      !this.isContainmentType(type) &&
      (componentQuantity !== null ||
        componentRole !== null ||
        componentOrder !== null)
    ) {
      throw new BadRequestException({
        code: 'ARTICLE_RELATION_COMPONENT_METADATA_NOT_ALLOWED',
        message:
          'Component quantity, role and order are valid only for CONTAINS / CONTAINED_IN relations',
      });
    }

    if (
      this.isContainmentType(type) &&
      status === MasterDataStatus.ACTIVE &&
      componentQuantity === null
    ) {
      throw new ConflictException({
        code: 'ARTICLE_COMPONENT_QUANTITY_REQUIRED',
        message:
          'Active kit/component relations require a positive component quantity',
      });
    }

    return {
      componentQuantity,
      componentRole,
      componentOrder,
    };
  }

  private isContainmentType(type: ArticleRelationType): boolean {
    return (
      type === ArticleRelationType.CONTAINS ||
      type === ArticleRelationType.CONTAINED_IN
    );
  }

  private containmentDirection(
    sourceArticleId: string,
    targetArticleId: string,
    type: ArticleRelationType,
  ): { containerArticleId: string; componentArticleId: string } {
    return type === ArticleRelationType.CONTAINS
      ? {
          containerArticleId: sourceArticleId,
          componentArticleId: targetArticleId,
        }
      : {
          containerArticleId: targetArticleId,
          componentArticleId: sourceArticleId,
        };
  }

  private async assertNoContainmentCycle(
    transaction: Prisma.TransactionClient,
    sourceArticleId: string,
    targetArticleId: string,
    type: ArticleRelationType,
    excludeRelationId?: string,
  ): Promise<void> {
    const { containerArticleId, componentArticleId } =
      this.containmentDirection(sourceArticleId, targetArticleId, type);
    const visited = new Set<string>();
    let frontier = [componentArticleId];

    while (frontier.length > 0) {
      const pending = frontier.filter((articleId) => !visited.has(articleId));
      if (pending.length === 0) return;
      for (const articleId of pending) visited.add(articleId);

      const edges = await transaction.articleRelation.findMany({
        where: {
          status: { not: MasterDataStatus.ARCHIVED },
          ...(excludeRelationId ? { id: { not: excludeRelationId } } : {}),
          OR: [
            {
              type: ArticleRelationType.CONTAINS,
              sourceArticleId: { in: pending },
            },
            {
              type: ArticleRelationType.CONTAINED_IN,
              targetArticleId: { in: pending },
            },
          ],
        },
        select: {
          sourceArticleId: true,
          targetArticleId: true,
          type: true,
        },
      });

      const children = edges.map((edge) =>
        edge.type === ArticleRelationType.CONTAINS
          ? edge.targetArticleId
          : edge.sourceArticleId,
      );

      if (children.includes(containerArticleId)) {
        throw new ConflictException({
          code: 'ARTICLE_CONTAINMENT_CYCLE',
          message:
            'This kit/component relation would create a circular Article containment graph',
        });
      }

      frontier = children;
    }
  }

  private relationKey(
    sourceArticleId: string,
    targetArticleId: string,
    type: ArticleRelationType,
  ): string {
    if (
      type === ArticleRelationType.SUPERSEDES ||
      type === ArticleRelationType.ACCESSORY ||
      type === ArticleRelationType.REPAIR_KIT
    ) {
      return `${type}:${sourceArticleId}:${targetArticleId}`;
    }

    if (type === ArticleRelationType.CONTAINS) {
      return `CONTAINS:${sourceArticleId}:${targetArticleId}`;
    }
    if (type === ArticleRelationType.CONTAINED_IN) {
      return `CONTAINS:${targetArticleId}:${sourceArticleId}`;
    }

    const [first, second] = [sourceArticleId, targetArticleId].sort();
    return `${type}:${first}:${second}`;
  }

  private async requireArticle(
    id: string,
    publicOnly: boolean,
  ): Promise<ArticleRelationArticle> {
    const article = await this.database.product.findFirst({
      where: {
        id,
        ...(publicOnly
          ? {
              status: {
                in: [ProductStatus.ACTIVE, ProductStatus.DEPRECATED],
              },
            }
          : {}),
      },
      select: {
        id: true,
        brandId: true,
        productTypeId: true,
        status: true,
      },
    });
    if (!article) throw this.articleNotFound(publicOnly);
    return article;
  }

  private async requireArticleInTransaction(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<ArticleRelationArticle> {
    const article = await transaction.product.findUnique({
      where: { id },
      select: {
        id: true,
        brandId: true,
        productTypeId: true,
        status: true,
      },
    });
    if (!article) throw this.articleNotFound(false);
    return article;
  }

  private toResponse(
    row: Prisma.ArticleRelationGetPayload<{
      select: typeof articleRelationSelect;
    }>,
  ): ArticleRelationResponseDto {
    return {
      ...row,
      componentQuantity:
        row.componentQuantity === null ? null : Number(row.componentQuantity),
    };
  }

  private toPublicResponse(
    row: Prisma.ArticleRelationGetPayload<{
      select: typeof articleRelationPublicSelect;
    }>,
  ): ArticleRelationPublicResponseDto {
    return {
      ...row,
      componentQuantity:
        row.componentQuantity === null ? null : Number(row.componentQuantity),
    };
  }

  private articleNotFound(publicOnly: boolean): NotFoundException {
    return new NotFoundException({
      code: publicOnly ? 'PUBLIC_ARTICLE_NOT_FOUND' : 'ARTICLE_NOT_FOUND',
      message: publicOnly
        ? 'Active or Deprecated Manufacturer Article was not found'
        : 'Manufacturer Article was not found',
    });
  }

  private relationAlreadyExists(): ConflictException {
    return new ConflictException({
      code: 'ARTICLE_RELATION_ALREADY_EXISTS',
      message: 'This Manufacturer Article relation already exists',
    });
  }

  private relationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'ARTICLE_RELATION_NOT_FOUND',
      message: 'Manufacturer Article relation was not found',
    });
  }

  private relationVersionConflict(): ConflictException {
    return new ConflictException({
      code: 'ARTICLE_RELATION_VERSION_CONFLICT',
      message: 'The Article relation changed; reload it before updating',
    });
  }

  private rethrowPersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw this.relationAlreadyExists();
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw this.relationVersionConflict();
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException({
        code: 'ARTICLE_RELATION_CONCURRENCY_CONFLICT',
        message:
          'The Article relation graph changed concurrently; reload and retry the relation change',
      });
    }
    throw error;
  }
}
