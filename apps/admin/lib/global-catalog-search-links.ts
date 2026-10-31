import type {
  GlobalSearchBrandResult,
  GlobalSearchProductTypeResult,
  GlobalSearchVehicleResult,
} from './global-catalog-search-contracts';

export function globalSearchProductTypeHref(
  item: Pick<GlobalSearchProductTypeResult, 'id'>,
): string {
  return `/admin/catalog/product-types?${new URLSearchParams({
    productTypeId: item.id,
  }).toString()}`;
}

export function globalSearchBrandHref(
  item: Pick<GlobalSearchBrandResult, 'name' | 'code'>,
): string {
  return `/admin/catalog/brands?${new URLSearchParams({
    search: item.name || item.code,
  }).toString()}`;
}

export function globalSearchVehicleHref(
  item: Pick<GlobalSearchVehicleResult, 'vehicleConfigurationId'>,
): string {
  return `/admin/vehicles/configurations?${new URLSearchParams({
    configurationId: item.vehicleConfigurationId,
  }).toString()}`;
}

export function globalSearchArticleHref(articleId: string): string {
  return `/admin/catalog/article-review/${articleId}`;
}
