import { describe, expect, it } from 'vitest';
import { buildSellerArticleDraftPayload } from './seller-article-draft-payload';

describe('canonical Seller Article payload', () => {
  it('includes published Product Type fields and technical attribute values', () => {
    const values = { POSITION: 'FRONT', MATERIAL: 'CERAMIC' };
    expect(buildSellerArticleDraftPayload({
      productTypeId: 'type',
      brandId: ' brand ',
      manufacturerPartNumber: ' ABC-123 ',
      duplicateReviewReason: ' distinct configuration ',
      values,
    })).toEqual({
      productTypeId: 'type',
      brandId: 'brand',
      manufacturerPartNumber: 'ABC-123',
      duplicateReviewReason: 'distinct configuration',
      values,
    });
  });

  it('omits blank optional identity fields', () => {
    expect(buildSellerArticleDraftPayload({
      productTypeId: 'type',
      brandId: '  ',
      manufacturerPartNumber: '',
      duplicateReviewReason: null,
      values: {},
    })).toEqual({ productTypeId: 'type', values: {} });
  });

  it('never forwards Seller offer data or miscellaneous Article detail fields', () => {
    const supplied = {
      productTypeId: 'type',
      values: { SIZE: 'M' },
      description: 'Seller description',
      sourceReference: 'Seller source',
      manufacturerNotes: 'Unverified notes',
      price: 2000,
      openingQuantity: 8,
    };
    expect(buildSellerArticleDraftPayload(supplied)).toEqual({
      productTypeId: 'type',
      values: { SIZE: 'M' },
    });
  });
});
