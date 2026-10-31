import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ArticleSource,
  MasterDataStatus,
  PartNumberType,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import { DatabaseService } from '../database/database.service.js';
import { ArticleValidationService } from './article-validation.service.js';
import {
  AdminArticleReviewSortBy,
  AdminArticleReviewState,
  type AdminArticleReviewApproveDto,
  type AdminArticleReviewDecisionResultDto,
  type AdminArticleReviewItemDto,
  type AdminArticleReviewPageDto,
  type AdminArticleReviewPageQueryDto,
  type AdminArticleReviewReturnDto,
} from './dto/admin-article-review.dto.js';
import { ProductService } from './product.service.js';
import { submitWaitingListingsAfterArticleApproval } from '../marketplace/seller-listing-review-intent.js';

const reviewArticleSelect = {
  id: true,
  name: true,
  articleSource: true,
  status: true,
  version: true,
  catalogReviewSubmittedAt: true,
  publishedAt: true,
  updatedAt: true,
  brand: {
    select: {
      id: true,
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
  schemaVersion: {
    select: {
      schemaVersion: true,
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
    select: {
      partNumber: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

type ReviewArticleRecord = Prisma.ProductGetPayload<{
  select: typeof reviewArticleSelect;
}>;

@Injectable()
export class AdminArticleReviewService {
  private readonly logger = new Logger(AdminArticleReviewService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly validation: ArticleValidationService,
    private readonly products: ProductService,
  ) {}

  async list(
    query: AdminArticleReviewPageQueryDto,
  ): Promise<AdminArticleReviewPageDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.reviewWhere(query);
    const orderBy = this.reviewOrderBy(query);

    const [total, records] = await Promise.all([
      this.database.product.count({ where }),
      this.database.product.findMany({
        where,
        select: reviewArticleSelect,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: AdminArticleReviewItemDto[] = [];
    for (let start = 0; start < records.length; start += 5) {
      const batch = records.slice(start, start + 5);
      const resolved = await Promise.all(
        batch.map(async (record) => {
          const validation = await this.validation.validate(record.id);
          const reviewState = this.reviewState(record);
          const submittedSellerDraft =
            record.articleSource === ArticleSource.SELLER_SUBMISSION &&
            record.status === ProductStatus.DRAFT &&
            record.catalogReviewSubmittedAt !== null;

          return {
            id: record.id,
            name: record.name,
            manufacturerPartNumber:
              record.partNumbers[0]?.partNumber ?? null,
            brand: record.brand,
            productType: record.productType,
            articleSource: record.articleSource,
            sourceSeller: record.sourceSeller,
            status: record.status,
            reviewState,
            schemaVersion: record.schemaVersion.schemaVersion,
            version: record.version,
            catalogReviewSubmittedAt: record.catalogReviewSubmittedAt,
            publishedAt: record.publishedAt,
            updatedAt: record.updatedAt,
            qualityScore: validation.qualityScore,
            qualityBand: validation.qualityBand,
            readyForActivation: validation.readyForActivation,
            summary: validation.summary,
            issues: validation.issues,
            canApprove:
              submittedSellerDraft && validation.readyForActivation,
            canReturnToSeller: submittedSellerDraft,
          } satisfies AdminArticleReviewItemDto;
        }),
      );
      items.push(...resolved);
    }

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async approve(
    articleId: string,
    input: AdminArticleReviewApproveDto,
    actorId: string,
  ): Promise<AdminArticleReviewDecisionResultDto> {
    const candidate = await this.requireSubmittedSellerReview(
      articleId,
      input.version,
    );

    const readiness = await this.validation.validate(articleId);
    if (!readiness.readyForActivation) {
      throw new ConflictException({
        code: 'ARTICLE_REVIEW_NOT_READY_FOR_APPROVAL',
        message:
          'This Manufacturer Article still has activation blockers. Resolve or verify the listed evidence before approval.',
        qualityScore: readiness.qualityScore,
        qualityBand: readiness.qualityBand,
        issues: readiness.issues,
        summary: readiness.summary,
      });
    }

    await this.products.update(
      articleId,
      {
        version: input.version,
        status: ProductStatus.ACTIVE,
      },
      actorId,
      {
        action: 'SELLER_ARTICLE_REVIEW_APPROVED',
        metadata: {
          sourceSellerId: candidate.sourceSellerId,
          catalogReviewSubmittedAt:
            candidate.catalogReviewSubmittedAt.toISOString(),
          previousVersion: input.version,
          nextVersion: input.version + 1,
          qualityScore: readiness.qualityScore,
          schemaVersion: readiness.schemaVersion,
          schemaHash: readiness.schemaHash,
        },
      },
    );

    // Article approval is complete regardless of whether a pending Seller
    // Listing has since become incomplete. Failed Listing transitions are
    // retained as private Drafts and reported for follow-up.
    try {
      const result = await submitWaitingListingsAfterArticleApproval(
        this.database, articleId, actorId,
      );
      if (result.blocked > 0) {
        this.logger.warn(`${result.blocked} waiting Listings require Seller correction after Article ${articleId} approval.`);
      }
    } catch (error) {
      this.logger.error(`Unable to process waiting Listings after Article ${articleId} approval: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    return this.decisionResult(articleId);
  }

  async returnToSeller(
    articleId: string,
    input: AdminArticleReviewReturnDto,
    actorId: string,
  ): Promise<AdminArticleReviewDecisionResultDto> {
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException({
        code: 'ARTICLE_REVIEW_RETURN_REASON_REQUIRED',
        message: 'Enter a clear reason before returning the Article to the Seller.',
      });
    }

    const candidate = await this.requireSubmittedSellerReview(
      articleId,
      input.version,
    );

    await this.database.$transaction(
      async (transaction) => {
        const result = await transaction.product.updateMany({
          where: {
            id: articleId,
            version: input.version,
            status: ProductStatus.DRAFT,
            articleSource: ArticleSource.SELLER_SUBMISSION,
            catalogReviewSubmittedAt: { not: null },
          },
          data: {
            catalogReviewSubmittedAt: null,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });

        if (result.count !== 1) {
          throw new ConflictException({
            code: 'ARTICLE_REVIEW_VERSION_CONFLICT',
            message:
              'This Manufacturer Article changed since it was loaded. Reload the review queue before continuing.',
          });
        }

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'SELLER_ARTICLE_RETURNED_FOR_CHANGES',
            entityType: 'Product',
            entityId: articleId,
            metadata: {
              sourceSellerId: candidate.sourceSellerId,
              reason,
              previousVersion: input.version,
              nextVersion: input.version + 1,
              catalogReviewSubmittedAt:
                candidate.catalogReviewSubmittedAt?.toISOString() ?? null,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.decisionResult(articleId);
  }

  private reviewWhere(
    query: AdminArticleReviewPageQueryDto,
  ): Prisma.ProductWhereInput {
    const filters: Prisma.ProductWhereInput[] = [];
    const state = query.reviewState ?? AdminArticleReviewState.AWAITING_REVIEW;

    if (state === AdminArticleReviewState.AWAITING_REVIEW) {
      filters.push({
        articleSource: ArticleSource.SELLER_SUBMISSION,
        status: ProductStatus.DRAFT,
        catalogReviewSubmittedAt: { not: null },
      });
    } else if (state === AdminArticleReviewState.SELLER_DRAFT) {
      filters.push({
        articleSource: ArticleSource.SELLER_SUBMISSION,
        status: ProductStatus.DRAFT,
        catalogReviewSubmittedAt: null,
      });
    } else if (state === AdminArticleReviewState.DRAFT) {
      filters.push({ status: ProductStatus.DRAFT });
    } else if (state !== AdminArticleReviewState.ALL) {
      filters.push({ status: state as ProductStatus });
    }

    if (query.source) filters.push({ articleSource: query.source });
    if (query.status) filters.push({ status: query.status });

    const search = query.search?.trim();
    if (search) {
      const searchFilters: Prisma.ProductWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
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
          brand: {
            is: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          sourceSeller: {
            is: {
              OR: [
                { sellerCode: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
                { businessName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          partNumbers: {
            some: {
              type: PartNumberType.MANUFACTURER,
              OR: [
                { partNumber: { contains: search, mode: 'insensitive' } },
                { rawPartNumber: { contains: search, mode: 'insensitive' } },
                {
                  normalizedPartNumber: {
                    contains: search.replace(/[^a-zA-Z0-9]/g, ''),
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
      ];

      if (this.isUuid(search)) searchFilters.push({ id: search });
      filters.push({ OR: searchFilters });
    }

    return filters.length === 0 ? {} : { AND: filters };
  }

  private reviewOrderBy(
    query: AdminArticleReviewPageQueryDto,
  ): Prisma.ProductOrderByWithRelationInput[] {
    const direction =
      query.sortDirection === AdminSortDirection.DESC ? 'desc' : 'asc';
    const sortBy =
      query.sortBy ?? AdminArticleReviewSortBy.REVIEW_SUBMITTED_AT;

    if (sortBy === AdminArticleReviewSortBy.NAME) {
      return [{ name: direction }, { id: 'asc' }];
    }
    if (sortBy === AdminArticleReviewSortBy.UPDATED_AT) {
      return [{ updatedAt: direction }, { id: 'asc' }];
    }
    return [
      {
        catalogReviewSubmittedAt: {
          sort: direction,
          nulls: 'last',
        },
      },
      { id: 'asc' },
    ];
  }

  private reviewState(record: {
    articleSource: ArticleSource;
    status: ProductStatus;
    catalogReviewSubmittedAt: Date | null;
  }): AdminArticleReviewState {
    if (
      record.articleSource === ArticleSource.SELLER_SUBMISSION &&
      record.status === ProductStatus.DRAFT
    ) {
      return record.catalogReviewSubmittedAt
        ? AdminArticleReviewState.AWAITING_REVIEW
        : AdminArticleReviewState.SELLER_DRAFT;
    }

    switch (record.status) {
      case ProductStatus.DRAFT:
        return AdminArticleReviewState.DRAFT;
      case ProductStatus.ACTIVE:
        return AdminArticleReviewState.ACTIVE;
      case ProductStatus.INACTIVE:
        return AdminArticleReviewState.INACTIVE;
      case ProductStatus.DEPRECATED:
        return AdminArticleReviewState.DEPRECATED;
      case ProductStatus.ARCHIVED:
        return AdminArticleReviewState.ARCHIVED;
    }
  }

  private async requireSubmittedSellerReview(
    articleId: string,
    version: number,
  ): Promise<{
    sourceSellerId: string;
    catalogReviewSubmittedAt: Date;
  }> {
    const article = await this.database.product.findUnique({
      where: { id: articleId },
      select: {
        articleSource: true,
        sourceSellerId: true,
        status: true,
        version: true,
        catalogReviewSubmittedAt: true,
      },
    });

    if (!article) {
      throw new NotFoundException({
        code: 'ARTICLE_REVIEW_NOT_FOUND',
        message: 'The Manufacturer Article was not found.',
      });
    }
    if (article.version !== version) {
      throw new ConflictException({
        code: 'ARTICLE_REVIEW_VERSION_CONFLICT',
        message:
          'This Manufacturer Article changed since it was loaded. Reload the review queue before continuing.',
      });
    }
    if (
      article.articleSource !== ArticleSource.SELLER_SUBMISSION ||
      article.status !== ProductStatus.DRAFT ||
      !article.sourceSellerId ||
      !article.catalogReviewSubmittedAt
    ) {
      throw new ConflictException({
        code: 'ARTICLE_REVIEW_NOT_SUBMITTED',
        message:
          'Only a Seller-submitted Draft that is currently awaiting catalog review can receive this decision.',
      });
    }

    return {
      sourceSellerId: article.sourceSellerId,
      catalogReviewSubmittedAt: article.catalogReviewSubmittedAt,
    };
  }

  private async decisionResult(
    articleId: string,
  ): Promise<AdminArticleReviewDecisionResultDto> {
    const article = await this.database.product.findUnique({
      where: { id: articleId },
      select: {
        articleSource: true,
        status: true,
        version: true,
        catalogReviewSubmittedAt: true,
        publishedAt: true,
      },
    });
    if (!article) {
      throw new NotFoundException({
        code: 'ARTICLE_REVIEW_NOT_FOUND',
        message: 'The Manufacturer Article was not found.',
      });
    }

    return {
      articleId,
      status: article.status,
      reviewState: this.reviewState(article),
      version: article.version,
      catalogReviewSubmittedAt: article.catalogReviewSubmittedAt,
      publishedAt: article.publishedAt,
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
