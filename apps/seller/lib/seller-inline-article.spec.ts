import { describe, expect, it } from 'vitest';
import {
  emptyInlineSellerArticle,
  inlineEntryArticlePayload,
} from './seller-inline-article';

describe('Seller inline Article input', () => {
  it('includes only canonical published Article fields', () => {
    const result = inlineEntryArticlePayload({
      ...emptyInlineSellerArticle,
      productTypeId: 'type-id',
      brandId: 'brand-id',
      manufacturerPartNumber: ' 123-ABC ',
      values: { MATERIAL: 'CERAMIC' },
      identifiers: {
        gtinType: 'GTIN_13',
        gtin: '4006381333931',
        oeReference: ' OE-39 ',
        crossReference: '',
        issuerBrandId: 'issuer-id',
      },
    });
    expect(result).toEqual({
      article: {
        productTypeId: 'type-id',
        brandId: 'brand-id',
        manufacturerPartNumber: '123-ABC',
        values: { MATERIAL: 'CERAMIC' },
      },
      identifiers: {
        gtin: '4006381333931',
        gtinType: 'GTIN_13',
        oeReference: 'OE-39',
        issuerBrandId: 'issuer-id',
      },
    });
  });

  it('sends a normalized GTIN with leading zeros to the Inventory one-save API', () => {
    const result = inlineEntryArticlePayload({
      ...emptyInlineSellerArticle,
      productTypeId: 'type-id',
      identifiers: {
        ...emptyInlineSellerArticle.identifiers,
        gtinType: 'GTIN_12',
        gtin: ' 0360-0029 1452 ',
      },
    });
    expect(result.identifiers).toEqual({ gtin: '036000291452', gtinType: 'GTIN_12' });
  });

  it('omits blank manufacturer identity and identifier fields', () => {
    expect(inlineEntryArticlePayload({
      ...emptyInlineSellerArticle, productTypeId: 'type-id',
    })).toEqual({
      article: { productTypeId: 'type-id', values: {} },
      identifiers: {},
    });
  });

  it('preserves duplicate review evidence when explicitly provided', () => {
    const reason = 'Different connector housing and dimensions.';
    expect(inlineEntryArticlePayload({
      ...emptyInlineSellerArticle, productTypeId: 'type-id',
      duplicateReviewReason: reason,
    }).article.duplicateReviewReason).toBe(reason);
  });
});
