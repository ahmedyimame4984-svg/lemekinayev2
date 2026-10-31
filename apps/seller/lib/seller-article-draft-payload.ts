/**
 * Only published Product Type identity fields and technical values belong in
 * the canonical Article submission. Seller-specific description, stock, price,
 * media, and delivery details must not leak into the shared Article.
 */
export interface SellerArticleDraftInput {
  productTypeId: string;
  brandId?: string | null;
  manufacturerPartNumber?: string | null;
  duplicateReviewReason?: string | null;
  values: Record<string, unknown>;
}

export function buildSellerArticleDraftPayload(input: SellerArticleDraftInput) {
  const brandId = input.brandId?.trim();
  const manufacturerPartNumber = input.manufacturerPartNumber?.trim();
  const duplicateReviewReason = input.duplicateReviewReason?.trim();

  return {
    productTypeId: input.productTypeId,
    ...(brandId ? { brandId } : {}),
    ...(manufacturerPartNumber ? { manufacturerPartNumber } : {}),
    ...(duplicateReviewReason ? { duplicateReviewReason } : {}),
    values: input.values,
  };
}
