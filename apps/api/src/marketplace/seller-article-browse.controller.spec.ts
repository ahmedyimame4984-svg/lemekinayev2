import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service.js';
import { SellerArticleBrowseController } from './seller-article-browse.controller.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup() {
  const database = {
    user: { findFirst: vi.fn().mockResolvedValue({ id: userId }) },
    product: { findMany: vi.fn().mockResolvedValue([
      { id: 'article-id', name: 'Oil Filter', publishedAt: new Date(), brand: { name: 'Brand' }, productType: { name: 'Filters' } },
    ]) },
  };
  return { database, controller: new SellerArticleBrowseController(database as unknown as DatabaseService) };
}

describe('Read-only Seller Article browsing', () => {
  it('serves only approved Products to a verified, authenticated Seller account', async () => {
    const { controller, database } = setup();
    const response = await controller.browse({ userId } as never, { q: 'oil' });
    expect(response.articles).toHaveLength(1);
    expect(database.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'ACTIVE' }),
      take: 50,
    }));
    expect(database.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: userId,
        emailVerifiedAt: { not: null },
      }),
    }));
  });

  it('never reveals catalog records to an unverified account', async () => {
    const { controller, database } = setup();
    database.user.findFirst.mockResolvedValue(null);
    await expect(controller.browse({ userId } as never, {})).resolves.toEqual({ articles: [] });
    expect(database.product.findMany).not.toHaveBeenCalled();
  });
});
