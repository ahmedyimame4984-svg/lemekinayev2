import { describe, expect, it } from 'vitest';
import { sellerArticleIdentityFingerprint, type SellerArticleIdentity } from './seller-article-full-identity.js';

const base: SellerArticleIdentity = {
  productTypeId: 'type-1',
  brandId: 'brand-1',
  identifiers: [{ type: 'MANUFACTURER', value: 'ABC-123', issuerBrandId: 'brand-1' }],
  attributes: { material: 'ceramic', thickness: 12 },
  vehicleConfigurationIds: ['vehicle-b', 'vehicle-a'],
};

describe('Seller Article full identity', () => {
  it('matches reordered identifiers, attributes and fitments', () => {
    const equivalent: SellerArticleIdentity = {
      ...base,
      identifiers: [{ type: 'manufacturer', value: 'abc 123', issuerBrandId: 'brand-1' }],
      attributes: { thickness: 12, material: 'ceramic' },
      vehicleConfigurationIds: ['vehicle-a', 'vehicle-b', 'vehicle-a'],
    };
    expect(sellerArticleIdentityFingerprint(equivalent)).toBe(sellerArticleIdentityFingerprint(base));
  });

  it.each([
    ['Product Type', { productTypeId: 'type-2' }],
    ['Brand', { brandId: 'brand-2' }],
    ['identifiers', { identifiers: [{ type: 'MANUFACTURER', value: 'ABC-124', issuerBrandId: 'brand-1' }] }],
    ['attributes', { attributes: { material: 'steel', thickness: 12 } }],
    ['fitments', { vehicleConfigurationIds: ['vehicle-a'] }],
  ])('changes identity when %s changes', (_dimension, change) => {
    expect(sellerArticleIdentityFingerprint({ ...base, ...change })).not.toBe(sellerArticleIdentityFingerprint(base));
  });

  it('does not conflate a missing attribute with an explicit null', () => {
    expect(sellerArticleIdentityFingerprint({ ...base, attributes: { thickness: null } }))
      .not.toBe(sellerArticleIdentityFingerprint({ ...base, attributes: {} }));
  });
});
