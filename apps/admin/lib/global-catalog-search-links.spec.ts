import { describe, expect, it } from 'vitest';
import {
  globalSearchArticleHref,
  globalSearchBrandHref,
  globalSearchProductTypeHref,
  globalSearchVehicleHref,
} from './global-catalog-search-links';

describe('Global Catalog Search workflow links', () => {
  it('opens exact Product Type and Article records', () => {
    expect(globalSearchProductTypeHref({ id: 'pt-1' })).toBe(
      '/admin/catalog/product-types?productTypeId=pt-1',
    );
    expect(globalSearchArticleHref('article-1')).toBe(
      '/admin/catalog/article-review/article-1',
    );
  });

  it('pre-filters Brand Master using the canonical Brand name', () => {
    expect(
      globalSearchBrandHref({ name: 'Bosch', code: 'BOSCH' }),
    ).toBe('/admin/catalog/brands?search=Bosch');
  });

  it('deep-links the exact configured vehicle by canonical UUID', () => {
    expect(
      globalSearchVehicleHref({
        vehicleConfigurationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe(
      '/admin/vehicles/configurations?configurationId=11111111-1111-4111-8111-111111111111',
    );
  });
});
