import { describe, expect, it, vi } from 'vitest';
import { ProductStatus } from '@prisma/client';
import { SellerArticleService } from './seller-article.service.js';

function arrange() {
  const database = {
    product: { findFirst: vi.fn().mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Brake Pads',
      fitmentRequirement: 'REQUIRED',
      brand: { name: 'Example brand' },
      productType: { name: 'Brake Pads' },
      partNumbers: [{ type: 'MANUFACTURER', partNumber: 'BP-001' }],
      attributeValues: [],
      compatibilities: [],
    }) },
  };
  const sellers = { requireOperationalSellerByUser: vi.fn().mockResolvedValue({ id: 'seller-1' }) };
  // Only the two read dependencies are needed for this focused method.
  const service = Object.assign(Object.create(SellerArticleService.prototype) as SellerArticleService, {
    database, sellers,
  });
  return { database, sellers, service };
}

describe('Seller catalog match preview', () => {
  it('returns verified public product identity and limits compatibility evidence', async () => {
    const { service, database, sellers } = arrange();
    const result = await service.previewCatalogProduct(
      '11111111-1111-4111-8111-111111111111', 'seller-user',
    );
    expect(result.name).toBe('Brake Pads');
    expect(sellers.requireOperationalSellerByUser).toHaveBeenCalledWith('seller-user');
    expect(database.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: '11111111-1111-4111-8111-111111111111',
        status: ProductStatus.ACTIVE,
      },
      select: expect.objectContaining({
        partNumbers: expect.objectContaining({
          select: { type: true, partNumber: true },
        }),
        compatibilities: expect.objectContaining({
          take: 40,
        }),
      }),
    }));
  });

  it('never exposes a non-Active product or another Seller Draft', async () => {
    const { service, database } = arrange();
    database.product.findFirst.mockResolvedValueOnce(null);
    await expect(service.previewCatalogProduct(
      '22222222-2222-4222-8222-222222222222', 'seller-user',
    )).rejects.toThrow('selected approved product is unavailable');
  });

  it('does not query the catalog for an ineligible Seller account', async () => {
    const { service, database, sellers } = arrange();
    sellers.requireOperationalSellerByUser.mockRejectedValueOnce(new Error('Seller not operational'));
    await expect(service.previewCatalogProduct(
      '11111111-1111-4111-8111-111111111111', 'seller-user',
    )).rejects.toThrow('not operational');
    expect(database.product.findFirst).not.toHaveBeenCalled();
  });
});
