import { ConflictException } from '@nestjs/common';
import {
  ArticleIdentifierType,
  ArticleRelationType,
  ArticleSource,
  CompatibilityCriterionType,
  CompatibilitySource,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  ProductAssetType,
  ProductStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import type { CatalogSchemaService } from '../catalog/catalog-schema.service.js';
import type { CompatibilityService } from '../compatibility/compatibility.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ArticleIdentifierService } from '../product/article-identifier.service.js';
import type { ArticleRelationService } from '../product/article-relation.service.js';
import type { ArticleValidationService } from '../product/article-validation.service.js';
import type { ProductAssetService } from '../product/product-asset.service.js';
import type { ProductIdentityService } from '../product/product-identity.service.js';
import type { ProductService } from '../product/product.service.js';
import { SellerArticleService } from './seller-article.service.js';
import type { SellerService } from './seller.service.js';

describe('SellerArticleService', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const productTypeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const articleId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const brandId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const configurationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  const snapshot = {
    schemaKind: 'PRODUCT_TYPE_SCHEMA',
    contractVersion: 2,
    articleRequirements: {
      brand: ProductTypeRequirementLevel.REQUIRED,
      identifier:
        ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
      gtin: ProductTypeRequirementLevel.OPTIONAL,
      oeReference: ProductTypeRequirementLevel.OPTIONAL,
      crossReference: ProductTypeRequirementLevel.OPTIONAL,
      fitment: ProductTypeRequirementLevel.REQUIRED,
      image: ProductTypeRequirementLevel.REQUIRED,
      minimumImageCount: 1,
      document: ProductTypeRequirementLevel.OPTIONAL,
      minimumDocumentCount: 0,
    },
  };

  const category = { findMany: vi.fn() };
  const productFamily = { findMany: vi.fn() };
  const productType = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  };
  const partNumber = { findFirst: vi.fn() };
  const brand = { findUnique: vi.fn() };
  const product = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  };
  const vehicleCompatibility = {
    findFirst: vi.fn(),
    count: vi.fn(),
  };
  const auditLog = { create: vi.fn(), findMany: vi.fn() };
  const database = {
    category,
    productFamily,
    productType,
    partNumber,
    brand,
    product,
    vehicleCompatibility,
    auditLog,
    $transaction: vi.fn(async (operation: (tx: unknown) => unknown) =>
      operation({ product, auditLog }),
    ),
  };

  const sellers = {
    requireOperationalSellerByUser: vi.fn(),
  };
  const schemas = {
    getCurrentPublishedSchema: vi.fn(),
  };
  const products = {
    create: vi.fn(),
    getAdmin: vi.fn(),
    update: vi.fn(),
  };
  const identity = {
    createPartNumber: vi.fn(),
  };
  const articleIdentifiers = {
    create: vi.fn(),
  };
  const articleRelations = {
    create: vi.fn(),
  };
  const compatibility = {
    create: vi.fn(),
    update: vi.fn(),
    getAdmin: vi.fn(),
  };
  const assets = {
    create: vi.fn(),
  };
  const validation = {
    validate: vi.fn(),
  };

  const service = new SellerArticleService(
    database as unknown as DatabaseService,
    sellers as unknown as SellerService,
    schemas as unknown as CatalogSchemaService,
    products as unknown as ProductService,
    identity as unknown as ProductIdentityService,
    articleIdentifiers as unknown as ArticleIdentifierService,
    articleRelations as unknown as ArticleRelationService,
    compatibility as unknown as CompatibilityService,
    assets as unknown as ProductAssetService,
    validation as unknown as ArticleValidationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    sellers.requireOperationalSellerByUser.mockResolvedValue({ id: sellerId });
    category.findMany.mockResolvedValue([]);
    productFamily.findMany.mockResolvedValue([]);
    productType.findFirst.mockResolvedValue({
      id: productTypeId,
      name: 'Brake Pad',
      currentSchemaVersion: { schemaVersion: 4 },
    });
    brand.findUnique.mockResolvedValue({ name: 'Bosch' });
    partNumber.findFirst.mockResolvedValue(null);
    products.create.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
    });
    products.getAdmin.mockResolvedValue({
      id: articleId,
      name: 'Bosch Brake Pad',
      productTypeId,
      version: 3,
      status: ProductStatus.DRAFT,
      values: { HEIGHT: 65, INTERNAL_CODE: 'ADMIN-OWNED' },
      shortDescription: null,
      description: null,
      manufacturerNotes: null,
    });
    products.update.mockResolvedValue({
      id: articleId,
      name: 'Bosch Brake Pad',
      productTypeId,
      version: 4,
      status: ProductStatus.DRAFT,
      values: { HEIGHT: 75, INTERNAL_CODE: 'ADMIN-OWNED' },
      shortDescription: 'Updated',
      description: null,
      manufacturerNotes: null,
    });
    product.findFirst.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt: null,
      schemaVersion: { snapshot },
    });
    product.updateMany.mockResolvedValue({ count: 1 });
    vehicleCompatibility.findFirst.mockResolvedValue(null);
    vehicleCompatibility.count.mockResolvedValue(0);
    auditLog.create.mockResolvedValue({ id: 'audit-id' });
    auditLog.findMany.mockResolvedValue([]);
  });

  it('fetches active Categories and Part Groups directly, even when no Product Types are published', async () => {
    const catId = '22222222-2222-4222-8222-222222222222';
    const groupId = '33333333-3333-4333-8333-333333333333';
    category.findMany.mockResolvedValue([{ id: catId, name: 'Brakes' }]);
    productFamily.findMany.mockResolvedValue([{ id: groupId, categoryId: catId, name: 'Brake Pads' }]);
    productType.findMany.mockResolvedValue([]);

    const [classification, types] = await Promise.all([
      service.listClassification(userId),
      service.listProductTypes(userId),
    ]);

    expect(classification).toEqual({
      categories: [{ id: catId, name: 'Brakes' }],
      partGroups: [{ id: groupId, categoryId: catId, name: 'Brake Pads' }],
    });
    expect(types).toEqual([]);
    expect(category.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: MasterDataStatus.ACTIVE },
    }));
    expect(productFamily.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: MasterDataStatus.ACTIVE, category: { status: MasterDataStatus.ACTIVE } },
    }));
    expect(productType.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: MasterDataStatus.ACTIVE,
        category: { status: MasterDataStatus.ACTIVE },
        productFamily: { status: MasterDataStatus.ACTIVE },
        currentSchemaVersionId: { not: null },
      }),
    }));
  });

  it('returns the latest Admin correction feedback with an unlocked Seller Draft', async () => {
    const feedbackAt = new Date('2026-10-07T06:30:00.000Z');
    product.findMany.mockResolvedValue([
      {
        id: articleId,
        productTypeId,
        brandId,
        name: 'Bosch Brake Pad',
        status: ProductStatus.DRAFT,
        submittedAt: new Date('2026-10-07T05:00:00.000Z'),
        catalogReviewSubmittedAt: null,
        publishedAt: null,
        schemaVersion: { schemaVersion: 4 },
      },
    ]);
    auditLog.findMany.mockResolvedValue([
      {
        entityId: articleId,
        metadata: {
          reason: 'Verify the OE reference before resubmitting.',
        },
        createdAt: feedbackAt,
      },
    ]);

    const result = await service.listOwnSubmissions(userId);

    expect(auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: 'SELLER_ARTICLE_RETURNED_FOR_CHANGES',
        entityType: 'Product',
        entityId: { in: [articleId] },
      },
      select: {
        entityId: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(result[0]).toMatchObject({
      id: articleId,
      reviewFeedback: 'Verify the OE reference before resubmitting.',
      reviewFeedbackAt: feedbackAt,
    });
  });

  function mockEditableDraft() {
    product.findFirst.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt: null,
      schemaVersion: {
        snapshot: {
          ...snapshot,
          attributes: [
            { code: 'HEIGHT', name: 'Height', sellerEditable: true, displayMode: 'VISIBLE' },
            { code: 'INTERNAL_CODE', name: 'Internal Code', sellerEditable: false, displayMode: 'HIDDEN' },
          ],
        },
      },
    });
  }

  it('lets only the owning Seller read their editable Draft fields, not hidden Admin attributes', async () => {
    mockEditableDraft();
    const result = await service.getOwnDraftDetails(articleId, userId);
    expect(sellers.requireOperationalSellerByUser).toHaveBeenCalledWith(userId);
    expect(product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: articleId, sourceSellerId: sellerId, articleSource: ArticleSource.SELLER_SUBMISSION }),
    }));
    expect(result.article.values).toEqual({ HEIGHT: 65 });
    expect(result.attributes).toEqual([expect.objectContaining({ code: 'HEIGHT' })]);
  });

  it('updates only authorized technical values while preserving Admin-managed values and version checks', async () => {
    mockEditableDraft();
    await service.updateOwnDraft(articleId, { version: 3, values: { HEIGHT: 75 }, shortDescription: 'Updated' }, userId);
    expect(products.update).toHaveBeenCalledWith(articleId, expect.objectContaining({
      version: 3,
      values: { HEIGHT: 75, INTERNAL_CODE: 'ADMIN-OWNED' },
      shortDescription: 'Updated',
    }), userId);
  });

  it('rejects edits to hidden attributes and arbitrary unbound codes', async () => {
    mockEditableDraft();
    for (const code of ['INTERNAL_CODE', 'INJECTED_ATTRIBUTE']) {
      await expect(service.updateOwnDraft(articleId, {
        version: 3, values: { [code]: 'ATTACK' },
      }, userId)).rejects.toMatchObject({
        response: { code: 'SELLER_ARTICLE_ATTRIBUTE_NOT_EDITABLE' },
      });
    }
    expect(products.update).not.toHaveBeenCalled();
  });

  it('does not read or edit another Seller account’s Draft', async () => {
    product.findFirst.mockResolvedValue(null);
    await expect(service.getOwnDraftDetails(articleId, userId)).rejects.toMatchObject({
      response: { code: 'SELLER_ARTICLE_SUBMISSION_NOT_FOUND' },
    });
    await expect(service.updateOwnDraft(articleId, { version: 3, values: {} }, userId)).rejects.toMatchObject({
      response: { code: 'SELLER_ARTICLE_SUBMISSION_NOT_FOUND' },
    });
    expect(products.getAdmin).not.toHaveBeenCalled();
    expect(products.update).not.toHaveBeenCalled();
  });

  it('propagates a stale-version conflict without overwriting another update', async () => {
    mockEditableDraft();
    products.update.mockRejectedValueOnce(new ConflictException({
      code: 'PRODUCT_VERSION_CONFLICT',
      message: 'Reload the Article before trying again.',
    }));
    await expect(service.updateOwnDraft(articleId, {
      version: 2, values: { HEIGHT: 75 },
    }, userId)).rejects.toMatchObject({
      response: { code: 'PRODUCT_VERSION_CONFLICT' },
    });
  });

  it('blocks technical editing when Seller Draft review has already started', async () => {
    product.findFirst.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt: new Date(),
      schemaVersion: { snapshot },
    });
    await expect(service.updateOwnDraft(articleId, {
      version: 3, values: { HEIGHT: 80 },
    }, userId)).rejects.toMatchObject({ response: { code: 'SELLER_ARTICLE_NOT_EDITABLE' } });
    expect(products.update).not.toHaveBeenCalled();
  });

  it('creates a Draft Manufacturer Article with Seller submission provenance', async () => {
    const result = await service.submit(
      {
        productTypeId,
        brandId,
        manufacturerPartNumber: '0 986 494 596',
        sourceReference: 'seller-catalog-42',
        values: { ATTR_MATERIAL: 'CERAMIC' },
      },
      userId,
    );

    expect(products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productTypeId,
        schemaVersion: 4,
        brandId,
        manufacturerPartNumber: '0 986 494 596',
        name: 'Bosch · 0 986 494 596 · Brake Pad',
        values: { ATTR_MATERIAL: 'CERAMIC' },
      }),
      {
        actorId: userId,
        source: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: sellerId,
        sourceReference: 'seller-catalog-42',
      },
    );
    expect(result).toEqual({
      resolution: 'CREATED_DRAFT',
      articleId,
      productTypeId,
      status: ProductStatus.DRAFT,
      reused: false,
      canPrepareOffer: true,
        canSubmitOffer: false,
      requiresCatalogReview: true,
      catalogReviewSubmittedAt: null,
      message:
        'A Draft Manufacturer Article was created. Add the required technical evidence, check readiness, then submit it for catalog review.',
    });
  });

  it('reuses an existing Active canonical Article instead of creating a duplicate', async () => {
    partNumber.findFirst.mockResolvedValue({
      product: {
        id: articleId,
        productTypeId,
        status: ProductStatus.ACTIVE,
        articleSource: ArticleSource.APPROVED_CATALOG_IMPORT,
        sourceSellerId: null,
      },
    });

    const result = await service.submit(
      {
        productTypeId,
        brandId,
        manufacturerPartNumber: '0 986 494 596',
        values: {},
      },
      userId,
    );

    expect(products.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      resolution: 'REUSED_ACTIVE',
      articleId,
      status: ProductStatus.ACTIVE,
      reused: true,
      canPrepareOffer: true,
      canSubmitOffer: true,
      requiresCatalogReview: false,
    });
  });

  it('does not expose another Seller Draft as editable when the identity already exists', async () => {
    partNumber.findFirst.mockResolvedValue({
      product: {
        id: articleId,
        productTypeId,
        status: ProductStatus.DRAFT,
        articleSource: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: '11111111-1111-4111-8111-111111111111',
      },
    });

    const result = await service.submit(
      {
        productTypeId,
        brandId,
        manufacturerPartNumber: '0 986 494 596',
        values: {},
      },
      userId,
    );

    expect(result).toMatchObject({
      resolution: 'EXISTING_REVIEW_REQUIRED',
      articleId,
      reused: true,
      canPrepareOffer: false,
        canSubmitOffer: false,
      requiresCatalogReview: true,
    });
    expect(products.create).not.toHaveBeenCalled();
  });

  it('resolves canonical Brand + MPN before Seller technical entry', async () => {
    partNumber.findFirst.mockResolvedValue({
      product: {
        id: articleId,
        productTypeId,
        status: ProductStatus.ACTIVE,
        articleSource: ArticleSource.APPROVED_CATALOG_IMPORT,
        sourceSellerId: null,
        catalogReviewSubmittedAt: null,
      },
    });

    const result = await service.resolveIdentity(
      {
        brandId,
        manufacturerPartNumber: '0 986 494 596',
      },
      userId,
    );

    expect(result).toMatchObject({
      resolution: 'REUSED_ACTIVE',
      articleId,
      reused: true,
      canSubmitOffer: true,
    });
    expect(products.create).not.toHaveBeenCalled();
  });

  it('does not reopen an own Draft that is already submitted for review', async () => {
    const reviewSubmittedAt = new Date('2026-10-07T05:30:00.000Z');
    partNumber.findFirst.mockResolvedValue({
      product: {
        id: articleId,
        productTypeId,
        status: ProductStatus.DRAFT,
        articleSource: ArticleSource.SELLER_SUBMISSION,
        sourceSellerId: sellerId,
        catalogReviewSubmittedAt: reviewSubmittedAt,
      },
    });

    const result = await service.resolveIdentity(
      {
        brandId,
        manufacturerPartNumber: '0 986 494 596',
      },
      userId,
    );

    expect(result).toMatchObject({
      resolution: 'REUSED_OWN_REVIEW',
      articleId,
      catalogReviewSubmittedAt: reviewSubmittedAt,
      canSubmitOffer: false,
    });
  });

  it('counts Seller-submitted fitment as Seller review evidence without treating it as activation verification', async () => {
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: false,
      qualityScore: 85,
      qualityBand: 'GOOD',
      schemaVersion: 4,
      schemaHash: 'schema-hash',
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
          message: 'At least one verified fitment is required.',
        },
      ],
    });
    vehicleCompatibility.count.mockResolvedValue(1);

    const result = await service.validateSubmission(articleId, userId);

    expect(result.readyForReview).toBe(true);
    expect(result.summary.fitmentEvidenceCount).toBe(1);
    expect(result.summary.verifiedFitmentCount).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it('scores a missing required GTIN as incomplete Seller review evidence', async () => {
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: false,
      qualityScore: 90,
      qualityBand: 'GOOD',
      schemaVersion: 4,
      schemaHash: 'schema-hash',
      summary: {
        identifierCount: 1,
        gtinCount: 0,
        oeReferenceCount: 0,
        crossReferenceCount: 0,
        verifiedFitmentCount: 0,
        imageCount: 1,
        documentCount: 0,
      },
      issues: [
        {
          code: 'ARTICLE_GTIN_REQUIRED',
          area: 'GTIN',
          message: 'At least one GTIN is required.',
        },
      ],
    });
    vehicleCompatibility.count.mockResolvedValue(0);

    const result = await service.validateSubmission(articleId, userId);

    expect(result.readyForReview).toBe(false);
    expect(result.qualityScore).toBe(90);
    expect(result.qualityBand).toBe('GOOD');
  });

  it('submits a ready Seller Draft for catalog review and locks further technical edits', async () => {
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: false,
      qualityScore: 85,
      qualityBand: 'GOOD',
      schemaVersion: 4,
      schemaHash: 'schema-hash',
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
          message: 'At least one verified fitment is required.',
        },
      ],
    });
    vehicleCompatibility.count.mockResolvedValue(1);

    const result = await service.submitForReview(articleId, userId);

    expect(result.catalogReviewSubmittedAt).toBeInstanceOf(Date);
    expect(product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: articleId,
          status: ProductStatus.DRAFT,
          catalogReviewSubmittedAt: null,
        },
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SELLER_ARTICLE_SUBMITTED_FOR_REVIEW',
        entityType: 'Product',
        entityId: articleId,
      }),
    });

    product.findFirst.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt: result.catalogReviewSubmittedAt,
      schemaVersion: { snapshot },
    });

    await expect(
      service.addDirectIdentifier(
        articleId,
        {
          type: ArticleIdentifierType.GTIN_13,
          value: '4006381333931',
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_ARTICLE_NOT_EDITABLE' },
    });
  });

  it('submits Article relations only as Draft catalog evidence', async () => {
    articleRelations.create.mockResolvedValue({
      id: 'relation-id',
      sourceArticleId: articleId,
      targetArticleId: '11111111-1111-4111-8111-111111111111',
      type: ArticleRelationType.CONTAINS,
      componentQuantity: 2,
      componentRole: 'Seal',
      componentOrder: 1,
      status: MasterDataStatus.DRAFT,
      version: 1,
    });

    await service.addRelation(
      articleId,
      {
        targetArticleId: '11111111-1111-4111-8111-111111111111',
        type: ArticleRelationType.CONTAINS,
        componentQuantity: 2,
        componentRole: ' Seal ',
        componentOrder: 1,
      },
      userId,
    );

    expect(articleRelations.create).toHaveBeenCalledWith(
      articleId,
      {
        targetArticleId: '11111111-1111-4111-8111-111111111111',
        type: ArticleRelationType.CONTAINS,
        componentQuantity: 2,
        componentRole: 'Seal',
        componentOrder: 1,
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  });

  it('creates exact fitment only as Draft Seller-submitted evidence', async () => {
    compatibility.create.mockResolvedValue({ id: 'fitment-id' });

    await service.addExactFitment(
      articleId,
      {
        vehicleConfigurationId: configurationId,
        position: 'FRONT',
      },
      userId,
    );

    expect(compatibility.create).toHaveBeenCalledWith(
      {
        productId: articleId,
        vehicleConfigurationId: configurationId,
        fitmentType: 'EXACT',
        source: CompatibilitySource.SELLER,
        verificationStatus:
          CompatibilityVerificationStatus.SELLER_SUBMITTED,
        status: MasterDataStatus.DRAFT,
        position: 'FRONT',
      },
      userId,
    );
  });

  it('passes structured linkage criteria through Seller Draft fitment submission', async () => {
    compatibility.create.mockResolvedValue({ id: 'fitment-id' });

    await service.addExactFitment(
      articleId,
      {
        vehicleConfigurationId: configurationId,
        criteria: [
          {
            type: CompatibilityCriterionType.ENGINE_CODE,
            textValue: '2ZR-FE',
          },
        ],
      },
      userId,
    );

    expect(compatibility.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: articleId,
        vehicleConfigurationId: configurationId,
        criteria: [
          {
            type: CompatibilityCriterionType.ENGINE_CODE,
            textValue: '2ZR-FE',
          },
        ],
        status: MasterDataStatus.DRAFT,
      }),
      userId,
    );
  });

  it('updates an existing Seller Draft fitment instead of silently dropping new criteria', async () => {
    vehicleCompatibility.findFirst.mockResolvedValue({ id: 'fitment-id' });
    compatibility.getAdmin.mockResolvedValue({
      id: 'fitment-id',
      version: 3,
    });
    compatibility.update.mockResolvedValue({
      id: 'fitment-id',
      version: 4,
    });

    await service.addExactFitment(
      articleId,
      {
        vehicleConfigurationId: configurationId,
        criteria: [
          {
            type: CompatibilityCriterionType.ENGINE_CODE,
            textValue: '2ZR-FE',
          },
        ],
      },
      userId,
    );

    expect(compatibility.update).toHaveBeenCalledWith(
      'fitment-id',
      {
        version: 3,
        criteria: [
          {
            type: CompatibilityCriterionType.ENGINE_CODE,
            textValue: '2ZR-FE',
          },
        ],
      },
      userId,
    );
    expect(compatibility.create).not.toHaveBeenCalled();
  });

  it('blocks fitment when the bound immutable schema says not applicable', async () => {
    product.findFirst.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt: null,
      schemaVersion: {
        snapshot: {
          ...snapshot,
          articleRequirements: {
            ...snapshot.articleRequirements,
            fitment: ProductTypeRequirementLevel.NOT_APPLICABLE,
          },
        },
      },
    });

    await expect(
      service.addExactFitment(
        articleId,
        { vehicleConfigurationId: configurationId },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_ARTICLE_FITMENT_NOT_APPLICABLE' },
    });

    expect(compatibility.create).not.toHaveBeenCalled();
  });

  it('adds GTIN/trade identifiers as Draft canonical Article data', async () => {
    articleIdentifiers.create.mockResolvedValue({
      id: 'direct-identifier-id',
      productId: articleId,
      type: ArticleIdentifierType.GTIN_13,
      value: '4006381333931',
      normalizedValue: '4006381333931',
      status: MasterDataStatus.DRAFT,
      version: 1,
    });

    await service.addDirectIdentifier(
      articleId,
      {
        type: ArticleIdentifierType.GTIN_13,
        value: '4006381333931',
      },
      userId,
    );

    expect(articleIdentifiers.create).toHaveBeenCalledWith(
      articleId,
      {
        type: ArticleIdentifierType.GTIN_13,
        value: '4006381333931',
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  });

  it('rejects GTIN entry when the Product Type marks GTIN not applicable while still allowing trade numbers', async () => {
    product.findFirst.mockResolvedValue({
      id: articleId,
      status: ProductStatus.DRAFT,
      catalogReviewSubmittedAt: null,
      schemaVersion: {
        snapshot: {
          ...snapshot,
          articleRequirements: {
            ...snapshot.articleRequirements,
            gtin: ProductTypeRequirementLevel.NOT_APPLICABLE,
          },
        },
      },
    });

    await expect(
      service.addDirectIdentifier(
        articleId,
        {
          type: ArticleIdentifierType.GTIN_13,
          value: '4006381333931',
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'SELLER_ARTICLE_GTIN_NOT_APPLICABLE' },
    });

    await service.addDirectIdentifier(
      articleId,
      {
        type: ArticleIdentifierType.TRADE_NUMBER,
        value: 'TRADE-42',
      },
      userId,
    );

    expect(articleIdentifiers.create).toHaveBeenCalledWith(
      articleId,
      expect.objectContaining({
        type: ArticleIdentifierType.TRADE_NUMBER,
        value: 'TRADE-42',
      }),
      userId,
    );
  });

  it('keeps the canonical Manufacturer identity immutable after Draft creation', async () => {
    await expect(
      service.addIdentifier(
        articleId,
        {
          partNumber: 'NEW-MPN',
          type: PartNumberType.MANUFACTURER,
        },
        userId,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'SELLER_ARTICLE_MANUFACTURER_IDENTITY_IMMUTABLE',
      },
    });

    expect(identity.createPartNumber).not.toHaveBeenCalled();
  });

  it('adds seller image evidence as Draft Article data, never commercial Offer data', async () => {
    assets.create.mockResolvedValue({ id: 'asset-id' });

    await service.addAsset(
      articleId,
      {
        type: ProductAssetType.IMAGE,
        title: 'Front package photo',
        storageReference: 'seller/article/front.jpg',
        mimeType: 'image/jpeg',
      },
      userId,
    );

    expect(assets.create).toHaveBeenCalledWith(
      articleId,
      {
        type: ProductAssetType.IMAGE,
        title: 'Front package photo',
        storageReference: 'seller/article/front.jpg',
        mimeType: 'image/jpeg',
        visibility: 'PUBLIC',
        status: MasterDataStatus.DRAFT,
      },
      userId,
    );
  });
});
