/** Catalog hierarchy is fetched independently from publish-ready Product Types. */
export interface SellerArticleClassification {
  categories: Array<{ id: string; name: string }>;
  partGroups: Array<{ id: string; categoryId: string; name: string }>;
}

export function getPartGroupsForCategory(
  groups: ReadonlyArray<SellerArticleClassification['partGroups'][number]>,
  categoryId: string,
) {
  return categoryId ? groups.filter(group => group.categoryId === categoryId) : [];
}

export function getProductTypesForPartGroup<T extends {
  categoryId: string;
  productFamilyId: string;
}>(
  productTypes: readonly T[],
  categoryId: string,
  partGroupId: string,
): T[] {
  if (!categoryId || !partGroupId) return [];
  return productTypes.filter(type =>
    type.categoryId === categoryId && type.productFamilyId === partGroupId,
  );
}
