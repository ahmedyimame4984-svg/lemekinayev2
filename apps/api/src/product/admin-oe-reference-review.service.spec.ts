import {
  ArticleSource,
  MasterDataStatus,
  PartNumberType,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { AdminOeReferenceReviewService } from './admin-oe-reference-review.service.js';
import { AdminReferenceIntegrityFilter } from './dto/admin-oe-reference-review.dto.js';

describe('AdminOeReferenceReviewService', () => {
  const partNumber = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const product = {
    findMany: vi.fn(),
  };
  const database = {
    partNumber,
    product,
    $queryRaw: vi.fn(),
  };

  const service = new AdminOeReferenceReviewService(
    database as unknown as DatabaseService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summarizes live OE, cross-reference and integrity signals', async () => {
    partNumber.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(44)
      .mockResolvedValueOnce(3);
    database.$queryRaw.mockResolvedValue([{ count: 7 }]);

    const result = await service.summary();

    expect(result).toEqual({
      liveOeReferences: 120,
      liveCrossReferences: 44,
      collisionGroups: 7,
      oeWithoutIssuerBrand: 3,
    });
  });

  it('pages collision groups and enriches sample Articles', async () => {
    const articleId = '11111111-1111-4111-8111-111111111111';
    database.$queryRaw
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([
        {
          issuer_brand_id: '22222222-2222-4222-8222-222222222222',
          issuer_brand_code: 'TOYOTA',
          issuer_brand_name: 'Toyota',
          normalized_part_number: '0446502390',
          display_part_number: '04465-02390',
          article_brand_id: '33333333-3333-4333-8333-333333333333',
          article_brand_code: 'BOSCH',
          article_brand_name: 'Bosch',
          product_type_id: '44444444-4444-4444-8444-444444444444',
          product_type_code: 'BRAKE_PAD_SET',
          product_type_name: 'Brake Pad Set',
          article_count: 2,
          active_article_count: 1,
          draft_article_count: 1,
          sample_article_ids: [articleId],
        },
      ]);
    product.findMany.mockResolvedValue([
      {
        id: articleId,
        name: 'Bosch Brake Pad Set',
        status: ProductStatus.DRAFT,
        articleSource: ArticleSource.SELLER_SUBMISSION,
        catalogReviewSubmittedAt: new Date('2026-10-07T07:00:00.000Z'),
        brand: {
          id: '33333333-3333-4333-8333-333333333333',
          code: 'BOSCH',
          name: 'Bosch',
        },
        productType: {
          id: '44444444-4444-4444-8444-444444444444',
          code: 'BRAKE_PAD_SET',
          name: 'Brake Pad Set',
        },
        sourceSeller: {
          id: '55555555-5555-4555-8555-555555555555',
          sellerCode: 'SEL-001',
          displayName: 'Addis Auto Parts',
        },
        partNumbers: [{ partNumber: '0 986 494 123' }],
        _count: {
          outgoingArticleRelations: 1,
          incomingArticleRelations: 2,
        },
      },
    ]);

    const result = await service.listCollisions({
      search: '04465-02390',
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
      normalizedPartNumber: '0446502390',
      displayPartNumber: '04465-02390',
      issuerBrand: { name: 'Toyota' },
      articleBrand: { name: 'Bosch' },
      productType: { name: 'Brake Pad Set' },
      articleCount: 2,
      activeArticleCount: 1,
      draftArticleCount: 1,
      sampleArticles: [
        {
          id: articleId,
          manufacturerPartNumber: '0 986 494 123',
          relationCount: 3,
          awaitingReview: true,
        },
      ],
    });
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [articleId] } },
      }),
    );
  });

  it('searches legacy OE integrity records with canonical Article context', async () => {
    const articleId = '66666666-6666-4666-8666-666666666666';
    partNumber.count.mockResolvedValue(1);
    partNumber.findMany.mockResolvedValue([
      {
        id: '77777777-7777-4777-8777-777777777777',
        type: PartNumberType.OE,
        partNumber: '123-ABC',
        rawPartNumber: '123 ABC',
        normalizedPartNumber: '123ABC',
        isPrimary: false,
        status: MasterDataStatus.DRAFT,
        version: 1,
        updatedAt: new Date('2026-10-07T08:00:00.000Z'),
        issuerBrand: null,
        product: {
          id: articleId,
          name: 'Example Brake Pad',
          status: ProductStatus.DRAFT,
          articleSource: ArticleSource.PLATFORM_MIGRATION,
          catalogReviewSubmittedAt: null,
          brand: {
            id: '88888888-8888-4888-8888-888888888888',
            code: 'EXAMPLE',
            name: 'Example Brand',
          },
          productType: {
            id: '99999999-9999-4999-8999-999999999999',
            code: 'BRAKE_PAD_SET',
            name: 'Brake Pad Set',
          },
          sourceSeller: null,
          partNumbers: [{ partNumber: 'BP-100' }],
          _count: {
            outgoingArticleRelations: 0,
            incomingArticleRelations: 0,
          },
        },
      },
    ]);

    const result = await service.searchReferences({
      search: '123 ABC',
      type: PartNumberType.OE,
      integrity: AdminReferenceIntegrityFilter.OE_MISSING_ISSUER,
      page: 1,
      pageSize: 25,
    });

    expect(result.items[0]).toMatchObject({
      type: PartNumberType.OE,
      partNumber: '123-ABC',
      issuerBrand: null,
      article: {
        id: articleId,
        manufacturerPartNumber: 'BP-100',
        relationCount: 0,
      },
    });
    expect(partNumber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
        where: {
          AND: expect.arrayContaining([
            { type: PartNumberType.OE },
            {
              type: PartNumberType.OE,
              issuerBrandId: null,
            },
          ]),
        },
      }),
    );
  });
});
