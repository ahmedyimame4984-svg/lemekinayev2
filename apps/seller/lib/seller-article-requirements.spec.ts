import { describe, expect, it } from 'vitest';
import { articleRequirements, requiredArticleFieldError } from './seller-article-requirements';
import { emptyPendingArticleIdentifiers } from './seller-article-identifiers';
import type { SellerArticleProductType, SellerProductTypeSchema } from './seller-contracts';

const type = {
  brandRequirement: 'OPTIONAL', identifierRequirement: 'OPTIONAL',
  oeReferenceRequirement: 'OPTIONAL', crossReferenceRequirement: 'OPTIONAL', fitmentRequirement: 'OPTIONAL',
} as SellerArticleProductType;
const schema = (rules: Record<string, unknown>) => ({
  id: 'schema', productTypeId: 'type', schemaVersion: 1, schemaHash: 'hash', publishedAt: '2026-10-17',
  snapshot: { articleRequirements: rules },
}) satisfies SellerProductTypeSchema;

describe('published Article requirements', () => {
  it.each(['REQUIRED', 'OPTIONAL', 'NOT_APPLICABLE'] as const)('uses published %s policies instead of current type fields', policy => {
    const result = articleRequirements(schema({ brand: policy, gtin: policy, oeReference: policy,
      crossReference: policy, fitment: policy, identifier: 'NOT_APPLICABLE' }), type);
    expect(result).toEqual({ brandRequirement: policy, gtinRequirement: policy,
      oeReferenceRequirement: policy, crossReferenceRequirement: policy, fitmentRequirement: policy,
      identifierRequirement: 'NOT_APPLICABLE' });
  });
  it('supports legacy published requirements and validates unknown policy values', () => {
    expect(articleRequirements({ ...schema({}), snapshot: { requirements: { brand: 'REQUIRED' } } }, type)
      .brandRequirement).toBe('REQUIRED');
    expect(articleRequirements(schema({ brand: 'INVALID', identifier: 'INVALID' }), type)
      .brandRequirement).toBe('OPTIONAL');
  });
  it.each(['brand', 'identifier', 'gtin', 'oeReference', 'crossReference'])('blocks a missing required %s', field => {
    const requirements = articleRequirements(schema({ [field]: field === 'identifier' ? 'MANUFACTURER_PART_NUMBER' : 'REQUIRED' }), type);
    expect(requiredArticleFieldError(requirements, '', '', emptyPendingArticleIdentifiers)).not.toBeNull();
    expect(requiredArticleFieldError(requirements, 'brand', 'MPN', {
      ...emptyPendingArticleIdentifiers, gtin: '12345670', oeReference: 'OE', crossReference: 'CROSS',
    })).toBeNull();
  });
  it('accepts an applicable reference for an ANY_PART_NUMBER requirement', () => {
    const requirements = articleRequirements(schema({ identifier: 'ANY_PART_NUMBER' }), type);
    expect(requiredArticleFieldError(requirements, '', '', emptyPendingArticleIdentifiers)).not.toBeNull();
    expect(requiredArticleFieldError(requirements, '', '', { ...emptyPendingArticleIdentifiers, oeReference: 'OE' })).toBeNull();
    expect(requiredArticleFieldError({ ...requirements, oeReferenceRequirement: 'NOT_APPLICABLE' }, '', '', { ...emptyPendingArticleIdentifiers, oeReference: 'OE' })).not.toBeNull();
  });
  it.each(['OPTIONAL', 'NOT_APPLICABLE'])('allows empty %s fields and ignores Listing media policies', policy => {
    const requirements = articleRequirements(schema({ brand: policy, identifier: policy, gtin: policy,
      oeReference: policy, crossReference: policy, image: 'REQUIRED', document: 'REQUIRED',
      minimumImageCount: 10, minimumDocumentCount: 10 }), type);
    expect(requiredArticleFieldError(requirements, '', '', emptyPendingArticleIdentifiers)).toBeNull();
  });
});
