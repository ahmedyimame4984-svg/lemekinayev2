import { normalizeGtin, type PendingArticleIdentifiers } from './seller-article-identifiers';

export interface InlineSellerArticle {
  productTypeId: string;
  brandId: string;
  manufacturerPartNumber: string;
  duplicateReviewReason: string;
  values: Record<string, unknown>;
  identifiers: PendingArticleIdentifiers;
}

export const emptyInlineSellerArticle: InlineSellerArticle = {
  productTypeId: '',
  brandId: '',
  manufacturerPartNumber: '',
  duplicateReviewReason: '',
  values: {},
  identifiers: {
    gtinType: 'GTIN_13', gtin: '', oeReference: '',
    crossReference: '', issuerBrandId: '',
  },
};

export function inlineEntryArticlePayload(value: InlineSellerArticle) {
  return {
    article: {
      productTypeId: value.productTypeId,
      ...(value.brandId ? { brandId: value.brandId } : {}),
      ...(value.manufacturerPartNumber.trim() ? { manufacturerPartNumber: value.manufacturerPartNumber.trim() } : {}),
      ...(value.duplicateReviewReason.trim() ? { duplicateReviewReason: value.duplicateReviewReason.trim() } : {}),
      values: value.values,
    },
    identifiers: {
      ...(value.identifiers.gtin.trim() ? {
        gtin: normalizeGtin(value.identifiers.gtin), gtinType: value.identifiers.gtinType,
      } : {}),
      ...(value.identifiers.oeReference.trim() ? { oeReference: value.identifiers.oeReference.trim() } : {}),
      ...(value.identifiers.crossReference.trim() ? { crossReference: value.identifiers.crossReference.trim() } : {}),
      ...(value.identifiers.issuerBrandId ? { issuerBrandId: value.identifiers.issuerBrandId } : {}),
    },
  };
}
