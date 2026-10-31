import { describe, expect, it } from 'vitest';
import { validateSellerInventoryEntry } from './seller-inventory-entry';

const valid = {
  productId: 'article-one', locationId: 'store-one', availableLocationIds: ['store-one'],
  packageQuantity: 1, openingQuantity: 0,
};

describe('Article-first Inventory entry', () => {
  it('accepts zero opening stock and valid package size for a selected Article', () => {
    expect(validateSellerInventoryEntry(valid)).toBeNull();
  });
  it('requires an Article and a Seller-selected existing Location', () => {
    expect(validateSellerInventoryEntry({ ...valid, productId: '' })).toMatch(/Product Article/);
    expect(validateSellerInventoryEntry({ ...valid, locationId: 'another-store' })).toMatch(/Store or Warehouse/);
  });
  it('rejects negative, fractional and unsafe quantities before stock persistence', () => {
    expect(validateSellerInventoryEntry({ ...valid, packageQuantity: 0 })).toMatch(/Package quantity/);
    expect(validateSellerInventoryEntry({ ...valid, packageQuantity: 1.5 })).toMatch(/Package quantity/);
    expect(validateSellerInventoryEntry({ ...valid, openingQuantity: -1 })).toMatch(/Opening stock/);
    expect(validateSellerInventoryEntry({ ...valid, openingQuantity: Number.MAX_SAFE_INTEGER + 1 })).toMatch(/Opening stock/);
    expect(validateSellerInventoryEntry({ ...valid, openingQuantity: Number.NaN })).toMatch(/Opening stock/);
  });
});
