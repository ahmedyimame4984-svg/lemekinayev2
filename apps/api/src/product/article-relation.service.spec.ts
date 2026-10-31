import {
  ArticleRelationType,
  MasterDataStatus,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { ArticleRelationService } from './article-relation.service.js';

describe('ArticleRelationService', () => {
  const sourceArticleId = '11111111-1111-4111-8111-111111111111';
  const targetArticleId = '22222222-2222-4222-8222-222222222222';
  const actorId = '33333333-3333-4333-8333-333333333333';
  const brandId = '44444444-4444-4444-8444-444444444444';
  const productTypeId = '55555555-5555-4555-8555-555555555555';
  const now = new Date('2026-10-06T00:00:00.000Z');

  const sourceArticle = {
    id: sourceArticleId,
    brandId,
    productTypeId,
    status: ProductStatus.ACTIVE,
  };
  const targetArticle = {
    id: targetArticleId,
    brandId,
    productTypeId,
    status: ProductStatus.ACTIVE,
  };

  const product = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  };
  const articleRelation = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    product,
    articleRelation,
    auditLog,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({ product, articleRelation, auditLog }),
    ),
  };
  const service = new ArticleRelationService(
    database as unknown as DatabaseService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === sourceArticleId ? sourceArticle : targetArticle,
      ),
    );
    product.findFirst.mockResolvedValue(sourceArticle);
    articleRelation.findUnique.mockResolvedValue(null);
    articleRelation.findMany.mockResolvedValue([]);
    articleRelation.create.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      sourceArticleId,
      targetArticleId,
      type: ArticleRelationType.SUPERSEDES,
      note: null,
      componentQuantity: null,
      componentRole: null,
      componentOrder: null,
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    auditLog.create.mockResolvedValue({ id: 'audit-id' });
  });

  it('rejects self relations before persistence', async () => {
    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId: sourceArticleId,
          type: ArticleRelationType.RELATED,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_SELF_NOT_ALLOWED' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('creates a directional same-brand same-type supersession', async () => {
    await service.create(
      sourceArticleId,
      {
        targetArticleId,
        type: ArticleRelationType.SUPERSEDES,
      },
      actorId,
    );

    expect(articleRelation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceArticleId,
        targetArticleId,
        type: ArticleRelationType.SUPERSEDES,
        relationKey:
          'SUPERSEDES:' + sourceArticleId + ':' + targetArticleId,
        status: MasterDataStatus.DRAFT,
      }),
      select: expect.any(Object),
    });
  });

  it('rejects supersession across Manufacturer Brands', async () => {
    product.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === sourceArticleId
          ? sourceArticle
          : {
              ...targetArticle,
              brandId: '77777777-7777-4777-8777-777777777777',
            },
      ),
    );

    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.SUPERSEDES,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_SUPERSESSION_BRAND_MISMATCH' },
    });

    expect(articleRelation.create).not.toHaveBeenCalled();
  });

  it('rejects supersession cycles', async () => {
    articleRelation.findMany.mockResolvedValue([
      { targetArticleId: sourceArticleId },
    ]);

    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.SUPERSEDES,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_SUPERSESSION_CYCLE' },
    });

    expect(articleRelation.create).not.toHaveBeenCalled();
  });

  it('uses a symmetric key so reverse interchangeable duplicates are blocked', async () => {
    const relationId = '88888888-8888-4888-8888-888888888888';
    articleRelation.findUnique.mockResolvedValue({ id: relationId });

    await expect(
      service.create(
        targetArticleId,
        {
          targetArticleId: sourceArticleId,
          type: ArticleRelationType.INTERCHANGEABLE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_ALREADY_EXISTS' },
    });

    expect(articleRelation.findUnique).toHaveBeenCalledWith({
      where: {
        relationKey:
          'INTERCHANGEABLE:' +
          sourceArticleId +
          ':' +
          targetArticleId,
      },
      select: { id: true },
    });
  });

  it('creates a structured kit component with quantity, role and order', async () => {
    articleRelation.create.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      sourceArticleId,
      targetArticleId,
      type: ArticleRelationType.CONTAINS,
      note: null,
      componentQuantity: 2,
      componentRole: 'Seal',
      componentOrder: 1,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await service.create(
      sourceArticleId,
      {
        targetArticleId,
        type: ArticleRelationType.CONTAINS,
        componentQuantity: 2,
        componentRole: ' Seal ',
        componentOrder: 1,
        status: MasterDataStatus.ACTIVE,
      },
      actorId,
    );

    expect(articleRelation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceArticleId,
        targetArticleId,
        type: ArticleRelationType.CONTAINS,
        relationKey: 'CONTAINS:' + sourceArticleId + ':' + targetArticleId,
        componentQuantity: 2,
        componentRole: 'Seal',
        componentOrder: 1,
        status: MasterDataStatus.ACTIVE,
      }),
      select: expect.any(Object),
    });
  });

  it('requires quantity before an Active component relation can publish', async () => {
    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.CONTAINS,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_COMPONENT_QUANTITY_REQUIRED' },
    });

    expect(articleRelation.create).not.toHaveBeenCalled();
  });

  it('rejects component metadata on non-component relations', async () => {
    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.ACCESSORY,
          componentQuantity: 1,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_COMPONENT_METADATA_NOT_ALLOWED' },
    });

    expect(articleRelation.create).not.toHaveBeenCalled();
  });

  it('uses the same canonical key for CONTAINS and inverse CONTAINED_IN', async () => {
    articleRelation.findUnique.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
    });

    await expect(
      service.create(
        targetArticleId,
        {
          targetArticleId: sourceArticleId,
          type: ArticleRelationType.CONTAINED_IN,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_ALREADY_EXISTS' },
    });

    expect(articleRelation.findUnique).toHaveBeenCalledWith({
      where: {
        relationKey: 'CONTAINS:' + sourceArticleId + ':' + targetArticleId,
      },
      select: { id: true },
    });
  });

  it('rejects circular kit/component graphs', async () => {
    articleRelation.findMany.mockResolvedValue([
      {
        sourceArticleId: targetArticleId,
        targetArticleId: sourceArticleId,
        type: ArticleRelationType.CONTAINS,
      },
    ]);

    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.CONTAINS,
          componentQuantity: 1,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_CONTAINMENT_CYCLE' },
    });

    expect(articleRelation.create).not.toHaveBeenCalled();
  });

  it('uses a symmetric key so reverse paired-part duplicates are blocked', async () => {
    articleRelation.findUnique.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
    });

    await expect(
      service.create(
        targetArticleId,
        {
          targetArticleId: sourceArticleId,
          type: ArticleRelationType.PAIRED_WITH,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_ALREADY_EXISTS' },
    });

    expect(articleRelation.findUnique).toHaveBeenCalledWith({
      where: {
        relationKey:
          'PAIRED_WITH:' + sourceArticleId + ':' + targetArticleId,
      },
      select: { id: true },
    });
  });

  it('requires both Articles to be Active before the relation is Active', async () => {
    product.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === sourceArticleId
          ? sourceArticle
          : { ...targetArticle, status: ProductStatus.DRAFT },
      ),
    );

    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.RELATED,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_ARTICLE_NOT_ACTIVE' },
    });
  });

  it('keeps an Active supersession valid when the superseded Article is Deprecated', async () => {
    product.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === sourceArticleId
          ? sourceArticle
          : { ...targetArticle, status: ProductStatus.DEPRECATED },
      ),
    );
    articleRelation.create.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      sourceArticleId,
      targetArticleId,
      type: ArticleRelationType.SUPERSEDES,
      note: null,
      componentQuantity: null,
      componentRole: null,
      componentOrder: null,
      status: MasterDataStatus.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.SUPERSEDES,
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).resolves.toMatchObject({
      type: ArticleRelationType.SUPERSEDES,
      status: MasterDataStatus.ACTIVE,
    });
  });

  it('allows a RELATED association across Product Types', async () => {
    product.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === sourceArticleId
          ? sourceArticle
          : {
              ...targetArticle,
              productTypeId: '99999999-9999-4999-8999-999999999999',
            },
      ),
    );
    articleRelation.create.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      sourceArticleId,
      targetArticleId,
      type: ArticleRelationType.RELATED,
      note: null,
      componentQuantity: null,
      componentRole: null,
      componentOrder: null,
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.create(
        sourceArticleId,
        {
          targetArticleId,
          type: ArticleRelationType.RELATED,
        },
        actorId,
      ),
    ).resolves.toMatchObject({ type: ArticleRelationType.RELATED });
  });

  it('publishes only Active relations between Active Articles', async () => {
    articleRelation.findMany.mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        sourceArticleId,
        targetArticleId,
        type: ArticleRelationType.SUPERSEDES,
        componentQuantity: null,
        componentRole: null,
        componentOrder: null,
      },
    ]);

    await service.listPublished(sourceArticleId);

    expect(articleRelation.findMany).toHaveBeenCalledWith({
      where: {
        status: MasterDataStatus.ACTIVE,
        OR: [
          { sourceArticleId },
          { targetArticleId: sourceArticleId },
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
                type: {
                  in: [
                    ArticleRelationType.INTERCHANGEABLE,
                    ArticleRelationType.ACCESSORY,
                    ArticleRelationType.REPAIR_KIT,
                    ArticleRelationType.CONTAINS,
                    ArticleRelationType.CONTAINED_IN,
                    ArticleRelationType.PAIRED_WITH,
                    ArticleRelationType.RELATED,
                  ],
                },
                sourceArticle: { status: ProductStatus.ACTIVE },
                targetArticle: { status: ProductStatus.ACTIVE },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        sourceArticleId: true,
        targetArticleId: true,
        type: true,
        componentQuantity: true,
        componentRole: true,
        componentOrder: true,
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  });
});
