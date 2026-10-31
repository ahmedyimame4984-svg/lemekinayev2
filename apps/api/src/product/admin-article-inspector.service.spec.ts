import {
  ArticleRelationType,
  ArticleSource,
  CompatibilityFitmentType,
  CompatibilitySource,
  CompatibilityVerificationStatus,
  MasterDataStatus,
  PartNumberType,
  ProductAssetType,
  ProductAssetVisibility,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import type { ArticleValidationService } from './article-validation.service.js';
import { AdminArticleInspectorService } from './admin-article-inspector.service.js';

describe('AdminArticleInspectorService', () => {
  const articleId = '11111111-1111-4111-8111-111111111111';

  const product = { findUnique: vi.fn() };
  const vehicleCompatibility = { count: vi.fn(), findMany: vi.fn() };
  const articleRelation = { count: vi.fn(), findMany: vi.fn() };
  const database = { product, vehicleCompatibility, articleRelation };
  const validation = { validate: vi.fn() };

  const service = new AdminArticleInspectorService(
    database as unknown as DatabaseService,
    validation as unknown as ArticleValidationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    product.findUnique.mockResolvedValue({
      id: articleId,
      name: 'Bosch Brake Pad Set',
      shortDescription: 'Front axle brake pad kit',
      description: 'Canonical Article description',
      manufacturerNotes: null,
      status: ProductStatus.DRAFT,
      version: 4,
      packQuantity: null,
      articleSource: ArticleSource.SELLER_SUBMISSION,
      sourceReference: 'SELLER-ROW-44',
      submittedAt: new Date('2026-10-07T05:00:00.000Z'),
      catalogReviewSubmittedAt: new Date('2026-10-07T06:00:00.000Z'),
      publishedAt: null,
      createdAt: new Date('2026-10-07T05:00:00.000Z'),
      updatedAt: new Date('2026-10-07T06:00:00.000Z'),
      category: {
        id: '22222222-2222-4222-8222-222222222222',
        code: 'BRAKES',
        name: 'Brake System',
      },
      productFamily: {
        id: '33333333-3333-4333-8333-333333333333',
        code: 'DISC_BRAKE',
        name: 'Disc Brake',
      },
      productType: {
        id: '44444444-4444-4444-8444-444444444444',
        code: 'BRAKE_PAD_SET',
        name: 'Brake Pad Set',
      },
      brand: {
        id: '55555555-5555-4555-8555-555555555555',
        code: 'BOSCH',
        name: 'Bosch',
      },
      sourceSeller: {
        id: '66666666-6666-4666-8666-666666666666',
        sellerCode: 'SEL-001',
        displayName: 'Addis Auto Parts',
        businessName: 'Addis Auto Parts PLC',
      },
      unitOfMeasure: null,
      schemaVersion: {
        schemaVersion: 3,
        schemaHash: 'a'.repeat(64),
        snapshot: {
          attributes: [
            {
              code: 'THICKNESS',
              requirement: 'MANDATORY',
            },
          ],
        },
      },
      attributeValues: [
        {
          valueString: '17.5',
          valueNumeric: null,
          valueBoolean: null,
          valueReferenceId: null,
          valueJson: null,
          unit: 'mm',
          unitDefinition: null,
          attribute: {
            code: 'THICKNESS',
            name: 'Thickness',
            dataType: 'DECIMAL',
            group: { name: 'Dimensions' },
            defaultUnit: { symbol: 'mm' },
          },
        },
      ],
      partNumbers: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          type: PartNumberType.MANUFACTURER,
          partNumber: '0 986 494 123',
          normalizedPartNumber: '0986494123',
          isPrimary: true,
          status: MasterDataStatus.DRAFT,
          issuerBrand: null,
        },
      ],
      articleIdentifiers: [],
      assets: [
        {
          id: '88888888-8888-4888-8888-888888888888',
          type: ProductAssetType.IMAGE,
          title: 'Front view',
          storageReference: 'seller-assets/brake-pad.jpg',
          mimeType: 'image/jpeg',
          visibility: ProductAssetVisibility.PUBLIC,
          sortOrder: 0,
          status: MasterDataStatus.DRAFT,
        },
      ],
    });
    validation.validate.mockResolvedValue({
      articleId,
      readyForActivation: false,
      qualityScore: 85,
      qualityBand: 'GOOD',
      schemaVersion: 3,
      schemaHash: 'a'.repeat(64),
      summary: {
        identifierCount: 1,
        oeReferenceCount: 0,
        crossReferenceCount: 0,
        verifiedFitmentCount: 1,
        imageCount: 1,
        documentCount: 0,
      },
      issues: [
        {
          code: 'ARTICLE_OE_REFERENCE_REQUIRED',
          area: 'OE_REFERENCE',
          message: 'At least one OE reference is required.',
        },
      ],
    });
    vehicleCompatibility.count.mockResolvedValue(1);
    vehicleCompatibility.findMany.mockResolvedValue([
      {
        id: '99999999-9999-4999-8999-999999999999',
        vehicleConfigurationId:
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        fitmentType: CompatibilityFitmentType.EXACT,
        source: CompatibilitySource.SELLER,
        verificationStatus: CompatibilityVerificationStatus.VERIFIED,
        status: MasterDataStatus.DRAFT,
        yearFrom: 2019,
        yearTo: 2021,
        position: 'FRONT',
        notes: 'Front axle only',
        vehicleConfiguration: {
          identityCode: 'VEH-TOY-COR-2020',
          modelYear: 2020,
          make: { name: 'Toyota' },
          model: { name: 'Corolla' },
          generation: { name: 'E210' },
          trim: { name: 'GLI' },
          engine: { name: '2ZR-FE', code: '2ZR-FE' },
          transmission: {
            transmissionType: 'AUTOMATIC',
            code: 'CVT',
          },
          bodyType: { name: 'Sedan' },
          market: { name: 'Africa' },
        },
        make: null,
        model: null,
        generation: null,
        trim: null,
        engine: null,
        transmission: null,
        bodyType: null,
        market: null,
        criteria: [
          {
            type: 'ENGINE_CODE',
            textValue: '2ZR-FE',
            rangeFrom: null,
            rangeTo: null,
            productionFromYear: null,
            productionFromMonth: null,
            productionToYear: null,
            productionToMonth: null,
            axlePosition: null,
            installationPosition: null,
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    ]);
    articleRelation.count.mockResolvedValue(1);
    articleRelation.findMany.mockResolvedValue([
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        sourceArticleId: articleId,
        targetArticleId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        type: ArticleRelationType.SUPERSEDES,
        note: 'New generation replacement',
        componentQuantity: null,
        componentRole: null,
        componentOrder: null,
        status: MasterDataStatus.ACTIVE,
        sourceArticle: {
          id: articleId,
          name: 'Bosch Brake Pad Set',
          status: ProductStatus.DRAFT,
          brand: { name: 'Bosch' },
          partNumbers: [{ partNumber: '0 986 494 123' }],
        },
        targetArticle: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          name: 'Bosch Brake Pad Set New',
          status: ProductStatus.ACTIVE,
          brand: { name: 'Bosch' },
          partNumbers: [{ partNumber: '0 986 494 999' }],
        },
      },
    ]);
  });

  it('builds one readable canonical Article inspector record', async () => {
    const result = await service.get(articleId, {
      fitmentPage: 1,
      fitmentPageSize: 25,
      relationPage: 1,
      relationPageSize: 25,
    });

    expect(result).toMatchObject({
      id: articleId,
      name: 'Bosch Brake Pad Set',
      articleSource: ArticleSource.SELLER_SUBMISSION,
      productType: {
        code: 'BRAKE_PAD_SET',
        name: 'Brake Pad Set',
      },
      brand: { name: 'Bosch' },
      sourceSeller: {
        sellerCode: 'SEL-001',
        displayName: 'Addis Auto Parts',
      },
      validation: {
        readyForActivation: false,
        qualityScore: 85,
      },
    });
    expect(result.technicalValues).toEqual([
      expect.objectContaining({
        code: 'THICKNESS',
        name: 'Thickness',
        group: 'Dimensions',
        requirement: 'MANDATORY',
        value: '17.5',
        unit: 'mm',
      }),
    ]);
    expect(result.fitments.items[0]).toMatchObject({
      targetLabel:
        'Toyota Corolla 2020 E210 GLI · 2ZR-FE / CVT · Sedan / Africa',
      identityCode: 'VEH-TOY-COR-2020',
      verificationStatus: CompatibilityVerificationStatus.VERIFIED,
      criteria: [
        {
          type: 'ENGINE_CODE',
          label: '2ZR-FE',
          required: true,
        },
      ],
    });
    expect(result.relations.items[0]).toMatchObject({
      direction: 'OUTGOING',
      type: ArticleRelationType.SUPERSEDES,
      relatedArticle: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        brand: 'Bosch',
        manufacturerPartNumber: '0 986 494 999',
      },
    });
  });

  it('server-pages fitments and relations independently', async () => {
    await service.get(articleId, {
      fitmentPage: 3,
      fitmentPageSize: 10,
      relationPage: 2,
      relationPageSize: 5,
    });

    expect(vehicleCompatibility.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: articleId },
        skip: 20,
        take: 10,
      }),
    );
    expect(articleRelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      }),
    );
  });
});
