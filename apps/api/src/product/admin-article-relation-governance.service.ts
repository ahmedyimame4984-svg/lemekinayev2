import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ArticleRelationType,
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { normalizePartNumber } from './article-identity.js';
import { ArticleRelationService } from './article-relation.service.js';
import type { ArticleRelationResponseDto } from './dto/article-relation.dto.js';
import {
  type AdminArticleRelationArticleDto,
  type AdminArticleRelationCandidatePageDto,
  type AdminArticleRelationCandidateQueryDto,
  type AdminArticleRelationPageDto,
  type AdminArticleRelationPageQueryDto,
  type AdminArticleRelationRowDto,
  type AdminArticleRelationSummaryDto,
  type AdminCreateArticleRelationDto,
  type AdminUpdateArticleRelationDto,
} from './dto/admin-article-relation-governance.dto.js';

const articleSummarySelect = {
  id: true,
  name: true,
  status: true,
  articleSource: true,
  brand: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  productType: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  partNumbers: {
    where: {
      type: PartNumberType.MANUFACTURER,
      status: { not: MasterDataStatus.ARCHIVED },
    },
    select: { partNumber: true },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const relationSelect = {
  id: true,
  type: true,
  status: true,
  version: true,
  note: true,
  componentQuantity: true,
  componentRole: true,
  componentOrder: true,
  createdAt: true,
  updatedAt: true,
  sourceArticle: { select: articleSummarySelect },
  targetArticle: { select: articleSummarySelect },
} satisfies Prisma.ArticleRelationSelect;

type ArticleSummaryRecord = Prisma.ProductGetPayload<{
  select: typeof articleSummarySelect;
}>;

type RelationRecord = Prisma.ArticleRelationGetPayload<{
  select: typeof relationSelect;
}>;

@Injectable()
export class AdminArticleRelationGovernanceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly relations: ArticleRelationService,
  ) {}

  async summary(): Promise<AdminArticleRelationSummaryDto> {
    const [
      liveRelations,
      supersessionRelations,
      activeSupersessions,
      draftRelations,
      componentRelations,
    ] = await Promise.all([
      this.database.articleRelation.count({
        where: { status: { not: MasterDataStatus.ARCHIVED } },
      }),
      this.database.articleRelation.count({
        where: {
          type: ArticleRelationType.SUPERSEDES,
          status: { not: MasterDataStatus.ARCHIVED },
        },
      }),
      this.database.articleRelation.count({
        where: {
          type: ArticleRelationType.SUPERSEDES,
          status: MasterDataStatus.ACTIVE,
        },
      }),
      this.database.articleRelation.count({
        where: { status: MasterDataStatus.DRAFT },
      }),
      this.database.articleRelation.count({
        where: {
          type: {
            in: [
              ArticleRelationType.CONTAINS,
              ArticleRelationType.CONTAINED_IN,
            ],
          },
          status: { not: MasterDataStatus.ARCHIVED },
        },
      }),
    ]);

    return {
      liveRelations,
      supersessionRelations,
      activeSupersessions,
      draftRelations,
      componentRelations,
    };
  }

  async list(
    query: AdminArticleRelationPageQueryDto,
  ): Promise<AdminArticleRelationPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filters: Prisma.ArticleRelationWhereInput[] = [];

    if (query.type) filters.push({ type: query.type });
    if (query.status) {
      filters.push({ status: query.status });
    } else {
      filters.push({ status: { not: MasterDataStatus.ARCHIVED } });
    }
    if (query.articleId) {
      filters.push({
        OR: [
          { sourceArticleId: query.articleId },
          { targetArticleId: query.articleId },
        ],
      });
    }

    const search = query.search?.trim();
    if (search) {
      const normalized = normalizePartNumber(search);
      const articleSearch = this.articleSearchConditions(search, normalized);
      const relationSearch: Prisma.ArticleRelationWhereInput[] = [
        { note: { contains: search, mode: 'insensitive' } },
        { componentRole: { contains: search, mode: 'insensitive' } },
        { sourceArticle: { is: { OR: articleSearch } } },
        { targetArticle: { is: { OR: articleSearch } } },
      ];
      if (this.isUuid(search)) {
        relationSearch.unshift(
          { id: search },
          { sourceArticleId: search },
          { targetArticleId: search },
        );
      }
      filters.push({ OR: relationSearch });
    }

    const where: Prisma.ArticleRelationWhereInput =
      filters.length === 0 ? {} : { AND: filters };

    const [total, records] = await Promise.all([
      this.database.articleRelation.count({ where }),
      this.database.articleRelation.findMany({
        where,
        select: relationSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.relationRow(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async candidates(
    query: AdminArticleRelationCandidateQueryDto,
  ): Promise<AdminArticleRelationCandidatePageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filters: Prisma.ProductWhereInput[] = [
      { status: { not: ProductStatus.ARCHIVED } },
    ];

    if (query.sourceArticleId) {
      const source = await this.database.product.findUnique({
        where: { id: query.sourceArticleId },
        select: {
          id: true,
          brandId: true,
          productTypeId: true,
        },
      });
      if (!source) {
        throw new NotFoundException({
          code: 'ARTICLE_RELATION_SOURCE_NOT_FOUND',
          message: 'The source Manufacturer Article was not found.',
        });
      }

      filters.push({ id: { not: source.id } });

      if (query.type === ArticleRelationType.SUPERSEDES) {
        if (!source.brandId) {
          return {
            items: [],
            total: 0,
            page,
            pageSize,
            pageCount: 0,
          };
        }
        filters.push({
          brandId: source.brandId,
          productTypeId: source.productTypeId,
        });
      } else if (query.type === ArticleRelationType.INTERCHANGEABLE) {
        filters.push({ productTypeId: source.productTypeId });
      }
    }

    const search = query.search?.trim();
    if (search) {
      const normalized = normalizePartNumber(search);
      const searchConditions = this.articleSearchConditions(search, normalized);
      if (this.isUuid(search)) searchConditions.unshift({ id: search });
      filters.push({ OR: searchConditions });
    }

    const where: Prisma.ProductWhereInput = { AND: filters };
    const [total, records] = await Promise.all([
      this.database.product.count({ where }),
      this.database.product.findMany({
        where,
        select: articleSummarySelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.articleSummary(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  create(
    input: AdminCreateArticleRelationDto,
    actorId: string,
  ): Promise<ArticleRelationResponseDto> {
    const {
      sourceArticleId,
      targetArticleId,
      type,
      note,
      componentQuantity,
      componentRole,
      componentOrder,
      status,
    } = input;

    return this.relations.create(
      sourceArticleId,
      {
        targetArticleId,
        type,
        ...(note !== undefined ? { note } : {}),
        ...(componentQuantity !== undefined ? { componentQuantity } : {}),
        ...(componentRole !== undefined ? { componentRole } : {}),
        ...(componentOrder !== undefined ? { componentOrder } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      actorId,
    );
  }

  update(
    relationId: string,
    input: AdminUpdateArticleRelationDto,
    actorId: string,
  ): Promise<ArticleRelationResponseDto> {
    return this.relations.update(relationId, input, actorId);
  }

  private relationRow(record: RelationRecord): AdminArticleRelationRowDto {
    return {
      id: record.id,
      type: record.type,
      status: record.status,
      version: record.version,
      note: record.note,
      componentQuantity:
        record.componentQuantity === null
          ? null
          : Number(record.componentQuantity),
      componentRole: record.componentRole,
      componentOrder: record.componentOrder,
      sourceArticle: this.articleSummary(record.sourceArticle),
      targetArticle: this.articleSummary(record.targetArticle),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private articleSummary(
    record: ArticleSummaryRecord,
  ): AdminArticleRelationArticleDto {
    return {
      id: record.id,
      name: record.name,
      status: record.status,
      articleSource: record.articleSource,
      brand: record.brand,
      productType: record.productType,
      manufacturerPartNumber: record.partNumbers[0]?.partNumber ?? null,
    };
  }

  private articleSearchConditions(
    search: string,
    normalized: string,
  ): Prisma.ProductWhereInput[] {
    const conditions: Prisma.ProductWhereInput[] = [
      { name: { contains: search, mode: 'insensitive' } },
      {
        brand: {
          is: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        productType: {
          is: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        partNumbers: {
          some: {
            OR: [
              { partNumber: { contains: search, mode: 'insensitive' } },
              { rawPartNumber: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];

    if (normalized.length > 0) {
      conditions.push({
        partNumbers: {
          some: {
            normalizedPartNumber: { contains: normalized },
          },
        },
      });
    }

    return conditions;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
