import { MasterDataStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { ArticleValidationService } from '../product/article-validation.service.js';
import { CatalogHealthService } from './catalog-health.service.js';
import { CatalogQualityIssue } from './dto/catalog-health.dto.js';

function createDatabase() {
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce([{ count: 2 }])
    .mockResolvedValueOnce([{ count: 1 }])
    .mockResolvedValueOnce([
      {
        normalized_part_number: '044650K340',
        issuer_brand: 'Toyota',
        article_brand: 'Example Brand',
        product_type: 'Brake Pad Set',
        article_count: 2,
      },
    ]);

  return {
    productType: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'BRAKE_PAD',
          name: 'Brake Pad Set',
          currentSchemaVersion: {
            snapshot: {
              attributes: [
                { code: 'ATTR_POSITION', requirement: 'MANDATORY' },
              ],
            },
          },
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          code: 'WIPER_BLADE',
          name: 'Wiper Blade',
          currentSchemaVersion: {
            snapshot: {
              attributes: [
                { code: 'ATTR_LENGTH', requirement: 'OPTIONAL' },
              ],
            },
          },
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          code: 'UNPUBLISHED',
          name: 'Unpublished Type',
          currentSchemaVersion: null,
        },
      ]),
    },
    product: {
      count: vi
        .fn()
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(7),
      findMany: vi.fn().mockResolvedValue([
        {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'Incomplete seller article',
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Nearly ready seller article',
        },
      ]),
    },
    vehicleConfiguration: {
      count: vi
        .fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2),
    },
    vehicleModel: {
      count: vi.fn().mockResolvedValue(3),
    },
    vehicleGeneration: {
      count: vi.fn().mockResolvedValue(4),
    },
    $queryRaw: queryRaw,
  };
}

describe('CatalogHealthService', () => {
  it('aggregates actionable catalog health without treating the normal review queue as a data error', async () => {
    const database = createDatabase();
    const articleValidation = {
      validate: vi
        .fn()
        .mockResolvedValueOnce({
          articleId: '44444444-4444-4444-8444-444444444444',
          readyForActivation: false,
          qualityScore: 45,
          qualityBand: 'POOR',
          schemaVersion: 1,
          schemaHash: 'a'.repeat(64),
          summary: {
            identifierCount: 0,
            oeReferenceCount: 0,
            crossReferenceCount: 0,
            verifiedFitmentCount: 0,
            imageCount: 0,
            documentCount: 0,
          },
          issues: [
            {
              code: 'ARTICLE_IDENTIFIER_REQUIRED',
              area: 'IDENTIFIER',
              message: 'Identifier required',
            },
            {
              code: 'ARTICLE_FITMENT_REQUIRED',
              area: 'FITMENT',
              message: 'Fitment required',
            },
          ],
        })
        .mockResolvedValueOnce({
          articleId: '55555555-5555-4555-8555-555555555555',
          readyForActivation: false,
          qualityScore: 85,
          qualityBand: 'GOOD',
          schemaVersion: 1,
          schemaHash: 'b'.repeat(64),
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
              code: 'ARTICLE_DOCUMENT_REQUIRED',
              area: 'DOCUMENT',
              message: 'Document required',
            },
          ],
        }),
    };

    const service = new CatalogHealthService(
      database as unknown as DatabaseService,
      articleValidation as unknown as ArticleValidationService,
    );

    const result = await service.getHealth();

    expect(result.status).toBe('CRITICAL');
    expect(result.productTypes).toMatchObject({
      active: 3,
      withoutPublishedSchema: 1,
      withoutRequiredCriteria: 1,
    });
    expect(result.articles).toMatchObject({
      total: 120,
      active: 80,
      sellerAwaitingReview: 7,
      activeWithoutRequiredVerifiedFitment: 2,
      completenessSampleEvaluated: 2,
      lowCompletenessInSample: 1,
    });
    expect(result.articles.lowCompletenessSamples).toEqual([
      expect.objectContaining({
        articleId: '44444444-4444-4444-8444-444444444444',
        qualityScore: 45,
        qualityBand: 'POOR',
        issueAreas: ['IDENTIFIER', 'FITMENT'],
      }),
    ]);
    expect(result.oeReferences).toEqual({
      collisionGroups: 1,
      samples: [
        {
          normalizedPartNumber: '044650K340',
          issuerBrand: 'Toyota',
          articleBrand: 'Example Brand',
          productType: 'Brake Pad Set',
          articleCount: 2,
        },
      ],
    });
    expect(result.vehicles).toEqual({
      activeConfigurations: 100,
      activeConfigurationsWithoutEngine: 1,
      incompleteActiveConfigurations: 2,
      activeModelsWithoutConfigurations: 3,
      activeGenerationsWithoutConfigurations: 4,
    });

    expect(database.productType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: MasterDataStatus.ACTIVE },
      }),
    );
    expect(database.vehicleConfiguration.count).toHaveBeenCalledWith({
      where: { status: MasterDataStatus.ACTIVE },
    });
    expect(articleValidation.validate).toHaveBeenCalledTimes(2);
  });

  it('reports healthy when there are no operational data-quality findings', async () => {
    const database = {
      productType: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '11111111-1111-4111-8111-111111111111',
            code: 'BRAKE_PAD',
            name: 'Brake Pad Set',
            currentSchemaVersion: {
              snapshot: {
                attributes: [
                  { code: 'ATTR_POSITION', requirement: 'MANDATORY' },
                ],
              },
            },
          },
        ]),
      },
      product: {
        count: vi
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      vehicleConfiguration: {
        count: vi
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
      },
      vehicleModel: { count: vi.fn().mockResolvedValue(0) },
      vehicleGeneration: { count: vi.fn().mockResolvedValue(0) },
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]),
    };

    const articleValidation = { validate: vi.fn() };
    const service = new CatalogHealthService(
      database as unknown as DatabaseService,
      articleValidation as unknown as ArticleValidationService,
    );

    const result = await service.getHealth();

    expect(result.status).toBe('HEALTHY');
    expect(result.actionItems).toBe(0);
    expect(result.articles.sellerAwaitingReview).toBe(0);
    expect(articleValidation.validate).not.toHaveBeenCalled();
  });

  it('keeps OE collision detection scoped to the same issuer, Article Brand, and Product Type', async () => {
    const database = createDatabase();
    const articleValidation = {
      validate: vi.fn().mockResolvedValue({
        articleId: 'x',
        readyForActivation: true,
        qualityScore: 100,
        qualityBand: 'COMPLETE',
        schemaVersion: 1,
        schemaHash: 'c'.repeat(64),
        summary: {
          identifierCount: 1,
          oeReferenceCount: 1,
          crossReferenceCount: 0,
          verifiedFitmentCount: 1,
          imageCount: 1,
          documentCount: 0,
        },
        issues: [],
      }),
    };

    const service = new CatalogHealthService(
      database as unknown as DatabaseService,
      articleValidation as unknown as ArticleValidationService,
    );
    await service.getHealth();

    const rawCalls = (
      database.$queryRaw as unknown as ReturnType<typeof vi.fn>
    ).mock.calls;
    const oeSql = (
      rawCalls[1]?.[0] as { strings?: readonly string[] }
    )?.strings?.join('') ?? '';

    expect(oeSql).toContain('pn."brand_id"');
    expect(oeSql).toContain('p."brand_id"');
    expect(oeSql).toContain('p."product_type_id"');
    expect(oeSql).not.toContain('issuer_brand_id');
  });
  it('pages Seller Article review findings with governance context', async () => {
    const database = {
      product: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          {
            id: '66666666-6666-4666-8666-666666666666',
            name: 'Seller brake pad',
            submittedAt: new Date('2026-10-01T09:00:00.000Z'),
            productType: { name: 'Brake Pad Set' },
            brand: { name: 'Example Brand' },
          },
          {
            id: '77777777-7777-4777-8777-777777777777',
            name: 'Seller oil filter',
            submittedAt: new Date('2026-10-02T09:00:00.000Z'),
            productType: { name: 'Oil Filter' },
            brand: null,
          },
        ]),
      },
    };
    const service = new CatalogHealthService(
      database as unknown as DatabaseService,
      { validate: vi.fn() } as unknown as ArticleValidationService,
    );

    const result = await service.getFindings({
      issue: CatalogQualityIssue.SELLER_AWAITING_REVIEW,
      page: 1,
      pageSize: 25,
    });

    expect(result).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 25,
      pageCount: 1,
    });
    expect(result.items[0]).toMatchObject({
      issue: CatalogQualityIssue.SELLER_AWAITING_REVIEW,
      severity: 'ATTENTION',
      entityType: 'ARTICLE',
      entityId: '66666666-6666-4666-8666-666666666666',
      title: 'Seller brake pad',
    });
    expect(result.items[0]?.context).toContain('Source: Seller submission');
    expect(database.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
      }),
    );
  });

});
