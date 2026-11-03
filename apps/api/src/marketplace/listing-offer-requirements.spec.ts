import { ArticleSource, ProductStatus, ProductTypeRequirementLevel } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { ListingService } from './listing.service.js';
import type { SellerService } from './seller.service.js';

const articleId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const sellerId = '33333333-3333-4333-8333-333333333333';

function setup(snapshot: unknown, status: ProductStatus = ProductStatus.ACTIVE) {
  const product = {
    status,
    articleSource: ArticleSource.SELLER_SUBMISSION,
    sourceSellerId: sellerId,
    schemaVersion: { snapshot },
  };
  const database = {
    product: { findFirst: vi.fn().mockResolvedValue(product) },
  };
  const sellers = {
    requireOperationalSellerByUser: vi.fn().mockResolvedValue({ id: sellerId }),
  };
  return {
    database, sellers,
    service: new ListingService(
      database as unknown as DatabaseService,
      sellers as unknown as SellerService,
    ),
  };
}

describe('Seller stock-to-Listing published Offer rules', () => {
  it('returns bound published rules rather than editable Product Type settings', async () => {
    const { service, database } = setup({
      offerRequirements: { warranty: 'REQUIRED', price: 'REQUIRED', stock: 'REQUIRED', condition: 'NOT_APPLICABLE' },
    });
    await expect(service.offerRequirementsForSellerArticle(articleId, userId))
      .resolves.toMatchObject({
        warranty: ProductTypeRequirementLevel.REQUIRED,
        price: ProductTypeRequirementLevel.REQUIRED,
        stock: ProductTypeRequirementLevel.REQUIRED,
        condition: ProductTypeRequirementLevel.NOT_APPLICABLE,
      });
    expect(database.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: articleId }),
      select: expect.objectContaining({ schemaVersion: { select: { snapshot: true } } }),
    }));
  });

  it('defaults older schemas to the existing Listing creation rules', async () => {
    const { service } = setup({});
    await expect(service.offerRequirementsForSellerArticle(articleId, userId))
      .resolves.toMatchObject({
        price: ProductTypeRequirementLevel.REQUIRED,
        stock: ProductTypeRequirementLevel.REQUIRED,
        condition: ProductTypeRequirementLevel.REQUIRED,
        warranty: ProductTypeRequirementLevel.OPTIONAL,
      });
  });

  it('allows the current Seller to prepare a Draft before Article approval', async () => {
    const { service } = setup({}, ProductStatus.DRAFT);
    await expect(service.offerRequirementsForSellerArticle(articleId, userId))
      .resolves.toHaveProperty('price', ProductTypeRequirementLevel.REQUIRED);
  });

  it('rejects a hidden or unowned Article rather than leaking its selling rules', async () => {
    const { service, database } = setup({});
    database.product.findFirst.mockResolvedValue(null);
    await expect(service.offerRequirementsForSellerArticle(articleId, userId))
      .rejects.toThrow('Select an Active Article or your own Draft Article');
  });
});
