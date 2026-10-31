import { CompatibilityVerificationStatus, MasterDataStatus, ProductStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import type { SellerService } from './seller.service.js';
import { SellerProductVehicleArticleService } from './seller-product-vehicle-article.service.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sellerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const productId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const vehicleConfigurationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const articleId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function setup() {
  const findMany = vi.fn();
  const fitments = vi.fn();
  const database = {
    productVehicleArticle: { findMany },
    vehicleCompatibility: { findMany: fitments },
  } as unknown as DatabaseService;
  const requireOperationalSellerByUser = vi.fn().mockResolvedValue({ id: sellerId });
  const sellers = { requireOperationalSellerByUser } as unknown as SellerService;
  return { service: new SellerProductVehicleArticleService(database, sellers), findMany, fitments, requireOperationalSellerByUser };
}

const pair = {
  id: articleId,
  productId,
  vehicleConfigurationId,
  product: {
    name: 'Oil Filter',
    status: ProductStatus.ACTIVE,
    brand: { name: 'Example Brand' },
    productType: { name: 'Oil Filter' },
  },
  vehicleConfiguration: {
    identityCode: 'CONFIG-01',
    modelYear: 2020,
    make: { name: 'Toyota' },
    model: { name: 'Corolla' },
    generation: { name: 'E170' },
    trim: { name: '1.6' },
  },
};

function rule(verificationStatus: CompatibilityVerificationStatus, status: MasterDataStatus = MasterDataStatus.ACTIVE) {
  return { productId, vehicleConfigurationId, verificationStatus, status };
}

describe('Seller Product Article applications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns one vehicle-specific Article application for a verified exact fitment', async () => {
    const { service, findMany, fitments, requireOperationalSellerByUser } = setup();
    findMany.mockResolvedValue([pair]);
    fitments.mockResolvedValue([rule(CompatibilityVerificationStatus.APPROVED)]);
    const results = await service.list(userId);
    expect(requireOperationalSellerByUser).toHaveBeenCalledWith(userId);
    expect(results).toEqual([expect.objectContaining({
      id: articleId,
      productId,
      vehicleConfigurationId,
      verified: true,
      vehicleLabel: 'Toyota · Corolla · E170 · 1.6 · 2020',
    })]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        product: expect.objectContaining({
          OR: expect.arrayContaining([{ status: ProductStatus.DRAFT, sourceSellerId: sellerId }]),
        }),
      }),
    }));
  });

  it('does not expose an unapproved fitment for an Active product', async () => {
    const { service, findMany, fitments } = setup();
    findMany.mockResolvedValue([pair]);
    fitments.mockResolvedValue([rule(CompatibilityVerificationStatus.SELLER_SUBMITTED, MasterDataStatus.DRAFT)]);
    expect(await service.list(userId)).toEqual([]);
  });

  it('shows own draft applications with explicit pending verification status', async () => {
    const { service, findMany, fitments } = setup();
    findMany.mockResolvedValue([{ ...pair, product: { ...pair.product, status: ProductStatus.DRAFT } }]);
    fitments.mockResolvedValue([rule(CompatibilityVerificationStatus.SELLER_SUBMITTED, MasterDataStatus.DRAFT)]);
    expect(await service.list(userId)).toEqual([expect.objectContaining({ verified: false })]);
  });

  it('skips the fitment query when the Seller has no accessible applications', async () => {
    const { service, findMany, fitments } = setup();
    findMany.mockResolvedValue([]);
    expect(await service.list(userId)).toEqual([]);
    expect(fitments).not.toHaveBeenCalled();
  });
});
