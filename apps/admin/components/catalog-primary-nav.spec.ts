import { describe, expect, it } from 'vitest';
import { normalizeCatalogSection } from './catalog-primary-nav';

describe('CatalogPrimaryNav legacy section normalization', () => {
  it.each([
    ['workspace', 'product-types'],
    ['products', 'product-types'],
    ['structure', 'part-groups'],
    ['product-types', 'product-types'],
    ['attributes', 'attributes'],
  ] as const)('maps %s to the canonical %s tab', (section, expected) => {
    expect(normalizeCatalogSection(section)).toBe(expected);
  });
});
