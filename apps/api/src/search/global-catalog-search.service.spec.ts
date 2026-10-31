import {
  ArticleIdentifierType,
  MasterDataStatus,
  PartNumberType,
  ProductStatus,
} from '@prisma/client';
import type { DatabaseService } from '../database/database.service.js';
import { GlobalCatalogSearchService } from './global-catalog-search.service.js';

describe('GlobalCatalogSearchService', () => {
  const brandId = '11111111-1111-4111-8111-111111111111';
  const productTypeId = '22222222-2222-4222-8222-222222222222';
  const articleId = '33333333-3333-4333-8333-333333333333';
  const vehicleConfigurationId =
    '44444444-4444-4444-8444-444444444444';

  const brand = { findMany: vi.fn() };
  const productType = { findMany: vi.fn() };
  const product = { findMany: vi.fn() };
  const vehicleConfiguration = { findMany: vi.fn() };
  const productAttributeValue = { findMany: vi.fn() };

  const database = {
    brand,
    productType,
    product,
    vehicleConfiguration,
    productAttributeValue,
  } as unknown as DatabaseService;

  const service = new GlobalCatalogSearchService(database);

  const article = {
    id: articleId,
    name: 'Bosch Brake Pad Set',
    brandId,
    productTypeId,
    brand: {
      id: brandId,
      code: 'BOSCH',
      name: 'Bosch',
    },
    productType: {
      id: productTypeId,
      code: 'BRAKE_PAD',
      name: 'Brake Pad',
    },
    partNumbers: [
      {
        partNumber: '0 986 494 123',
        normalizedPartNumber: '0986494123',
        type: PartNumberType.MANUFACTURER,
        isPrimary: true,
      },
      {
        partNumber: '04465-0D120',
        normalizedPartNumber: '044650D120',
        type: PartNumberType.OE,
        isPrimary: false,
      },
    ],
    articleIdentifiers: [
      {
        value: '4006381333931',
        normalizedValue: '4006381333931',
        type: ArticleIdentifierType.GTIN_13,
      },
      {
        value: 'BP-494-123',
        normalizedValue: 'BP494123',
        type: ArticleIdentifierType.TRADE_NUMBER,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    brand.findMany.mockResolvedValue([]);
    productType.findMany.mockResolvedValue([]);
    product.findMany.mockResolvedValue([]);
    vehicleConfiguration.findMany.mockResolvedValue([]);
    productAttributeValue.findMany.mockResolvedValue([]);
  });

  it('normalizes part numbers and ranks an exact MPN match as an Article result', async () => {
    product.findMany.mockResolvedValue([article]);

    const result = await service.search({
      q: '0 986-494-123',
      limit: 8,
    });

    expect(result.articles).toEqual([
      expect.objectContaining({
        id: articleId,
        primaryManufacturerPartNumber: '0 986 494 123',
        matchedBy: expect.arrayContaining(['MPN']),
        score: 175,
      }),
    ]);
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ProductStatus.ACTIVE,
        }),
      }),
    );
  });

  it('ranks a Brand + MPN query when tokens match across different Article fields', async () => {
    product.findMany.mockResolvedValue([article]);

    const result = await service.search({
      q: 'Bosch 0 986 494 123',
      limit: 8,
    });

    expect(result.articles[0]).toMatchObject({
      id: articleId,
      score: expect.any(Number),
      matchedBy: expect.arrayContaining(['BRAND', 'MPN']),
    });
    expect(result.articles[0]?.score).toBeGreaterThan(100);
  });

  it('returns OE/reference matches against Active Articles without Seller commerce data', async () => {
    product.findMany.mockResolvedValue([article]);

    const result = await service.search({
      q: '04465 0D120',
      limit: 8,
    });

    expect(result.articles[0]).toMatchObject({
      id: articleId,
      brandName: 'Bosch',
      productTypeName: 'Brake Pad',
      matchedBy: expect.arrayContaining(['OE']),
    });
    expect(result.articles[0]).not.toHaveProperty('price');
    expect(result.articles[0]).not.toHaveProperty('stock');
    expect(result.articles[0]).not.toHaveProperty('sellerId');
  });

  it('resolves an Article by exact GTIN', async () => {
    product.findMany.mockResolvedValue([article]);

    const result = await service.search({
      q: '4006381333931',
      limit: 8,
    });

    expect(result.articles[0]).toMatchObject({
      id: articleId,
      matchedBy: expect.arrayContaining(['GTIN']),
      score: 165,
    });
  });

  it('resolves an Article by normalized trade number', async () => {
    product.findMany.mockResolvedValue([article]);

    const result = await service.search({
      q: 'BP 494-123',
      limit: 8,
    });

    expect(result.articles[0]).toMatchObject({
      id: articleId,
      matchedBy: expect.arrayContaining(['TRADE_NUMBER']),
      score: 160,
    });
  });

  it('uses only Product Type criteria explicitly marked searchable in the bound schema snapshot', async () => {
    productAttributeValue.findMany.mockResolvedValue([
      {
        normalizedValue: 'ceramic',
        attribute: { code: 'MATERIAL' },
        product: {
          ...article,
          schemaVersion: {
            snapshot: {
              searchableAttributeCodes: ['MATERIAL'],
            },
          },
        },
      },
      {
        normalizedValue: 'ceramic',
        attribute: { code: 'INTERNAL_NOTE' },
        product: {
          ...article,
          id: '55555555-5555-4555-8555-555555555555',
          schemaVersion: {
            snapshot: {
              searchableAttributeCodes: [],
            },
          },
        },
      },
    ]);

    const result = await service.search({
      q: 'ceramic',
      limit: 8,
    });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toMatchObject({
      id: articleId,
      matchedBy: ['CRITERIA:MATERIAL'],
    });
  });

  it('searches Active configured vehicles by hierarchy and engine code without returning internal identityCode', async () => {
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: vehicleConfigurationId,
        modelYear: 2010,
        make: { name: 'Toyota', code: 'TOYOTA' },
        model: { name: 'Corolla', code: 'COROLLA' },
        generation: { name: 'E140', code: 'E140' },
        trim: { name: 'GLI', code: 'GLI', equipmentLevel: 'GLI' },
        engine: { name: '2ZR-FE 1.8L', code: '2ZR-FE', family: 'ZR' },
        transmission: {
          code: 'CVT',
          transmissionType: 'CVT',
          driveType: 'FWD',
        },
      },
    ]);

    const result = await service.search({
      q: '2ZR-FE',
      limit: 8,
    });

    expect(result.vehicles).toEqual([
      expect.objectContaining({
        vehicleConfigurationId,
        make: 'Toyota',
        model: 'Corolla',
        engine: '2ZR-FE',
        matchedBy: expect.arrayContaining(['ENGINE_CODE']),
      }),
    ]);
    expect(result.vehicles[0]).not.toHaveProperty('identityCode');
    expect(vehicleConfiguration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MasterDataStatus.ACTIVE,
        }),
      }),
    );
  });

  it('supports hierarchy + engine + model-year vehicle queries without exposing internal identity', async () => {
    vehicleConfiguration.findMany.mockResolvedValue([
      {
        id: vehicleConfigurationId,
        modelYear: 2010,
        make: { name: 'Toyota', code: 'TOYOTA' },
        model: { name: 'Corolla', code: 'COROLLA' },
        generation: { name: 'E140', code: 'E140' },
        trim: { name: 'GLI', code: 'GLI', equipmentLevel: 'GLI' },
        engine: { name: '2ZR-FE 1.8L', code: '2ZR-FE', family: 'ZR' },
        transmission: {
          code: 'CVT',
          transmissionType: 'CVT',
          driveType: 'FWD',
        },
      },
    ]);

    const result = await service.search({
      q: 'Toyota Corolla 2ZR-FE 2010',
      limit: 8,
    });

    expect(result.vehicles[0]).toMatchObject({
      vehicleConfigurationId,
      make: 'Toyota',
      model: 'Corolla',
      modelYear: 2010,
    });
    expect(result.vehicles[0]).not.toHaveProperty('identityCode');

    const call = vehicleConfiguration.findMany.mock.calls[0]?.[0];
    expect(JSON.stringify(call?.where)).toContain('"modelYear":2010');
  });

  it('ranks Product Types found across Category, Part Group and Product Type hierarchy tokens', async () => {
    productType.findMany.mockResolvedValue([
      {
        id: productTypeId,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        category: { name: 'Braking' },
        productFamily: { name: 'Disc Brake' },
      },
    ]);

    const result = await service.search({
      q: 'Braking Disc Pad',
      limit: 5,
    });

    expect(result.productTypes[0]).toMatchObject({
      id: productTypeId,
      matchedBy: ['PRODUCT_TYPE_HIERARCHY'],
      score: 76,
    });
  });

  it('returns only Active Brands and published Active Product Types through database filters', async () => {
    brand.findMany.mockResolvedValue([
      { id: brandId, code: 'BOSCH', name: 'Bosch' },
    ]);
    productType.findMany.mockResolvedValue([
      {
        id: productTypeId,
        code: 'BRAKE_PAD',
        name: 'Brake Pad',
        category: { name: 'Braking' },
        productFamily: { name: 'Disc Brake' },
      },
    ]);

    const result = await service.search({
      q: 'brake',
      limit: 5,
    });

    expect(result.brands).toHaveLength(1);
    expect(result.productTypes).toHaveLength(1);
    expect(brand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MasterDataStatus.ACTIVE,
        }),
      }),
    );
    expect(productType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MasterDataStatus.ACTIVE,
          currentSchemaVersionId: { not: null },
        }),
      }),
    );
  });
});
