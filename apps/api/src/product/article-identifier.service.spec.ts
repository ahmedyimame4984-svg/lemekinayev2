import {
  ArticleIdentifierType,
  MasterDataStatus,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { ArticleIdentifierService } from './article-identifier.service.js';

describe('ArticleIdentifierService', () => {
  const productId = '11111111-1111-4111-8111-111111111111';
  const otherProductId = '22222222-2222-4222-8222-222222222222';
  const identifierId = '33333333-3333-4333-8333-333333333333';
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const now = new Date('2026-10-07T04:00:00.000Z');

  const product = { findUnique: vi.fn() };
  const articleIdentifier = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const auditLog = { create: vi.fn() };
  const database = {
    product,
    articleIdentifier,
    auditLog,
    $transaction: vi.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ articleIdentifier, auditLog }),
    ),
  };

  const service = new ArticleIdentifierService(
    database as unknown as DatabaseService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockResolvedValue({
      id: productId,
      status: ProductStatus.ACTIVE,
    });
    articleIdentifier.findFirst.mockResolvedValue(null);
    articleIdentifier.findMany.mockResolvedValue([]);
    articleIdentifier.create.mockResolvedValue({
      id: identifierId,
      productId,
      type: ArticleIdentifierType.GTIN_13,
      value: '4006381333931',
      rawValue: '4006 3813-33931',
      normalizedValue: '4006381333931',
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    auditLog.create.mockResolvedValue({});
  });

  it('creates a normalized GTIN with a catalog-wide identity key', async () => {
    await service.create(
      productId,
      {
        type: ArticleIdentifierType.GTIN_13,
        value: '4006 3813-33931',
        rawValue: '4006 3813-33931',
        status: MasterDataStatus.DRAFT,
      },
      actorId,
    );

    expect(articleIdentifier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        type: ArticleIdentifierType.GTIN_13,
        value: '4006381333931',
        normalizedValue: '4006381333931',
        globalIdentityKey: 'GTIN:4006381333931',
        status: MasterDataStatus.DRAFT,
      }),
      select: expect.any(Object),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ARTICLE_IDENTIFIER_CREATED',
          entityType: 'ArticleIdentifier',
          entityId: identifierId,
        }),
      }),
    );
  });

  it('rejects a GTIN with the wrong GS1 check digit', async () => {
    await expect(
      service.create(
        productId,
        {
          type: ArticleIdentifierType.GTIN_13,
          value: '4006381333932',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_GTIN_CHECK_DIGIT_INVALID' },
    });

    expect(articleIdentifier.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate GTIN on the same Manufacturer Article deterministically', async () => {
    articleIdentifier.findFirst.mockResolvedValue({
      id: identifierId,
      productId,
    });

    await expect(
      service.create(
        productId,
        {
          type: ArticleIdentifierType.GTIN_13,
          value: '4006381333931',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_IDENTIFIER_ALREADY_EXISTS' },
    });

    expect(articleIdentifier.create).not.toHaveBeenCalled();
  });

  it('rejects a GTIN already assigned to another Manufacturer Article', async () => {
    articleIdentifier.findFirst.mockResolvedValue({
      id: 'existing-id',
      productId: otherProductId,
    });

    await expect(
      service.create(
        productId,
        {
          type: ArticleIdentifierType.GTIN_13,
          value: '4006381333931',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ARTICLE_GTIN_ALREADY_EXISTS',
        articleId: otherProductId,
      },
    });

    expect(articleIdentifier.create).not.toHaveBeenCalled();
  });

  it('stores trade numbers as Article-scoped searchable identifiers', async () => {
    articleIdentifier.create.mockResolvedValue({
      id: identifierId,
      productId,
      type: ArticleIdentifierType.TRADE_NUMBER,
      value: 'BP-494 / 123',
      rawValue: null,
      normalizedValue: 'BP494123',
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await service.create(
      productId,
      {
        type: ArticleIdentifierType.TRADE_NUMBER,
        value: 'bp-494 / 123',
      },
      actorId,
    );

    expect(articleIdentifier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        value: 'BP-494 / 123',
        normalizedValue: 'BP494123',
        globalIdentityKey: null,
      }),
      select: expect.any(Object),
    });
  });

  it('does not allow an Active identifier on a non-Active Article', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      status: ProductStatus.DRAFT,
    });

    await expect(
      service.create(
        productId,
        {
          type: ArticleIdentifierType.TRADE_NUMBER,
          value: 'BP-494-123',
          status: MasterDataStatus.ACTIVE,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_IDENTIFIER_PRODUCT_NOT_ACTIVE' },
    });
  });
});
