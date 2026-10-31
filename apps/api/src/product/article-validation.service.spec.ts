import {
  ArticleIdentifierType,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  ProductAssetType,
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import type { CatalogSchemaValidationService } from '../catalog/catalog-schema-validation.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { articleRequirementColumnsFromSchema } from './article-requirement-snapshot.js';
import { ArticleValidationService } from './article-validation.service.js';

describe('ArticleValidationService', () => {
  const product = { findUnique: vi.fn() };
  const database = { product };
  const schemaValidation = { validatePublishedSchema: vi.fn() };
  const service = new ArticleValidationService(
    database as unknown as DatabaseService,
    schemaValidation as unknown as CatalogSchemaValidationService,
  );

  const articleId = '11111111-1111-4111-8111-111111111111';
  const productTypeId = '22222222-2222-4222-8222-222222222222';
  const schema = {
    id: '33333333-3333-4333-8333-333333333333',
    productTypeId,
    schemaVersion: 4,
    schemaHash: 'a'.repeat(64),
    publishedAt: new Date('2026-10-06T00:00:00.000Z'),
    snapshot: {
      schemaKind: 'PRODUCT_TYPE_SCHEMA',
      contractVersion: 2,
      articleRequirements: {
        brand: ProductTypeRequirementLevel.REQUIRED,
        identifier:
          ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
        gtin: ProductTypeRequirementLevel.REQUIRED,
        oeReference: ProductTypeRequirementLevel.REQUIRED,
        crossReference: ProductTypeRequirementLevel.REQUIRED,
        fitment: ProductTypeRequirementLevel.REQUIRED,
        image: ProductTypeRequirementLevel.REQUIRED,
        minimumImageCount: 2,
        document: ProductTypeRequirementLevel.REQUIRED,
        minimumDocumentCount: 1,
      },
      attributes: [],
    },
  };

  const readyArticle = {
    id: articleId,
    ...articleRequirementColumnsFromSchema(schema.snapshot),
    brandId: '44444444-4444-4444-8444-444444444444',
    schemaVersion: schema,
    attributeValues: [],
    partNumbers: [
      { type: PartNumberType.MANUFACTURER, isPrimary: true },
      { type: PartNumberType.OE, isPrimary: false },
      { type: PartNumberType.CROSS_REFERENCE, isPrimary: false },
    ],
    articleIdentifiers: [{ type: ArticleIdentifierType.GTIN_13 }],
    compatibilities: [
      { verificationStatus: CompatibilityVerificationStatus.VERIFIED },
    ],
    assets: [
      { type: ProductAssetType.IMAGE },
      { type: ProductAssetType.IMAGE },
      { type: ProductAssetType.DOCUMENT },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockResolvedValue(readyArticle);
    schemaValidation.validatePublishedSchema.mockReturnValue({
      valid: true,
      schemaVersion: 4,
      schemaHash: 'a'.repeat(64),
      requiredAttributeCodes: [],
      issues: [],
    });
  });

  it('uses frozen requirements even if the related schema response changes', async () => {
    product.findUnique.mockResolvedValue({ ...readyArticle, brandId: null,
      schemaVersion: { ...schema, snapshot: { ...schema.snapshot,
        articleRequirements: { ...schema.snapshot.articleRequirements, brand: 'OPTIONAL' } } } });
    const result = await service.validate(articleId);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ARTICLE_BRAND_REQUIRED' }));
  });

  it('fails closed on an unmigrated or incomplete Article policy', async () => {
    product.findUnique.mockResolvedValue({ ...readyArticle, brandRequirement: undefined });
    await expect(service.validate(articleId)).rejects.toMatchObject({
      response: { code: 'ARTICLE_REQUIREMENTS_MISSING' },
    });
  });

  it('checks canonical Article identity and fitment while retaining media counts for diagnostics', async () => {
    const result = await service.validate(articleId);

    expect(result).toMatchObject({
      articleId,
      readyForActivation: true,
      qualityScore: 100,
      qualityBand: 'COMPLETE',
      schemaVersion: 4,
      summary: {
        identifierCount: 1,
        gtinCount: 1,
        oeReferenceCount: 1,
        crossReferenceCount: 1,
        verifiedFitmentCount: 1,
        imageCount: 2,
        documentCount: 1,
      },
      issues: [],
    });
    expect(schemaValidation.validatePublishedSchema).toHaveBeenCalledWith(
      expect.objectContaining({ id: schema.id }),
      {},
      { skipSellerMediaRequirements: true },
    );
  });

  it('approves complete canonical Article data without Seller listing images or documents', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      assets: [],
    });

    const result = await service.validate(articleId);

    expect(result.readyForActivation).toBe(true);
    expect(result.qualityScore).toBe(100);
    expect(result.issues).toEqual([]);
    expect(result.summary).toMatchObject({ imageCount: 0, documentCount: 0 });
    await expect(service.assertReadyForActivation(articleId)).resolves.toMatchObject({
      readyForActivation: true,
    });
  });

  it('does not use legacy NOT_APPLICABLE Article media rules to block existing attachments', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      schemaVersion: {
        ...schema,
        snapshot: {
          ...schema.snapshot,
          articleRequirements: {
            ...schema.snapshot.articleRequirements,
            image: ProductTypeRequirementLevel.NOT_APPLICABLE,
            document: ProductTypeRequirementLevel.NOT_APPLICABLE,
          },
        },
      },
    });

    const result = await service.validate(articleId);
    expect(result.readyForActivation).toBe(true);
    expect(result.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'IMAGE' }),
      expect.objectContaining({ area: 'DOCUMENT' }),
    ]));
    expect(result.summary).toMatchObject({ imageCount: 2, documentCount: 1 });
  });

  it('requires a real GTIN and does not accept a trade number as a substitute', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      articleIdentifiers: [{ type: ArticleIdentifierType.TRADE_NUMBER }],
    });

    const result = await service.validate(articleId);

    expect(result.readyForActivation).toBe(false);
    expect(result.summary.gtinCount).toBe(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'ARTICLE_GTIN_REQUIRED',
        area: 'GTIN',
      }),
    );
  });

  it('aggregates actionable readiness issues instead of failing one rule at a time', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      brandId: null,
      partNumbers: [],
      compatibilities: [
        {
          verificationStatus:
            CompatibilityVerificationStatus.SELLER_SUBMITTED,
        },
      ],
      assets: [{ type: ProductAssetType.IMAGE }],
    });
    schemaValidation.validatePublishedSchema.mockReturnValue({
      valid: false,
      schemaVersion: 4,
      schemaHash: 'a'.repeat(64),
      requiredAttributeCodes: ['ATTR_POSITION'],
      issues: [
        {
          code: 'MISSING_REQUIRED',
          attributeCode: 'ATTR_POSITION',
          message: 'A value is required.',
        },
      ],
    });

    const result = await service.validate(articleId);

    expect(result.readyForActivation).toBe(false);
    expect(result.qualityScore).toBe(15);
    expect(result.qualityBand).toBe('POOR');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_REQUIRED',
          area: 'TECHNICAL_ATTRIBUTES',
          attributeCode: 'ATTR_POSITION',
        }),
        expect.objectContaining({ code: 'ARTICLE_BRAND_REQUIRED' }),
        expect.objectContaining({
          code: 'ARTICLE_MANUFACTURER_PART_NUMBER_REQUIRED',
        }),
        expect.objectContaining({ code: 'ARTICLE_OE_REFERENCE_REQUIRED' }),
        expect.objectContaining({
          code: 'ARTICLE_CROSS_REFERENCE_REQUIRED',
        }),
        expect.objectContaining({ code: 'ARTICLE_FITMENT_REQUIRED' }),
      ]),
    );
  });

  it('uses stable area-weighted scoring so one missing identifier does not erase unrelated completeness', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      brandRequirement: ProductTypeRequirementLevel.OPTIONAL,
      oemReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
      crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
      fitmentRequirement: ProductTypeRequirementLevel.OPTIONAL,
      schemaVersion: {
        ...schema,
        snapshot: {
          ...schema.snapshot,
          articleRequirements: {
            ...schema.snapshot.articleRequirements,
            identifier:
              ProductTypeIdentifierRequirement.MANUFACTURER_PART_NUMBER,
            brand: ProductTypeRequirementLevel.OPTIONAL,
            oeReference: ProductTypeRequirementLevel.OPTIONAL,
            crossReference: ProductTypeRequirementLevel.OPTIONAL,
            fitment: ProductTypeRequirementLevel.OPTIONAL,
            image: ProductTypeRequirementLevel.OPTIONAL,
            document: ProductTypeRequirementLevel.OPTIONAL,
          },
        },
      },
      partNumbers: [],
      compatibilities: [],
      assets: [],
    });

    const result = await service.validate(articleId);

    expect(result.qualityScore).toBe(85);
    expect(result.qualityBand).toBe('GOOD');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'ARTICLE_MANUFACTURER_PART_NUMBER_REQUIRED',
        area: 'IDENTIFIER',
      }),
    ]);
  });

  it('does not treat OE or cross-reference numbers as the Article own identifier', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      brandRequirement: ProductTypeRequirementLevel.OPTIONAL,
      crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
      fitmentRequirement: ProductTypeRequirementLevel.OPTIONAL,
      identifierRequirement: ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
      oemReferenceRequirement: ProductTypeRequirementLevel.REQUIRED,
      schemaVersion: {
        ...schema,
        snapshot: {
          ...schema.snapshot,
          articleRequirements: {
            ...schema.snapshot.articleRequirements,
            brand: ProductTypeRequirementLevel.OPTIONAL,
            identifier: ProductTypeIdentifierRequirement.ANY_PART_NUMBER,
            oeReference: ProductTypeRequirementLevel.REQUIRED,
            crossReference: ProductTypeRequirementLevel.OPTIONAL,
            fitment: ProductTypeRequirementLevel.OPTIONAL,
            image: ProductTypeRequirementLevel.OPTIONAL,
            document: ProductTypeRequirementLevel.OPTIONAL,
          },
        },
      },
      brandId: null,
      partNumbers: [
        { type: PartNumberType.OE, isPrimary: false },
        { type: PartNumberType.CROSS_REFERENCE, isPrimary: false },
      ],
      compatibilities: [],
      assets: [],
    });

    const result = await service.validate(articleId);

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'ARTICLE_IDENTIFIER_REQUIRED' }),
    );
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({ code: 'ARTICLE_OE_REFERENCE_REQUIRED' }),
    );
    expect(result.summary).toMatchObject({
      identifierCount: 0,
      oeReferenceCount: 1,
      crossReferenceCount: 1,
    });
  });

  it('allows OE references when the Article own identifier is not applicable', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      brandRequirement: ProductTypeRequirementLevel.OPTIONAL,
      crossReferenceRequirement: ProductTypeRequirementLevel.OPTIONAL,
      fitmentRequirement: ProductTypeRequirementLevel.OPTIONAL,
      identifierRequirement: ProductTypeIdentifierRequirement.NOT_APPLICABLE,
      oemReferenceRequirement: ProductTypeRequirementLevel.REQUIRED,
      schemaVersion: {
        ...schema,
        snapshot: {
          ...schema.snapshot,
          articleRequirements: {
            ...schema.snapshot.articleRequirements,
            brand: ProductTypeRequirementLevel.OPTIONAL,
            identifier: ProductTypeIdentifierRequirement.NOT_APPLICABLE,
            oeReference: ProductTypeRequirementLevel.REQUIRED,
            crossReference: ProductTypeRequirementLevel.OPTIONAL,
            fitment: ProductTypeRequirementLevel.OPTIONAL,
            image: ProductTypeRequirementLevel.OPTIONAL,
            document: ProductTypeRequirementLevel.OPTIONAL,
          },
        },
      },
      brandId: null,
      partNumbers: [{ type: PartNumberType.OE, isPrimary: false }],
      compatibilities: [],
      assets: [],
    });

    const result = await service.validate(articleId);

    expect(result.readyForActivation).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.summary.identifierCount).toBe(0);
    expect(result.summary.oeReferenceCount).toBe(1);
  });

  it('uses proposed Brand and Attribute values when validating an activation update', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      brandId: null,
      attributeValues: [
        {
          valueString: 'OLD',
          valueNumeric: null,
          valueBoolean: null,
          valueReferenceId: null,
          valueJson: null,
          attribute: { code: 'ATTR_POSITION' },
        },
      ],
    });

    await service.validate(articleId, {
      brandId: '55555555-5555-4555-8555-555555555555',
      values: { ATTR_POSITION: 'FRONT' },
    });

    expect(schemaValidation.validatePublishedSchema).toHaveBeenCalledWith(
      expect.any(Object),
      { ATTR_POSITION: 'FRONT' },
      { skipSellerMediaRequirements: true },
    );
  });

  it('keeps legacy OEM-named schema requirements readable as OE requirements', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      schemaVersion: {
        ...schema,
        snapshot: {
          requirements: {
            oemReference: ProductTypeRequirementLevel.REQUIRED,
          },
          attributes: [],
        },
      },
      partNumbers: [{ type: PartNumberType.OE, isPrimary: false }],
      brandId: null,
      compatibilities: [],
      assets: [],
    });

    const result = await service.validate(articleId);

    expect(result.issues).not.toContainEqual(
      expect.objectContaining({ code: 'ARTICLE_OE_REFERENCE_REQUIRED' }),
    );
  });

  it('blocks activation with the complete readiness issue set', async () => {
    product.findUnique.mockResolvedValue({
      ...readyArticle,
      brandId: null,
      partNumbers: [],
      compatibilities: [],
      assets: [],
    });

    await expect(service.assertReadyForActivation(articleId)).rejects.toMatchObject({
      response: {
        code: 'ARTICLE_VALIDATION_FAILED',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'ARTICLE_BRAND_REQUIRED' }),
        ]),
      },
    });
  });

  it('accepts DRAFT related records for pre-activation readiness to avoid lifecycle deadlock', async () => {
    await service.validate(articleId);

    expect(product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          partNumbers: expect.objectContaining({
            where: {
              status: {
                in: [MasterDataStatus.DRAFT, MasterDataStatus.ACTIVE],
              },
            },
          }),
          articleIdentifiers: expect.objectContaining({
            where: {
              status: {
                in: [MasterDataStatus.DRAFT, MasterDataStatus.ACTIVE],
              },
            },
          }),
        }),
      }),
    );
  });
});
