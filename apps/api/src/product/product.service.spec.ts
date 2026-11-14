import {
  ArticleRelationType,
  ArticleSource,
  AttributeDataType,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  ProductStatus,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import type { CatalogSchemaValidationService } from '../catalog/catalog-schema-validation.service.js';
import type { CatalogSchemaService } from '../catalog/catalog-schema.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ArticleValidationService } from './article-validation.service.js';
import { CatalogArticleImportFileFormat } from './dto/catalog-article-import.dto.js';
import { ProductService } from './product.service.js';

describe('ProductService', () => {
  const product = {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const productAttributeValue = {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const partNumber = {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const articleIdentifier = { updateMany: vi.fn() };
  const productAsset = { updateMany: vi.fn() };
  const vehicleCompatibility = { updateMany: vi.fn() };
  const articleRelation = { findFirst: vi.fn() };
  const sellerListing = { findFirst: vi.fn() };
  const supplierOffer = { findFirst: vi.fn() };
  const productFamily = { findUnique: vi.fn() };
  const productType = { findUnique: vi.fn() };
  const category = { findUnique: vi.fn() };
  const seller = { findUnique: vi.fn() };
  const brand = { findUnique: vi.fn() };
  const auditLog = { create: vi.fn() };
  const catalogArticleImportJob = {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  };
  const adminImportJob = { create: vi.fn() };
  const database = {
    product,
    productAttributeValue,
    productFamily,
    productType,
    category,
    seller,
    brand,
    partNumber,
    articleIdentifier,
    productAsset,
    vehicleCompatibility,
    articleRelation,
    sellerListing,
    supplierOffer,
    auditLog,
    catalogArticleImportJob,
    adminImportJob,
    $transaction: vi.fn(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          product,
          productAttributeValue,
          partNumber,
          articleIdentifier,
          productAsset,
          vehicleCompatibility,
          articleRelation,
          sellerListing,
          supplierOffer,
          auditLog,
          catalogArticleImportJob,
          adminImportJob,
        }),
    ),
  };

  const schemas = {
    getPublishedSchemaVersion: vi.fn(),
  };
  const validation = {
    validatePublishedSchema: vi.fn(),
  };
  const articleValidation = {
    assertReadyForActivation: vi.fn(),
  };

  const service = new ProductService(
    database as unknown as DatabaseService,
    schemas as unknown as CatalogSchemaService,
    validation as unknown as CatalogSchemaValidationService,
    articleValidation as unknown as ArticleValidationService,
  );

  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const categoryId = '11111111-1111-4111-8111-111111111111';
  const partGroupId = '22222222-2222-4222-8222-222222222222';
  const productTypeId = '44444444-4444-4444-8444-444444444444';
  const schemaId = '88888888-8888-4888-8888-888888888888';
  const productId = '99999999-9999-4999-8999-999999999999';
  const fuelAttributeId = '55555555-5555-4555-8555-555555555555';
  const quantityAttributeId = '66666666-6666-4666-8666-666666666666';
  const createdAt = new Date('2026-09-27T19:00:00.000Z');

  const schema = {
    id: schemaId,
    productTypeId,
    schemaVersion: 2,
    schemaHash: 'a'.repeat(64),
    publishedAt: new Date('2026-09-27T18:00:00.000Z'),
    snapshot: {
      schemaKind: 'PRODUCT_TYPE_SCHEMA',
      contractVersion: 2,
      productType: {
        id: productTypeId,
        categoryId,
        productFamilyId: partGroupId,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        slug: 'brake-pad',
      },
      articleRequirements: {
        brand: ProductTypeRequirementLevel.OPTIONAL,
        identifier: ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
        oeReference: ProductTypeRequirementLevel.OPTIONAL,
        crossReference: ProductTypeRequirementLevel.OPTIONAL,
        fitment: ProductTypeRequirementLevel.REQUIRED,
        image: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 1,
        document: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
      },
      offerRequirements: {
        price: ProductTypeRequirementLevel.REQUIRED,
        stock: ProductTypeRequirementLevel.REQUIRED,
        condition: ProductTypeRequirementLevel.REQUIRED,
        warranty: ProductTypeRequirementLevel.OPTIONAL,
      },
      attributes: [
        {
          attributeId: fuelAttributeId,
          code: 'ATTR_FUEL_TYPE',
          dataType: AttributeDataType.SELECT,
          valueSource: 'STATIC',
          unit: null,
          requirement: 'MANDATORY',
        },
        {
          attributeId: quantityAttributeId,
          code: 'ATTR_QUANTITY',
          dataType: AttributeDataType.INTEGER,
          valueSource: 'NONE',
          unit: 'piece',
          requirement: 'OPTIONAL',
        },
      ],
    },
  };

  const persisted = {
    id: productId,
    categoryId,
    productFamilyId: partGroupId,
    productTypeId,
    schemaVersionId: schemaId,
    brandId: null,
    brandRequirement: ProductTypeRequirementLevel.OPTIONAL,
    unitOfMeasureId: null,
    packQuantity: null,
    name: 'Brake Pad Set',
    shortDescription: null,
    description: 'Validated canonical product',
    manufacturerNotes: null,
    articleSource: ArticleSource.PLATFORM_MIGRATION,
    sourceSellerId: null,
    sourceReference: null,
    submittedAt: createdAt,
    publishedAt: null,
    status: ProductStatus.DRAFT,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    schemaVersion: {
      schemaVersion: 2,
      schemaHash: 'a'.repeat(64),
    },
    attributeValues: [
      {
        valueString: 'DIESEL',
        valueNumeric: null,
        valueBoolean: null,
        valueReferenceId: null,
        valueJson: null,
        attribute: { code: 'ATTR_FUEL_TYPE' },
      },
      {
        valueString: null,
        valueNumeric: 4,
        valueBoolean: null,
        valueReferenceId: null,
        valueJson: null,
        attribute: { code: 'ATTR_QUANTITY' },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    product.count.mockResolvedValue(0);
    schemas.getPublishedSchemaVersion.mockResolvedValue(schema);
    articleValidation.assertReadyForActivation.mockResolvedValue({
      readyForActivation: true,
    });
    validation.validatePublishedSchema.mockReturnValue({
      valid: true,
      schemaVersion: 2,
      schemaHash: 'a'.repeat(64),
      requiredAttributeCodes: ['ATTR_FUEL_TYPE'],
      issues: [],
    });
    product.create.mockResolvedValue(persisted);
    product.findUnique.mockResolvedValue(persisted);
    productFamily.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    productType.findUnique.mockResolvedValue({
      categoryId,
      productFamilyId: partGroupId,
      currentSchemaVersionId: schemaId,
      status: MasterDataStatus.ACTIVE,
    });
    category.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    brand.findUnique.mockResolvedValue({
      status: MasterDataStatus.ACTIVE,
    });
    partNumber.findFirst.mockResolvedValue(null);
    articleIdentifier.updateMany.mockResolvedValue({ count: 0 });
    partNumber.updateMany.mockResolvedValue({ count: 0 });
    productAsset.updateMany.mockResolvedValue({ count: 0 });
    vehicleCompatibility.updateMany.mockResolvedValue({ count: 0 });
    articleRelation.findFirst.mockResolvedValue(null);
    sellerListing.findFirst.mockResolvedValue(null);
    supplierOffer.findFirst.mockResolvedValue(null);
    partNumber.create.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      productId,
      issuerBrandId: null,
      partNumber: '0 986 494 123',
      rawPartNumber: '0 986 494 123',
      normalizedPartNumber: '0986494123',
      type: 'MANUFACTURER',
      isPrimary: true,
      status: MasterDataStatus.DRAFT,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    });
    productAttributeValue.createMany.mockResolvedValue({ count: 2 });
    productAttributeValue.deleteMany.mockResolvedValue({ count: 2 });
    product.update.mockResolvedValue({
      ...persisted,
      version: 2,
    });
    auditLog.create.mockResolvedValue({});
    catalogArticleImportJob.findUnique.mockResolvedValue(null);
    catalogArticleImportJob.create.mockResolvedValue({
      id: 'abababab-abab-4aba-8aba-abababababab',
    });
    adminImportJob.create.mockResolvedValue({});
    catalogArticleImportJob.findMany.mockResolvedValue([]);
  });

  it('requires duplicate review before persisting a no-MPN Article and records an explanation', async () => {
    product.count.mockResolvedValue(1);
    const input = { productTypeId, schemaVersion: 2, name: 'Brake pad', values: { ATTR_FUEL_TYPE: 'DIESEL' } };
    const context = { actorId, source: ArticleSource.PLATFORM_MIGRATION };
    await expect(service.create(input, context)).rejects.toMatchObject({ response: { code: 'ARTICLE_DUPLICATE_REVIEW_REQUIRED' } });
    expect(product.create).not.toHaveBeenCalled();
    await service.create({ ...input, duplicateReviewReason: 'A different manufacturer part with identical dimensions.' }, context);
    expect(product.create).toHaveBeenCalledTimes(1);
    expect(auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      metadata: expect.objectContaining({ duplicateReviewReason: 'A different manufacturer part with identical dimensions.' }),
    }) }));
  });

  it('limits preflight identities to approved Articles and the requesting Seller’s own drafts', async () => {
    seller.findUnique.mockResolvedValue({ userId: actorId, status: 'ACTIVE', approvalStatus: 'APPROVED', verificationStatus: 'VERIFIED' });
    product.count.mockResolvedValue(1);
    product.findMany.mockResolvedValue([]);
    const result = await service.previewDuplicateCandidates({ productTypeId, schemaVersion: 2, name: 'Brake pad',
      values: { ATTR_FUEL_TYPE: 'DIESEL' } }, { actorId, source: ArticleSource.SELLER_SUBMISSION, sourceSellerId: '12121212-1212-4121-8121-121212121212' });
    expect(result).toEqual({ reviewRequired: true, candidates: [] });
    expect(product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [expect.any(Object), { OR: [
        { status: ProductStatus.ACTIVE },
        { sourceSellerId: '12121212-1212-4121-8121-121212121212', status: ProductStatus.DRAFT },
      ] }] },
    }));
    expect(product.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productTypeId }) }));
  });

  it('creates a DRAFT Product bound to the exact validated schema version', async () => {
    const result = await service.create(
      {
        productTypeId,
        schemaVersion: 2,
        name: ' Brake Pad Set ',
        description: ' Validated canonical product ',
        values: {
          ATTR_FUEL_TYPE: 'DIESEL',
          ATTR_QUANTITY: 4,
        },
      },
      { actorId, source: ArticleSource.PLATFORM_MIGRATION },
    );

    expect(schemas.getPublishedSchemaVersion).toHaveBeenCalledWith(
      productTypeId,
      2,
    );
    expect(validation.validatePublishedSchema).toHaveBeenCalledWith(
      schema,
      { ATTR_FUEL_TYPE: 'DIESEL', ATTR_QUANTITY: 4 },
      { skipSellerMediaRequirements: true },
    );
    expect(product.create).toHaveBeenCalledWith({
      data: {
        categoryId,
        productFamilyId: partGroupId,
        productTypeId,
        schemaVersionId: schemaId,
        identityFingerprint: null,
        brandRequirement: ProductTypeRequirementLevel.OPTIONAL,
        identifierRequirement: ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
        gtinRequirement: ProductTypeRequirementLevel.OPTIONAL,
        oemReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
        crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
        fitmentRequirement: ProductTypeRequirementLevel.REQUIRED,
        imageRequirement: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 1,
        maximumImageCount: 20,
        documentRequirement: ProductTypeRequirementLevel.OPTIONAL,
        minimumDocumentCount: 0,
        priceRequirement: ProductTypeRequirementLevel.REQUIRED,
        stockRequirement: ProductTypeRequirementLevel.REQUIRED,
        conditionRequirement: ProductTypeRequirementLevel.REQUIRED,
        warrantyRequirement: ProductTypeRequirementLevel.OPTIONAL,
        name: 'Brake Pad Set',
        shortDescription: null,
        description: 'Validated canonical product',
        manufacturerNotes: null,
        articleSource: ArticleSource.PLATFORM_MIGRATION,
        sourceSellerId: null,
        sourceReference: null,
        status: ProductStatus.DRAFT,
        createdById: actorId,
        updatedById: actorId,
      },
      select: expect.objectContaining({
        id: true,
        version: true,
        status: true,
        schemaVersion: {
          select: { schemaVersion: true },
        },
      }),
    });
    expect(productAttributeValue.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          productId,
          attributeId: fuelAttributeId,
          valueString: 'DIESEL',
        }),
        expect.objectContaining({
          productId,
          attributeId: quantityAttributeId,
          valueNumeric: 4,
          unit: 'piece',
        }),
      ]),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_MASTER_CREATED',
          entityType: 'Product',
          entityId: productId,
          metadata: expect.objectContaining({
            after: expect.objectContaining({
              id: productId,
              version: 1,
              status: ProductStatus.DRAFT,
            }),
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      id: productId,
      schemaVersion: 2,
      values: {
        ATTR_FUEL_TYPE: 'DIESEL',
        ATTR_QUANTITY: 4,
      },
    });
  });

  it('creates the primary Manufacturer Part Number in the same transaction', async () => {
    const brandId = '77777777-7777-4777-8777-777777777777';

    await service.create(
      {
        productTypeId,
        schemaVersion: 2,
        brandId,
        manufacturerPartNumber: '0 986 494 123',
        name: 'Bosch Brake Pad Set 0 986 494 123',
        values: {
          ATTR_FUEL_TYPE: 'DIESEL',
          ATTR_QUANTITY: 4,
        },
      },
      { actorId, source: ArticleSource.PLATFORM_MIGRATION },
    );

    expect(partNumber.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId,
        issuerBrandId: brandId,
        partNumber: '0 986 494 123',
        rawPartNumber: '0 986 494 123',
        normalizedPartNumber: '0986494123',
        articleIdentityKey: brandId + ':0986494123',
        type: 'MANUFACTURER',
        isPrimary: true,
        status: MasterDataStatus.DRAFT,
        createdById: actorId,
        updatedById: actorId,
      }),
      select: expect.objectContaining({
        id: true,
        productId: true,
        version: true,
        status: true,
      }),
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PART_NUMBER_CREATED',
          entityType: 'PartNumber',
        }),
      }),
    );
  });

  it('rejects duplicate Manufacturer Article identity before persistence', async () => {
    const brandId = '77777777-7777-4777-8777-777777777777';
    partNumber.findFirst.mockResolvedValue({
      productId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });

    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          brandId,
          manufacturerPartNumber: '0 986-494-123',
          name: 'Duplicate Bosch Brake Pad',
          values: {
            ATTR_FUEL_TYPE: 'DIESEL',
            ATTR_QUANTITY: 4,
          },
        },
        { actorId, source: ArticleSource.PLATFORM_MIGRATION },
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_IDENTITY_ALREADY_EXISTS' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('blocks changing Brand while a non-archived supersession depends on it', async () => {
    const nextBrandId = '77777777-7777-4777-8777-777777777777';
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: '12121212-1212-4121-8121-121212121212',
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.ACTIVE,
      publishedAt: createdAt,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    partNumber.findFirst.mockResolvedValue(null);
    articleRelation.findFirst.mockResolvedValue({
      id: 'abababab-abab-4bab-8bab-abababababab',
    });

    await expect(
      service.update(
        productId,
        { version: 1, brandId: nextBrandId },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_BRAND_RELATION_IMMUTABLE' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('blocks moving an Active Article out of Active while a submitted Seller Listing exists', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: null,
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.ACTIVE,
      publishedAt: createdAt,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    sellerListing.findFirst.mockResolvedValue({
      id: '11111111-aaaa-4aaa-8aaa-111111111111',
      status: 'SUBMITTED',
    });

    await expect(
      service.update(
        productId,
        { version: 1, status: ProductStatus.INACTIVE },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_LIVE_COMMERCE_EXISTS' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('blocks Article deactivation while an Active Supplier Offer exists', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: null,
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.ACTIVE,
      publishedAt: createdAt,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    supplierOffer.findFirst.mockResolvedValue({
      id: '22222222-bbbb-4bbb-8bbb-222222222222',
    });

    await expect(
      service.update(
        productId,
        { version: 1, status: ProductStatus.DEPRECATED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_LIVE_COMMERCE_EXISTS' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('rechecks relation lifecycle inside the serializable Article update transaction', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: null,
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.ACTIVE,
      publishedAt: createdAt,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    articleRelation.findFirst.mockResolvedValue({
      id: 'efefefef-efef-4fef-8fef-efefefefefef',
      type: ArticleRelationType.RELATED,
    });

    await expect(
      service.update(
        productId,
        { version: 1, status: ProductStatus.INACTIVE },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_LIFECYCLE_CONFLICT' },
    });

    expect(database.$transaction).toHaveBeenCalled();
    expect(product.update).not.toHaveBeenCalled();
  });

  it('allows a superseded target Article to become Deprecated', async () => {
    product.findUnique
      .mockResolvedValueOnce({
        id: productId,
        productTypeId,
        productFamilyId: partGroupId,
        brandId: null,
        unitOfMeasureId: null,
        packQuantity: null,
        status: ProductStatus.ACTIVE,
        publishedAt: createdAt,
        version: 1,
        schemaVersion: { schemaVersion: 2 },
      })
      .mockResolvedValueOnce({
        ...persisted,
        status: ProductStatus.DEPRECATED,
        version: 2,
      });
    articleRelation.findFirst.mockResolvedValue(null);

    await service.update(
      productId,
      { version: 1, status: ProductStatus.DEPRECATED },
      actorId,
    );

    expect(articleRelation.findFirst).toHaveBeenCalledWith({
      where: {
        status: MasterDataStatus.ACTIVE,
        OR: [
          { sourceArticleId: productId },
          {
            targetArticleId: productId,
            type: {
              in: [
                ArticleRelationType.INTERCHANGEABLE,
                ArticleRelationType.RELATED,
              ],
            },
          },
        ],
      },
      select: { id: true, type: true },
    });
    expect(product.update).toHaveBeenCalled();
  });

  it('blocks deprecating an Article that is the Active superseding source', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: null,
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.ACTIVE,
      publishedAt: createdAt,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    articleRelation.findFirst.mockResolvedValue({
      id: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
      type: ArticleRelationType.SUPERSEDES,
    });

    await expect(
      service.update(
        productId,
        { version: 1, status: ProductStatus.DEPRECATED },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_RELATION_LIFECYCLE_CONFLICT' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('blocks changing Brand after a Manufacturer Part Number establishes identity', async () => {
    const nextBrandId = '77777777-7777-4777-8777-777777777777';
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: '12121212-1212-4121-8121-121212121212',
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.DRAFT,
      publishedAt: null,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    partNumber.findFirst.mockResolvedValue({ id: 'mpn-id' });

    await expect(
      service.update(
        productId,
        { version: 1, brandId: nextBrandId },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_BRAND_IDENTITY_IMMUTABLE' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('rejects a Product Type schema that has no Part Group', async () => {
    schemas.getPublishedSchemaVersion.mockResolvedValue({
      ...schema,
      snapshot: {
        ...schema.snapshot,
        productType: {
          ...schema.snapshot.productType,
          productFamilyId: null,
        },
      },
    });

    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          name: 'Brake Pad Set',
          values: {
            ATTR_FUEL_TYPE: 'DIESEL',
            ATTR_QUANTITY: 4,
          },
        },
        { actorId, source: ArticleSource.PLATFORM_MIGRATION },
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_SCHEMA_PART_GROUP_REQUIRED' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('does not persist Product data when schema validation fails', async () => {
    validation.validatePublishedSchema.mockReturnValue({
      valid: false,
      schemaVersion: 2,
      schemaHash: 'a'.repeat(64),
      requiredAttributeCodes: ['ATTR_FUEL_TYPE'],
      issues: [
        {
          code: 'VALUE_NOT_ALLOWED',
          attributeCode: 'ATTR_FUEL_TYPE',
          message: 'Not allowed',
        },
      ],
    });

    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          name: 'Brake Pad Set',
          values: { ATTR_FUEL_TYPE: 'INVALID' },
        },
        { actorId, source: ArticleSource.PLATFORM_MIGRATION },
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'PRODUCT_SCHEMA_VALIDATION_FAILED',
      },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('requires an explicit source Seller for Seller submissions', async () => {
    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          name: 'Brake Pad Set',
          values: {
            ATTR_FUEL_TYPE: 'DIESEL',
            ATTR_QUANTITY: 4,
          },
        },
        { actorId, source: ArticleSource.SELLER_SUBMISSION },
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_SOURCE_SELLER_REQUIRED' },
    });

    expect(schemas.getPublishedSchemaVersion).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('uses the published Article policy instead of unpublished live Product Type edits', async () => {
    schemas.getPublishedSchemaVersion.mockResolvedValue({
      ...schema,
      snapshot: {
        ...schema.snapshot,
        articleRequirements: {
          ...schema.snapshot.articleRequirements,
          brand: ProductTypeRequirementLevel.REQUIRED,
          identifier:
            ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
        },
      },
    });
    productType.findUnique.mockResolvedValue({
      categoryId,
      productFamilyId: partGroupId,
      currentSchemaVersionId: schemaId,
      status: MasterDataStatus.ACTIVE,
      brandRequirement: ProductTypeRequirementLevel.NOT_APPLICABLE,
      identifierRequirement: ProductTypeIdentifierRequirement.NOT_APPLICABLE,
    });

    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          name: 'Brake Pad Set',
          values: {
            ATTR_FUEL_TYPE: 'DIESEL',
            ATTR_QUANTITY: 4,
          },
        },
        { actorId, source: ArticleSource.PLATFORM_MIGRATION },
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_BRAND_REQUIRED' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('keeps legacy published Product Type policies readable', async () => {
    schemas.getPublishedSchemaVersion.mockResolvedValue({
      ...schema,
      snapshot: {
        productType: schema.snapshot.productType,
        requirements: {
          brand: ProductTypeRequirementLevel.OPTIONAL,
          identifier: ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
        },
        attributes: schema.snapshot.attributes,
      },
    });

    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          name: 'Brake Pad Set',
          values: {
            ATTR_FUEL_TYPE: 'DIESEL',
            ATTR_QUANTITY: 4,
          },
        },
        { actorId, source: ArticleSource.PLATFORM_MIGRATION },
      ),
    ).resolves.toMatchObject({ id: productId });
  });

  it('requires an Active Product Type before Manufacturer Article creation', async () => {
    productType.findUnique.mockResolvedValue({
      categoryId,
      productFamilyId: partGroupId,
      currentSchemaVersionId: schemaId,
      status: MasterDataStatus.INACTIVE,
    });

    await expect(
      service.create(
        {
          productTypeId,
          schemaVersion: 2,
          name: 'Brake Pad Set',
          values: {
            ATTR_FUEL_TYPE: 'DIESEL',
            ATTR_QUANTITY: 4,
          },
        },
        { actorId, source: ArticleSource.PLATFORM_MIGRATION },
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_PRODUCT_TYPE_NOT_ACTIVE' },
    });

    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('rejects stale optimistic Product updates', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      version: 3,
      schemaVersion: { schemaVersion: 2 },
    });

    await expect(
      service.update(
        productId,
        { version: 2, name: 'New name' },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PRODUCT_VERSION_CONFLICT' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('prevents Article Brand updates that violate the bound historical Product Type policy', async () => {
    const brandId = '77777777-7777-4777-8777-777777777777';
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId,
      brandRequirement: ProductTypeRequirementLevel.REQUIRED,
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.DRAFT,
      publishedAt: null,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    schemas.getPublishedSchemaVersion.mockResolvedValue({
      ...schema,
      snapshot: {
        ...schema.snapshot,
        articleRequirements: {
          ...schema.snapshot.articleRequirements,
          brand: ProductTypeRequirementLevel.REQUIRED,
        },
      },
    });

    await expect(
      service.update(
        productId,
        { version: 1, brandId: null },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_BRAND_REQUIRED' },
    });

    expect(product.update).not.toHaveBeenCalled();
  });

  it('revalidates a complete replacement value set against the bound historical schema', async () => {
    product.findUnique
      .mockResolvedValueOnce({
        id: productId,
        productTypeId,
        productFamilyId: partGroupId,
        brandId: null,
        unitOfMeasureId: null,
        packQuantity: null,
        status: ProductStatus.DRAFT,
        version: 1,
        schemaVersion: { schemaVersion: 2 },
      })
      .mockResolvedValueOnce({
        ...persisted,
        version: 2,
        name: 'Brake Pad Set Updated',
      });

    await service.update(
      productId,
      {
        version: 1,
        name: 'Brake Pad Set Updated',
        values: {
          ATTR_FUEL_TYPE: 'DIESEL',
          ATTR_QUANTITY: 6,
        },
      },
      actorId,
    );

    expect(schemas.getPublishedSchemaVersion).toHaveBeenCalledWith(
      productTypeId,
      2,
    );
    expect(productAttributeValue.deleteMany).toHaveBeenCalledWith({
      where: { productId },
    });
    expect(productAttributeValue.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          productId,
          attributeId: quantityAttributeId,
          valueNumeric: 6,
        }),
      ]),
    });
    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId, version: 1 },
        data: expect.objectContaining({
          name: 'Brake Pad Set Updated',
          version: { increment: 1 },
          updatedById: actorId,
        }),
      }),
    );
  });

  it('requires the centralized Article readiness check before activation', async () => {
    product.findUnique
      .mockResolvedValueOnce({
        id: productId,
        productTypeId,
        productFamilyId: partGroupId,
        brandId: null,
        unitOfMeasureId: null,
        packQuantity: null,
        status: ProductStatus.DRAFT,
        publishedAt: null,
        version: 1,
        schemaVersion: { schemaVersion: 2 },
      })
      .mockResolvedValueOnce({
        ...persisted,
        status: ProductStatus.ACTIVE,
        version: 2,
      });

    await service.update(
      productId,
      { version: 1, status: ProductStatus.ACTIVE },
      actorId,
      {
        action: 'SELLER_ARTICLE_REVIEW_APPROVED',
        metadata: {
          sourceSellerId: '12121212-1212-4121-8121-121212121212',
          previousVersion: 1,
          nextVersion: 2,
        },
      },
    );

    expect(articleValidation.assertReadyForActivation).toHaveBeenCalledWith(
      productId,
      { brandId: null },
    );
    expect(product.update).toHaveBeenCalled();
    expect(articleIdentifier.updateMany).toHaveBeenCalledWith({
      where: {
        productId,
        status: MasterDataStatus.DRAFT,
      },
      data: {
        status: MasterDataStatus.ACTIVE,
        version: { increment: 1 },
        updatedById: actorId,
        updatedAt: expect.any(Date),
      },
    });
    expect(partNumber.updateMany).toHaveBeenCalledWith({
      where: {
        productId,
        status: MasterDataStatus.DRAFT,
      },
      data: {
        status: MasterDataStatus.ACTIVE,
        version: { increment: 1 },
        updatedById: actorId,
        updatedAt: expect.any(Date),
      },
    });
    expect(productAsset.updateMany).toHaveBeenCalledWith({
      where: {
        productId,
        status: MasterDataStatus.DRAFT,
      },
      data: {
        status: MasterDataStatus.ACTIVE,
        version: { increment: 1 },
        updatedById: actorId,
        updatedAt: expect.any(Date),
      },
    });
    expect(vehicleCompatibility.updateMany).toHaveBeenCalledWith({
      where: {
        productId,
        status: MasterDataStatus.DRAFT,
        verificationStatus: {
          in: [
            CompatibilityVerificationStatus.VERIFIED,
            CompatibilityVerificationStatus.APPROVED,
          ],
        },
      },
      data: {
        status: MasterDataStatus.ACTIVE,
        version: { increment: 1 },
        updatedById: actorId,
        updatedAt: expect.any(Date),
      },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId,
        action: 'SELLER_ARTICLE_REVIEW_APPROVED',
        entityType: 'Product',
        entityId: productId,
        metadata: {
          sourceSellerId: '12121212-1212-4121-8121-121212121212',
          previousVersion: 1,
          nextVersion: 2,
        },
      },
    });
  });

  it('does not activate an Article when centralized readiness validation fails', async () => {
    product.findUnique.mockResolvedValue({
      id: productId,
      productTypeId,
      productFamilyId: partGroupId,
      brandId: null,
      unitOfMeasureId: null,
      packQuantity: null,
      status: ProductStatus.DRAFT,
      publishedAt: null,
      version: 1,
      schemaVersion: { schemaVersion: 2 },
    });
    articleValidation.assertReadyForActivation.mockRejectedValue(
      new Error('not ready'),
    );

    await expect(
      service.update(
        productId,
        { version: 1, status: ProductStatus.ACTIVE },
        actorId,
      ),
    ).rejects.toThrow('not ready');

    expect(product.update).not.toHaveBeenCalled();
  });

  it('publishes only ACTIVE Product Master records', async () => {
    product.findMany.mockResolvedValue([
      { ...persisted, status: ProductStatus.ACTIVE },
    ]);

    const result = await service.listPublished();

    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ProductStatus.ACTIVE },
      }),
    );
    expect(result[0]).toMatchObject({
      id: productId,
      status: ProductStatus.ACTIVE,
    });
  });

  it('previews normalized catalog imports with zero writes and detects duplicate canonical identities in the batch', async () => {
    const brandId = '77777777-7777-4777-8777-777777777777';

    const preview = await service.previewApprovedCatalogImport(
      {
        datasetReference: 'tec-source-2026-10',
        rows: [
          {
            rowKey: 'row-1',
            productTypeId,
            schemaVersion: 2,
            brandId,
            manufacturerPartNumber: '0 986 494 123',
            name: 'Bosch Brake Pad A',
            values: {
              ATTR_FUEL_TYPE: 'DIESEL',
              ATTR_QUANTITY: 4,
            },
          },
          {
            rowKey: 'row-2',
            productTypeId,
            schemaVersion: 2,
            brandId,
            manufacturerPartNumber: '0986494123',
            name: 'Bosch Brake Pad Duplicate',
            values: {
              ATTR_FUEL_TYPE: 'DIESEL',
              ATTR_QUANTITY: 4,
            },
          },
        ],
      },
      actorId,
    );

    expect(preview).toMatchObject({
      datasetReference: 'tec-source-2026-10',
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
    });
    expect(preview.rows[1]?.errors.join(' ')).toContain(
      'CATALOG_IMPORT_DUPLICATE_IDENTITY',
    );
    expect(product.create).not.toHaveBeenCalled();
    expect(productAttributeValue.createMany).not.toHaveBeenCalled();
  });

  it('reports existing canonical Article identity conflicts during preview', async () => {
    const brandId = '77777777-7777-4777-8777-777777777777';
    partNumber.findFirst.mockResolvedValue({ productId });

    const preview = await service.previewApprovedCatalogImport(
      {
        datasetReference: 'approved-catalog-17',
        rows: [
          {
            rowKey: 'existing-1',
            productTypeId,
            schemaVersion: 2,
            brandId,
            manufacturerPartNumber: '0 986 494 123',
            name: 'Existing Bosch Brake Pad',
            values: {
              ATTR_FUEL_TYPE: 'DIESEL',
              ATTR_QUANTITY: 4,
            },
          },
        ],
      },
      actorId,
    );

    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[0]?.errors.join(' ')).toContain(
      'ARTICLE_IDENTITY_ALREADY_EXISTS',
    );
    expect(product.create).not.toHaveBeenCalled();
  });

  it('revalidates and commits all clean approved-catalog rows in one serializable transaction', async () => {
    const firstId = '11111111-aaaa-4aaa-8aaa-111111111111';
    const secondId = '22222222-bbbb-4bbb-8bbb-222222222222';
    product.create
      .mockResolvedValueOnce({
        ...persisted,
        id: firstId,
        name: 'Imported Brake Pad A',
      })
      .mockResolvedValueOnce({
        ...persisted,
        id: secondId,
        name: 'Imported Brake Pad B',
      });

    const result = await service.commitApprovedCatalogImport(
      {
        datasetReference: 'approved-batch-2026-10-06',
        rows: [
          {
            rowKey: 'A-1',
            productTypeId,
            schemaVersion: 2,
            name: 'Imported Brake Pad A',
            values: {
              ATTR_FUEL_TYPE: 'DIESEL',
              ATTR_QUANTITY: 4,
            },
          },
          {
            rowKey: 'A-2',
            productTypeId,
            schemaVersion: 2,
            name: 'Imported Brake Pad B',
            values: {
              ATTR_FUEL_TYPE: 'DIESEL',
              ATTR_QUANTITY: 6,
            },
          },
        ],
      },
      actorId,
    );

    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(product.create).toHaveBeenCalledTimes(2);
    expect(product.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          articleSource: ArticleSource.APPROVED_CATALOG_IMPORT,
          sourceSellerId: null,
          sourceReference: 'approved-batch-2026-10-06',
          status: ProductStatus.DRAFT,
        }),
      }),
    );
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CATALOG_ARTICLE_IMPORT_COMMITTED',
          entityType: 'CatalogArticleImport',
          entityId: 'approved-batch-2026-10-06',
        }),
      }),
    );
    expect(result).toEqual({
      datasetReference: 'approved-batch-2026-10-06',
      createdCount: 2,
      items: [
        { rowKey: 'A-1', articleId: firstId },
        { rowKey: 'A-2', articleId: secondId },
      ],
    });
  });

  it('maps CSV source columns, applies corrections/exclusions and reports probable duplicates without writes', async () => {
    const brandId = '77777777-7777-4777-8777-777777777777';
    const csv = [
      'Type,Schema,Brand,MPN,Name,Fuel,Qty',
      'BRAKE_PAD,2,Bosch,BP-001,Front Brake Pad,DIESEL,4',
      'BRAKE_PAD,2,Bosch,BP-002,Front Brake Pad,DIESEL,4',
      'BRAKE_PAD,2,Bosch,BP-003,Excluded Pad,DIESEL,4',
    ].join('\n');

    const preview = await service.previewProfessionalCatalogImport(
      {
        datasetReference: 'catalog-file-2026-10',
        fileName: 'articles.csv',
        format: CatalogArticleImportFileFormat.CSV,
        fileBase64: Buffer.from(csv).toString('base64'),
        mapping: {
          productType: 'Type',
          schemaVersion: 'Schema',
          brand: 'Brand',
          manufacturerPartNumber: 'MPN',
          name: 'Name',
          attributeColumns: {
            ATTR_FUEL_TYPE: 'Fuel',
            ATTR_QUANTITY: 'Qty',
          },
        },
        references: {
          productTypes: { BRAKE_PAD: productTypeId },
          brands: { Bosch: brandId },
        },
        corrections: [
          {
            rowNumber: 2,
            cells: { Qty: '6' },
          },
        ],
        excludedRowNumbers: [4],
      },
      actorId,
    );

    expect(preview).toMatchObject({
      fileName: 'articles.csv',
      format: 'CSV',
      totalRows: 3,
      includedRows: 2,
      excludedRows: 1,
      validRows: 2,
      invalidRows: 0,
      warningRows: 2,
      canCommit: true,
    });
    expect(preview.rows[0]).toMatchObject({
      sourceRowNumber: 2,
      productTypeId,
      brandId,
      normalizedManufacturerPartNumber: 'BP001',
      duplicateAssessment: 'PROBABLE',
    });
    expect(preview.rows[0]?.warnings.join(' ')).toContain(
      'CATALOG_IMPORT_PROBABLE_DUPLICATE',
    );
    expect(preview.rows[2]).toMatchObject({
      sourceRowNumber: 4,
      excluded: true,
      errors: [],
      warnings: [],
    });
    expect(preview.previewFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(product.create).not.toHaveBeenCalled();
    expect(catalogArticleImportJob.create).not.toHaveBeenCalled();
  });

  it('rejects professional import commit when the reviewed file fingerprint drifts', async () => {
    const csv = [
      'Schema,Name,Fuel',
      '2,Brake Pad,DIESEL',
    ].join('\n');
    const request = {
      datasetReference: 'drift-check',
      fileName: 'articles.csv',
      format: CatalogArticleImportFileFormat.CSV,
      fileBase64: Buffer.from(csv).toString('base64'),
      mapping: {
        schemaVersion: 'Schema',
        name: 'Name',
        attributeColumns: { ATTR_FUEL_TYPE: 'Fuel' },
      },
      defaults: { productTypeId },
    };

    const preview = await service.previewProfessionalCatalogImport(
      request,
      actorId,
    );

    await expect(
      service.commitProfessionalCatalogImport(
        {
          ...request,
          fileBase64: Buffer.from(
            'Schema,Name,Fuel\n2,Changed Brake Pad,DIESEL\n',
          ).toString('base64'),
          expectedPreviewFingerprint: preview.previewFingerprint,
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CATALOG_ARTICLE_IMPORT_PREVIEW_DRIFT' },
    });

    expect(catalogArticleImportJob.create).not.toHaveBeenCalled();
  });

  it('atomically commits a reviewed professional import and persists its job report', async () => {
    const csv = [
      'Schema,Name,Fuel,Qty',
      '2,Imported Brake Pad,DIESEL,4',
    ].join('\n');
    const request = {
      datasetReference: 'professional-batch-1',
      fileName: 'articles.csv',
      format: CatalogArticleImportFileFormat.CSV,
      fileBase64: Buffer.from(csv).toString('base64'),
      mapping: {
        schemaVersion: 'Schema',
        name: 'Name',
        attributeColumns: {
          ATTR_FUEL_TYPE: 'Fuel',
          ATTR_QUANTITY: 'Qty',
        },
      },
      defaults: { productTypeId },
    };

    const preview = await service.previewProfessionalCatalogImport(
      request,
      actorId,
    );
    const result = await service.commitProfessionalCatalogImport(
      {
        ...request,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
      actorId,
    );

    expect(catalogArticleImportJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        datasetReference: 'professional-batch-1',
        fileName: 'articles.csv',
        fileFormat: 'CSV',
        previewFingerprint: preview.previewFingerprint,
        totalRows: 1,
        includedRows: 1,
        excludedRows: 0,
        warningRows: 0,
        createdCount: 1,
        createdById: actorId,
      }),
      select: { id: true },
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CATALOG_ARTICLE_IMPORT_V2_COMMITTED',
          entityType: 'CatalogArticleImportJob',
        }),
      }),
    );
    expect(result).toMatchObject({
      jobId: 'abababab-abab-4aba-8aba-abababababab',
      datasetReference: 'professional-batch-1',
      createdCount: 1,
      excludedRows: 0,
      warningRows: 0,
      items: [{ rowKey: 'row-2', articleId: productId }],
    });
  });

  it('refuses import commit when server-side preview contains invalid rows', async () => {
    validation.validatePublishedSchema.mockReturnValue({
      valid: false,
      schemaVersion: 2,
      schemaHash: 'a'.repeat(64),
      requiredAttributeCodes: ['ATTR_FUEL_TYPE'],
      issues: [
        {
          code: 'ATTRIBUTE_REQUIRED',
          message: 'ATTR_FUEL_TYPE is required',
          path: 'ATTR_FUEL_TYPE',
        },
      ],
    });

    await expect(
      service.commitApprovedCatalogImport(
        {
          datasetReference: 'invalid-batch',
          rows: [
            {
              rowKey: 'bad-1',
              productTypeId,
              schemaVersion: 2,
              name: 'Invalid Imported Brake Pad',
              values: {},
            },
          ],
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CATALOG_ARTICLE_IMPORT_INVALID' },
    });

    expect(product.create).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

});
