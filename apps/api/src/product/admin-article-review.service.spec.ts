import { ArticleSource, ProductStatus } from '@prisma/client';
import { AdminSortDirection } from '../common/admin-sort.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ArticleValidationService } from './article-validation.service.js';
import { AdminArticleReviewService } from './admin-article-review.service.js';
import {
  AdminArticleReviewSortBy,
  AdminArticleReviewState,
} from './dto/admin-article-review.dto.js';
import type { ProductService } from './product.service.js';

describe('AdminArticleReviewService', () => {
  const articleId = '11111111-1111-4111-8111-111111111111';
  const sellerId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';
  const submittedAt = new Date('2026-10-07T05:00:00.000Z');

  const product = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const sellerListing = { findMany: vi.fn().mockResolvedValue([]) };
  const database = {
    sellerListing,
    product,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ product, auditLog }),
    ),
  };
  const validation = { validate: vi.fn() };
  const products = { update: vi.fn() };

  const service = new AdminArticleReviewService(
    database as unknown as DatabaseService,
    validation as unknown as ArticleValidationService,
    products as unknown as ProductService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    auditLog.create.mockResolvedValue({});
    product.updateMany.mockResolvedValue({ count: 1 });
  });

  it('pages submitted Seller Articles with activation readiness and Seller context', async () => {
    product.count.mockResolvedValue(1);
    product.findMany.mockResolvedValue([
      {
        id: articleId,
        name: 'Bosch Brake Pad Set',
        articleSource: ArticleSource.SELLER_SUBMISSION,
        status: ProductStatus.DRAFT,
        version: 2,
        catalogReviewSubmittedAt: submittedAt,
        publishedAt: null,
        updatedAt: submittedAt,
        brand: {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'Bosch',
        },
        productType: {
          id: '55555555-5555-4555-8555-555555555555',
          code: 'BRAKE_PAD',
          name: 'Brake Pad Set',
        },
        schemaVersion: { schemaVersion: 3 },
        sourceSeller: {
          id: sellerId,
          sellerCode: 'SEL-001',
          displayName: 'Addis Auto Parts',
        },
        partNumbers: [{ partNumber: '0 986 494 123' }],
      },
    ]);
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: true,
      qualityScore: 100,
      qualityBand: 'COMPLETE',
      schemaVersion: 3,
      schemaHash: 'a'.repeat(64),
      summary: {
        identifierCount: 1,
        oeReferenceCount: 2,
        crossReferenceCount: 0,
        verifiedFitmentCount: 1,
        imageCount: 2,
        documentCount: 0,
      },
      issues: [],
    });

    const result = await service.list({
      reviewState: AdminArticleReviewState.AWAITING_REVIEW,
      sortBy: AdminArticleReviewSortBy.REVIEW_SUBMITTED_AT,
      sortDirection: AdminSortDirection.ASC,
      page: 1,
      pageSize: 25,
    });

    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 25,
      pageCount: 1,
    });
    expect(result.items[0]).toMatchObject({
      id: articleId,
      manufacturerPartNumber: '0 986 494 123',
      articleSource: ArticleSource.SELLER_SUBMISSION,
      reviewState: AdminArticleReviewState.AWAITING_REVIEW,
      sourceSeller: {
        id: sellerId,
        sellerCode: 'SEL-001',
        displayName: 'Addis Auto Parts',
      },
      qualityScore: 100,
      readyForActivation: true,
      canApprove: true,
      canReturnToSeller: true,
    });
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
        where: {
          AND: [
            {
              articleSource: ArticleSource.SELLER_SUBMISSION,
              status: ProductStatus.DRAFT,
              catalogReviewSubmittedAt: { not: null },
            },
          ],
        },
      }),
    );
  });

  it('approves only a submitted Seller Article through the normal activation lifecycle', async () => {
    product.findUnique
      .mockResolvedValueOnce({
        articleSource: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: sellerId,
        status: ProductStatus.DRAFT,
        version: 2,
        catalogReviewSubmittedAt: submittedAt,
      })
      .mockResolvedValueOnce({
        articleSource: ArticleSource.SELLER_SUBMISSION,
        status: ProductStatus.ACTIVE,
        version: 3,
        catalogReviewSubmittedAt: submittedAt,
        publishedAt: new Date('2026-10-07T06:00:00.000Z'),
      });
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: true,
      qualityScore: 100,
      qualityBand: 'COMPLETE',
      schemaVersion: 3,
      schemaHash: 'b'.repeat(64),
      summary: {
        identifierCount: 1,
        oeReferenceCount: 1,
        crossReferenceCount: 0,
        verifiedFitmentCount: 1,
        imageCount: 1,
        documentCount: 0,
      },
      issues: [],
    });
    products.update.mockResolvedValue({
      id: articleId,
      version: 3,
      status: ProductStatus.ACTIVE,
    });

    const result = await service.approve(articleId, { version: 2 }, actorId);

    expect(products.update).toHaveBeenCalledWith(
      articleId,
      { version: 2, status: ProductStatus.ACTIVE },
      actorId,
      {
        action: 'SELLER_ARTICLE_REVIEW_APPROVED',
        metadata: expect.objectContaining({
          sourceSellerId: sellerId,
          previousVersion: 2,
          nextVersion: 3,
          qualityScore: 100,
        }),
      },
    );
    expect(result).toMatchObject({
      articleId,
      status: ProductStatus.ACTIVE,
      reviewState: AdminArticleReviewState.ACTIVE,
      version: 3,
    });
  });

  it('returns the same submitted Draft to the Seller with an audited reason', async () => {
    product.findUnique
      .mockResolvedValueOnce({
        articleSource: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: sellerId,
        status: ProductStatus.DRAFT,
        version: 4,
        catalogReviewSubmittedAt: submittedAt,
      })
      .mockResolvedValueOnce({
        articleSource: ArticleSource.SELLER_SUBMISSION,
        status: ProductStatus.DRAFT,
        version: 5,
        catalogReviewSubmittedAt: null,
        publishedAt: null,
      });

    const result = await service.returnToSeller(
      articleId,
      {
        version: 4,
        reason: 'Verify the OE reference and correct the fitment evidence.',
      },
      actorId,
    );

    expect(product.updateMany).toHaveBeenCalledWith({
      where: {
        id: articleId,
        version: 4,
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
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId,
        action: 'SELLER_ARTICLE_RETURNED_FOR_CHANGES',
        entityType: 'Product',
        entityId: articleId,
        metadata: expect.objectContaining({
          sourceSellerId: sellerId,
          reason:
            'Verify the OE reference and correct the fitment evidence.',
          previousVersion: 4,
          nextVersion: 5,
        }),
      }),
    });
    expect(result).toMatchObject({
      articleId,
      status: ProductStatus.DRAFT,
      reviewState: AdminArticleReviewState.SELLER_DRAFT,
      version: 5,
      catalogReviewSubmittedAt: null,
    });
  });

  it('blocks approval when activation readiness is not clean', async () => {
    product.findUnique.mockResolvedValue({
      articleSource: ArticleSource.SELLER_SUBMISSION,
      sourceSellerId: sellerId,
      status: ProductStatus.DRAFT,
      version: 2,
      catalogReviewSubmittedAt: submittedAt,
    });
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: false,
      qualityScore: 85,
      qualityBand: 'GOOD',
      schemaVersion: 3,
      schemaHash: 'c'.repeat(64),
      summary: {
        identifierCount: 1,
        oeReferenceCount: 0,
        crossReferenceCount: 0,
        verifiedFitmentCount: 0,
        imageCount: 1,
        documentCount: 0,
      },
      issues: [
        {
          code: 'ARTICLE_FITMENT_REQUIRED',
          area: 'FITMENT',
          message: 'Verified fitment is required.',
        },
      ],
    });

    await expect(
      service.approve(articleId, { version: 2 }, actorId),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_REVIEW_NOT_READY_FOR_APPROVAL' },
    });

    expect(products.update).not.toHaveBeenCalled();
  });
});
