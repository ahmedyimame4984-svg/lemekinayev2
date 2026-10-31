import {
  ArticleRelationType,
  ArticleSource,
  MasterDataStatus,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { ArticleRelationService } from './article-relation.service.js';
import { AdminArticleRelationGovernanceService } from './admin-article-relation-governance.service.js';

describe('AdminArticleRelationGovernanceService', () => {
  const sourceArticleId = '11111111-1111-4111-8111-111111111111';
  const targetArticleId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';

  const articleRelation = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  const product = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  };
  const database = {
    articleRelation,
    product,
  };
  const relations = {
    create: vi.fn(),
    update: vi.fn(),
  };

  const service = new AdminArticleRelationGovernanceService(
    database as unknown as DatabaseService,
    relations as unknown as ArticleRelationService,
  );

  const article = (
    id: string,
    name: string,
    status: ProductStatus = ProductStatus.ACTIVE,
  ) => ({
    id,
    name,
    status,
    articleSource: ArticleSource.APPROVED_CATALOG_IMPORT,
    brand: {
      id: '44444444-4444-4444-8444-444444444444',
      code: 'BOSCH',
      name: 'Bosch',
    },
    productType: {
      id: '55555555-5555-4555-8555-555555555555',
      code: 'BRAKE_PAD_SET',
      name: 'Brake Pad Set',
    },
    partNumbers: [{ partNumber: id === sourceArticleId ? 'BP-NEW' : 'BP-OLD' }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summarizes live relation governance signals', async () => {
    articleRelation.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(4);

    await expect(service.summary()).resolves.toEqual({
      liveRelations: 40,
      supersessionRelations: 8,
      activeSupersessions: 5,
      draftRelations: 7,
      componentRelations: 4,
    });
  });

  it('pages enriched Article relations', async () => {
    articleRelation.count.mockResolvedValue(1);
    articleRelation.findMany.mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        type: ArticleRelationType.SUPERSEDES,
        status: MasterDataStatus.ACTIVE,
        version: 2,
        note: 'Manufacturer replacement bulletin',
        componentQuantity: null,
        componentRole: null,
        componentOrder: null,
        createdAt: new Date('2026-10-07T08:00:00.000Z'),
        updatedAt: new Date('2026-10-07T09:00:00.000Z'),
        sourceArticle: article(sourceArticleId, 'Bosch Brake Pad New'),
        targetArticle: article(
          targetArticleId,
          'Bosch Brake Pad Old',
          ProductStatus.DEPRECATED,
        ),
      },
    ]);

    const result = await service.list({
      type: ArticleRelationType.SUPERSEDES,
      status: MasterDataStatus.ACTIVE,
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
      type: ArticleRelationType.SUPERSEDES,
      sourceArticle: {
        id: sourceArticleId,
        manufacturerPartNumber: 'BP-NEW',
      },
      targetArticle: {
        id: targetArticleId,
        manufacturerPartNumber: 'BP-OLD',
        status: ProductStatus.DEPRECATED,
      },
    });
  });

  it('narrows supersession target candidates to the same Brand and Product Type', async () => {
    product.findUnique.mockResolvedValue({
      id: sourceArticleId,
      brandId: '44444444-4444-4444-8444-444444444444',
      productTypeId: '55555555-5555-4555-8555-555555555555',
    });
    product.count.mockResolvedValue(1);
    product.findMany.mockResolvedValue([
      article(targetArticleId, 'Bosch Brake Pad Old'),
    ]);

    const result = await service.candidates({
      sourceArticleId,
      type: ArticleRelationType.SUPERSEDES,
      search: 'BP-OLD',
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]).toMatchObject({
      id: targetArticleId,
      manufacturerPartNumber: 'BP-OLD',
    });
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { status: { not: ProductStatus.ARCHIVED } },
            { id: { not: sourceArticleId } },
            {
              brandId: '44444444-4444-4444-8444-444444444444',
              productTypeId: '55555555-5555-4555-8555-555555555555',
            },
          ]),
        },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('returns no supersession candidates when the source Article has no Brand', async () => {
    product.findUnique.mockResolvedValue({
      id: sourceArticleId,
      brandId: null,
      productTypeId: '55555555-5555-4555-8555-555555555555',
    });

    await expect(
      service.candidates({
        sourceArticleId,
        type: ArticleRelationType.SUPERSEDES,
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      pageCount: 0,
    });

    expect(product.findMany).not.toHaveBeenCalled();
  });

  it('delegates creation to the canonical relation service', async () => {
    relations.create.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      sourceArticleId,
      targetArticleId,
      type: ArticleRelationType.SUPERSEDES,
      note: null,
      componentQuantity: null,
      componentRole: null,
      componentOrder: null,
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.create(
      {
        sourceArticleId,
        targetArticleId,
        type: ArticleRelationType.SUPERSEDES,
        status: MasterDataStatus.DRAFT,
      },
      actorId,
    );

    expect(relations.create).toHaveBeenCalledWith(
      sourceArticleId,
      {
        targetArticleId,
        type: ArticleRelationType.SUPERSEDES,
        status: MasterDataStatus.DRAFT,
      },
      actorId,
    );
  });

  it('delegates versioned relation updates to the canonical relation service', async () => {
    relations.update.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
    });

    await service.update(
      '77777777-7777-4777-8777-777777777777',
      {
        version: 3,
        status: MasterDataStatus.ACTIVE,
        note: 'Verified manufacturer replacement',
      },
      actorId,
    );

    expect(relations.update).toHaveBeenCalledWith(
      '77777777-7777-4777-8777-777777777777',
      {
        version: 3,
        status: MasterDataStatus.ACTIVE,
        note: 'Verified manufacturer replacement',
      },
      actorId,
    );
  });
});
