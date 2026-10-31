import { Injectable } from '@nestjs/common';
import {
  ArticleSource,
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service.js';
import { normalizePartNumber } from './article-identity.js';
import {
  AdminReferenceIntegrityFilter,
  type AdminOeCollisionGroupDto,
  type AdminOeCollisionPageDto,
  type AdminOeCollisionPageQueryDto,
  type AdminOeReferenceSummaryDto,
  type AdminReferenceArticleSummaryDto,
  type AdminReferencePageDto,
  type AdminReferenceRecordDto,
  type AdminReferenceSearchQueryDto,
} from './dto/admin-oe-reference-review.dto.js';

type CollisionCountRow = { count: number };

type CollisionRow = {
  issuer_brand_id: string | null;
  issuer_brand_code: string | null;
  issuer_brand_name: string | null;
  normalized_part_number: string;
  display_part_number: string;
  article_brand_id: string | null;
  article_brand_code: string | null;
  article_brand_name: string | null;
  product_type_id: string;
  product_type_code: string;
  product_type_name: string;
  article_count: number;
  active_article_count: number;
  draft_article_count: number;
  sample_article_ids: string[];
};

const liveReferenceStatuses = [
  MasterDataStatus.DRAFT,
  MasterDataStatus.ACTIVE,
];

const liveArticleStatuses = [
  ProductStatus.DRAFT,
  ProductStatus.ACTIVE,
];

const referenceSelect = {
  id: true,
  type: true,
  partNumber: true,
  rawPartNumber: true,
  normalizedPartNumber: true,
  isPrimary: true,
  status: true,
  version: true,
  updatedAt: true,
  issuerBrand: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      status: true,
      articleSource: true,
      catalogReviewSubmittedAt: true,
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
      sourceSeller: {
        select: {
          id: true,
          sellerCode: true,
          displayName: true,
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
      _count: {
        select: {
          outgoingArticleRelations: true,
          incomingArticleRelations: true,
        },
      },
    },
  },
} satisfies Prisma.PartNumberSelect;

type ReferenceRecord = Prisma.PartNumberGetPayload<{
  select: typeof referenceSelect;
}>;

const collisionSampleArticleSelect = {
  id: true,
  name: true,
  status: true,
  articleSource: true,
  catalogReviewSubmittedAt: true,
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
  sourceSeller: {
    select: {
      id: true,
      sellerCode: true,
      displayName: true,
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
  _count: {
    select: {
      outgoingArticleRelations: true,
      incomingArticleRelations: true,
    },
  },
} satisfies Prisma.ProductSelect;

type CollisionSampleArticle = Prisma.ProductGetPayload<{
  select: typeof collisionSampleArticleSelect;
}>;

@Injectable()
export class AdminOeReferenceReviewService {
  constructor(private readonly database: DatabaseService) {}

  async summary(): Promise<AdminOeReferenceSummaryDto> {
    const [liveOeReferences, liveCrossReferences, collisionGroups, oeWithoutIssuerBrand] =
      await Promise.all([
        this.database.partNumber.count({
          where: {
            type: PartNumberType.OE,
            status: { in: liveReferenceStatuses },
            product: { status: { in: liveArticleStatuses } },
          },
        }),
        this.database.partNumber.count({
          where: {
            type: PartNumberType.CROSS_REFERENCE,
            status: { in: liveReferenceStatuses },
            product: { status: { in: liveArticleStatuses } },
          },
        }),
        this.countCollisionGroups(),
        this.database.partNumber.count({
          where: {
            type: PartNumberType.OE,
            issuerBrandId: null,
            status: { in: liveReferenceStatuses },
            product: { status: { in: liveArticleStatuses } },
          },
        }),
      ]);

    return {
      liveOeReferences,
      liveCrossReferences,
      collisionGroups,
      oeWithoutIssuerBrand,
    };
  }

  async listCollisions(
    query: AdminOeCollisionPageQueryDto,
  ): Promise<AdminOeCollisionPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const normalizedSearch = normalizePartNumber(query.search?.trim() ?? '');
    const searchClause =
      normalizedSearch.length > 0
        ? Prisma.sql`AND pn."normalized_part_number" LIKE ${`%${normalizedSearch}%`}`
        : Prisma.empty;

    const [countRows, rows] = await Promise.all([
      this.database.$queryRaw<CollisionCountRow[]>(
        Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM (
            SELECT
              pn."brand_id",
              pn."normalized_part_number",
              p."brand_id",
              p."product_type_id"
            FROM "part_numbers" pn
            JOIN "products" p ON p."id" = pn."product_id"
            WHERE pn."part_number_type" = 'OE'
              AND pn."status" IN ('DRAFT', 'ACTIVE')
              AND p."status" IN ('DRAFT', 'ACTIVE')
              ${searchClause}
            GROUP BY
              pn."brand_id",
              pn."normalized_part_number",
              p."brand_id",
              p."product_type_id"
            HAVING COUNT(DISTINCT p."id") > 1
          ) collisions
        `,
      ),
      this.database.$queryRaw<CollisionRow[]>(
        Prisma.sql`
          SELECT
            pn."brand_id"::text AS "issuer_brand_id",
            issuer."code" AS "issuer_brand_code",
            issuer."name" AS "issuer_brand_name",
            pn."normalized_part_number",
            MIN(pn."part_number") AS "display_part_number",
            p."brand_id"::text AS "article_brand_id",
            article_brand."code" AS "article_brand_code",
            article_brand."name" AS "article_brand_name",
            p."product_type_id"::text AS "product_type_id",
            pt."code" AS "product_type_code",
            pt."name" AS "product_type_name",
            COUNT(DISTINCT p."id")::int AS "article_count",
            COUNT(DISTINCT p."id") FILTER (WHERE p."status" = 'ACTIVE')::int AS "active_article_count",
            COUNT(DISTINCT p."id") FILTER (WHERE p."status" = 'DRAFT')::int AS "draft_article_count",
            (ARRAY_AGG(DISTINCT p."id"::text ORDER BY p."id"::text))[1:5] AS "sample_article_ids"
          FROM "part_numbers" pn
          JOIN "products" p ON p."id" = pn."product_id"
          JOIN "product_types" pt ON pt."id" = p."product_type_id"
          LEFT JOIN "brands" issuer ON issuer."id" = pn."brand_id"
          LEFT JOIN "brands" article_brand ON article_brand."id" = p."brand_id"
          WHERE pn."part_number_type" = 'OE'
            AND pn."status" IN ('DRAFT', 'ACTIVE')
            AND p."status" IN ('DRAFT', 'ACTIVE')
            ${searchClause}
          GROUP BY
            pn."brand_id",
            issuer."code",
            issuer."name",
            pn."normalized_part_number",
            p."brand_id",
            article_brand."code",
            article_brand."name",
            p."product_type_id",
            pt."code",
            pt."name"
          HAVING COUNT(DISTINCT p."id") > 1
          ORDER BY
            COUNT(DISTINCT p."id") DESC,
            pn."normalized_part_number" ASC,
            pt."name" ASC
          LIMIT ${pageSize}
          OFFSET ${(page - 1) * pageSize}
        `,
      ),
    ]);

    const articleIds = [...new Set(rows.flatMap((row) => row.sample_article_ids))];
    const articleRecords =
      articleIds.length === 0
        ? []
        : await this.database.product.findMany({
            where: { id: { in: articleIds } },
            select: collisionSampleArticleSelect,
          });
    const articleById = new Map(
      articleRecords.map((article) => [article.id, article]),
    );

    const items: AdminOeCollisionGroupDto[] = rows.map((row) => ({
      groupKey: this.collisionGroupKey(row),
      normalizedPartNumber: row.normalized_part_number,
      displayPartNumber: row.display_part_number,
      issuerBrand:
        row.issuer_brand_id && row.issuer_brand_code && row.issuer_brand_name
          ? {
              id: row.issuer_brand_id,
              code: row.issuer_brand_code,
              name: row.issuer_brand_name,
            }
          : null,
      articleBrand:
        row.article_brand_id &&
        row.article_brand_code &&
        row.article_brand_name
          ? {
              id: row.article_brand_id,
              code: row.article_brand_code,
              name: row.article_brand_name,
            }
          : null,
      productType: {
        id: row.product_type_id,
        code: row.product_type_code,
        name: row.product_type_name,
      },
      articleCount: row.article_count,
      activeArticleCount: row.active_article_count,
      draftArticleCount: row.draft_article_count,
      sampleArticles: row.sample_article_ids
        .map((id) => articleById.get(id))
        .filter(
          (article): article is CollisionSampleArticle =>
            article !== undefined,
        )
        .map((article) => this.articleSummary(article)),
    }));

    const total = countRows[0]?.count ?? 0;
    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async searchReferences(
    query: AdminReferenceSearchQueryDto,
  ): Promise<AdminReferencePageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();
    const normalizedSearch = normalizePartNumber(search ?? '');
    const filters: Prisma.PartNumberWhereInput[] = [];

    if (query.type) filters.push({ type: query.type });
    if (query.issuerBrandId) {
      filters.push({ issuerBrandId: query.issuerBrandId });
    }
    if (query.referenceStatus) {
      filters.push({ status: query.referenceStatus });
    } else {
      filters.push({ status: { not: MasterDataStatus.ARCHIVED } });
    }
    if (query.articleStatus) {
      filters.push({ product: { status: query.articleStatus } });
    } else {
      filters.push({ product: { status: { not: ProductStatus.ARCHIVED } } });
    }
    if (
      query.integrity === AdminReferenceIntegrityFilter.OE_MISSING_ISSUER
    ) {
      filters.push({
        type: PartNumberType.OE,
        issuerBrandId: null,
      });
    }

    if (search) {
      const searchConditions: Prisma.PartNumberWhereInput[] = [
        { partNumber: { contains: search, mode: 'insensitive' } },
        { rawPartNumber: { contains: search, mode: 'insensitive' } },
        {
          issuerBrand: {
            is: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          product: {
            is: {
              OR: [
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
              ],
            },
          },
        },
      ];
      if (normalizedSearch.length > 0) {
        searchConditions.unshift({
          normalizedPartNumber: { contains: normalizedSearch },
        });
      }
      filters.push({ OR: searchConditions });
    }

    const where: Prisma.PartNumberWhereInput =
      filters.length === 0 ? {} : { AND: filters };

    const [total, records] = await Promise.all([
      this.database.partNumber.count({ where }),
      this.database.partNumber.findMany({
        where,
        select: referenceSelect,
        orderBy: [
          { updatedAt: 'desc' },
          { normalizedPartNumber: 'asc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: records.map((record) => this.referenceRecord(record)),
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private referenceRecord(record: ReferenceRecord): AdminReferenceRecordDto {
    return {
      id: record.id,
      type: record.type,
      partNumber: record.partNumber,
      rawPartNumber: record.rawPartNumber,
      normalizedPartNumber: record.normalizedPartNumber,
      isPrimary: record.isPrimary,
      status: record.status,
      version: record.version,
      issuerBrand: record.issuerBrand,
      article: this.articleSummary(record.product),
      updatedAt: record.updatedAt,
    };
  }

  private articleSummary(
    article: CollisionSampleArticle | ReferenceRecord['product'],
  ): AdminReferenceArticleSummaryDto {
    return {
      id: article.id,
      name: article.name,
      status: article.status,
      articleSource: article.articleSource,
      brand: article.brand,
      productType: article.productType,
      manufacturerPartNumber:
        article.partNumbers[0]?.partNumber ?? null,
      sourceSeller: article.sourceSeller,
      relationCount:
        article._count.outgoingArticleRelations +
        article._count.incomingArticleRelations,
      awaitingReview:
        article.articleSource === ArticleSource.SELLER_SUBMISSION &&
        article.status === ProductStatus.DRAFT &&
        article.catalogReviewSubmittedAt !== null,
    };
  }

  private async countCollisionGroups(): Promise<number> {
    const rows = await this.database.$queryRaw<CollisionCountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM (
          SELECT
            pn."brand_id",
            pn."normalized_part_number",
            p."brand_id",
            p."product_type_id"
          FROM "part_numbers" pn
          JOIN "products" p ON p."id" = pn."product_id"
          WHERE pn."part_number_type" = 'OE'
            AND pn."status" IN ('DRAFT', 'ACTIVE')
            AND p."status" IN ('DRAFT', 'ACTIVE')
          GROUP BY
            pn."brand_id",
            pn."normalized_part_number",
            p."brand_id",
            p."product_type_id"
          HAVING COUNT(DISTINCT p."id") > 1
        ) collisions
      `,
    );
    return rows[0]?.count ?? 0;
  }

  private collisionGroupKey(row: CollisionRow): string {
    return [
      row.issuer_brand_id ?? 'NO_ISSUER',
      row.normalized_part_number,
      row.article_brand_id ?? 'NO_ARTICLE_BRAND',
      row.product_type_id,
    ].join(':');
  }
}
