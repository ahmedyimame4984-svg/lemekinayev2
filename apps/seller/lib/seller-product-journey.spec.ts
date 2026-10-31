import { describe, expect, it } from 'vitest';
import { productMatchIssue, resolveSellerProductTab } from './seller-product-journey';

describe('Seller products navigation', () => {
  it('opens Listings by default and redirects old Article tab links', () => {
    expect(resolveSellerProductTab(null)).toBe('listing');
    expect(resolveSellerProductTab('article')).toBe('listing');
    expect(resolveSellerProductTab('listings')).toBe('listing');
  });
  it('retains Inventory and Locations for daily stock management', () => {
    expect(resolveSellerProductTab('inventory')).toBe('inventory');
    expect(resolveSellerProductTab('locations')).toBe('locations');
  });
});

describe('Guided catalog-first product matching', () => {
  it('requires a matched catalog product before moving to stock and pricing', () => {
    const input = {
      source: 'existing' as const, existingArticleId: null,
      newArticleReady: false, fitmentRequired: false, selectedVehicleCount: 0,
    };
    expect(productMatchIssue(input)).toContain('Search for and choose');
    expect(productMatchIssue({ ...input, existingArticleId: 'active-product' }))
      .toContain('Review and confirm');
    expect(productMatchIssue({
      ...input, existingArticleId: 'active-product', catalogConfirmed: true,
    })).toBeNull();
  });
  it('requires technical details and applicable vehicle fitments for new products', () => {
    const input = {
      source: 'new' as const, existingArticleId: null,
      newArticleReady: false, fitmentRequired: true, selectedVehicleCount: 0,
    };
    expect(productMatchIssue(input)).toContain('required product type');
    expect(productMatchIssue({ ...input, newArticleReady: true })).toContain('compatible configured vehicle');
    expect(productMatchIssue({ ...input, newArticleReady: true, selectedVehicleCount: 2 })).toBeNull();
  });
  it('reuses existing Inventory instead of requiring a separate Article selection', () => {
    expect(productMatchIssue({
      inventoryProductId: 'inventory-1', source: 'existing', existingArticleId: null,
      newArticleReady: false, fitmentRequired: false, selectedVehicleCount: 0,
    })).toBeNull();
  });
});
