import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleSource, MasterDataStatus, PartNumberType, ProductStatus } from '@prisma/client';
import type { ProductService } from '../product/product.service.js';
import { SellerArticleIdentityResolver } from './seller-article-identity-resolver.service.js';

const articleId = '11111111-1111-4111-8111-111111111111';
const productTypeId = '22222222-2222-4222-8222-222222222222';
const brandId = '33333333-3333-4333-8333-333333333333';
const sellerId = '44444444-4444-4444-8444-444444444444';
const actorId = '55555555-5555-4555-8555-555555555555';
const carId = '66666666-6666-4666-8666-666666666666';
const secondCarId = '77777777-7777-4777-8777-777777777777';

describe('Seller Article full identity resolver', () => {
  const products = { createInSellerTransaction: vi.fn() };
  const tx = {
    productType: { findFirst: vi.fn() },
    vehicleConfiguration: { findMany: vi.fn() },
    brand: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
    articleIdentifier: { create: vi.fn() },
    partNumber: { create: vi.fn() },
    vehicleCompatibility: { create: vi.fn() },
    productVehicleArticle: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const service = new SellerArticleIdentityResolver(products as unknown as ProductService);
  const base = {
    article: {
      productTypeId, brandId, manufacturerPartNumber: 'BR-123',
      values: { MATERIAL: 'CERAMIC' },
    },
    vehicleConfigurationIds: [carId],
  };
  const matching = {
    id: articleId,
    status: ProductStatus.ACTIVE,
    sourceSellerId: null,
    partNumbers: [{ type: PartNumberType.MANUFACTURER, partNumber: 'BR 123', issuerBrandId: brandId }],
    articleIdentifiers: [],
    attributeValues: [{
      attribute: { code: 'MATERIAL' },
      valueString: 'CERAMIC', valueNumeric: null,
      valueBoolean: null, valueReferenceId: null, valueJson: null,
    }],
    compatibilities: [{ vehicleConfigurationId: carId }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    tx.productType.findFirst.mockResolvedValue({
      name: 'Brake Pads',
      currentSchemaVersion: { schemaVersion: 4, snapshot: { articleRequirements: {
        fitment: 'REQUIRED', gtin: 'OPTIONAL', oeReference: 'OPTIONAL', crossReference: 'OPTIONAL',
      } } },
    });
    tx.vehicleConfiguration.findMany.mockImplementation(async ({ where }) =>
      where.id.in.map((id: string) => ({
        id, makeId: 'make', modelId: 'model', generationId: null, trimId: null,
        engineId: null, transmissionId: null, bodyTypeId: null, marketId: null,
        steeringSide: null, transmission: null,
      })));
    tx.brand.findUnique.mockResolvedValue({ name: 'Test Brand' });
    tx.product.findMany.mockResolvedValue([matching]);
    products.createInSellerTransaction.mockResolvedValue(articleId);
    tx.articleIdentifier.create.mockResolvedValue({});
    tx.partNumber.create.mockResolvedValue({});
    tx.vehicleCompatibility.create.mockResolvedValue({});
    tx.productVehicleArticle.create.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});
  });

  it('reuses an Article only when all five dimensions match', async () => {
    const result = await service.resolve(tx as never, base, sellerId, actorId);
    expect(result).toEqual({ articleId, created: false });
    expect(products.createInSellerTransaction).not.toHaveBeenCalled();
    expect(tx.vehicleCompatibility.create).not.toHaveBeenCalled();
  });

  it('creates a distinct Draft with the same MPN when technical attributes differ', async () => {
    const input = { ...base, article: {
      ...base.article, values: { MATERIAL: 'METAL' },
    } };
    const result = await service.resolve(tx as never, input, sellerId, actorId);
    expect(result.created).toBe(true);
    expect(products.createInSellerTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        manufacturerPartNumber: 'BR-123', values: { MATERIAL: 'METAL' },
      }),
      expect.objectContaining({ source: ArticleSource.SELLER_SUBMISSION, sourceSellerId: sellerId }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it('creates a different Draft when the complete vehicle-fitment set changes', async () => {
    const result = await service.resolve(tx as never, {
      ...base, vehicleConfigurationIds: [carId, secondCarId],
    }, sellerId, actorId);
    expect(result.created).toBe(true);
    expect(tx.vehicleCompatibility.create).toHaveBeenCalledTimes(2);
    expect(tx.vehicleCompatibility.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ vehicleConfigurationId: secondCarId, status: MasterDataStatus.DRAFT }),
    }));
  });

  it('blocks creation if required configured vehicles are missing', async () => {
    await expect(service.resolve(tx as never, {
      ...base, vehicleConfigurationIds: [],
    }, sellerId, actorId)).rejects.toThrow('Select at least one configured vehicle');
    expect(products.createInSellerTransaction).not.toHaveBeenCalled();
  });

  it('never accepts a wrong GTIN check digit', async () => {
    await expect(service.resolve(tx as never, {
      ...base, identifiers: { gtin: '1234567890123', gtinType: 'GTIN_13' },
    }, sellerId, actorId)).rejects.toThrow('Invalid GTIN');
    expect(tx.articleIdentifier.create).not.toHaveBeenCalled();
  });

  it('does not mutate a shared Article when a different identity is submitted', async () => {
    await service.resolve(tx as never, {
      ...base, article: { ...base.article, values: { MATERIAL: 'OTHER' } },
    }, sellerId, actorId);
    expect(tx.product.findMany).toHaveBeenCalled();
    expect(products.createInSellerTransaction).toHaveBeenCalledTimes(1);
  });
});
