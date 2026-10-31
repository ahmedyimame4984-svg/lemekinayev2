import { describe, expect, it } from 'vitest';
import {
  ProductTypeIdentifierRequirement,
  ProductTypeRequirementLevel,
} from '@prisma/client';
import { articleRequirementColumnsFromSchema } from './article-requirement-snapshot.js';

const L = ProductTypeRequirementLevel;
const I = ProductTypeIdentifierRequirement;

function version(
  article: Record<string, unknown>,
  offer: Record<string, unknown>,
) {
  return {
    schemaKind: 'PRODUCT_TYPE_SCHEMA',
    contractVersion: 2,
    productType: { id: 'type-id' },
    articleRequirements: article,
    offerRequirements: offer,
    attributes: [],
  };
}

describe('Product Article frozen requirement columns', () => {
  it('maps every requirement from the Article-bound published schema', () => {
    const result = articleRequirementColumnsFromSchema(
      version(
        {
          brand: 'REQUIRED',
          identifier: 'MANUFACTURER_PART_NUMBER',
          gtin: 'REQUIRED',
          oeReference: 'REQUIRED',
          crossReference: 'NOT_APPLICABLE',
          fitment: 'OPTIONAL',
          image: 'OPTIONAL',
          minimumImageCount: 0,
          maximumImageCount: 4,
          document: 'REQUIRED',
          minimumDocumentCount: 2,
        },
        {
          price: 'REQUIRED',
          stock: 'OPTIONAL',
          condition: 'REQUIRED',
          warranty: 'REQUIRED',
        },
      ),
    );

    expect(result).toEqual({
      brandRequirement: L.REQUIRED,
      identifierRequirement: I.MANUFACTURER_PART_NUMBER,
      gtinRequirement: L.REQUIRED,
      oemReferenceRequirement: L.REQUIRED,
      crossReferenceRequirement: L.NOT_APPLICABLE,
      fitmentRequirement: L.OPTIONAL,
      imageRequirement: L.OPTIONAL,
      minimumImageCount: 0,
      maximumImageCount: 4,
      documentRequirement: L.REQUIRED,
      minimumDocumentCount: 2,
      priceRequirement: L.REQUIRED,
      stockRequirement: L.OPTIONAL,
      conditionRequirement: L.REQUIRED,
      warrantyRequirement: L.REQUIRED,
    });
  });

  it('retains explicit NOT_APPLICABLE and zero requirements', () => {
    const result = articleRequirementColumnsFromSchema(
      version(
        {
          image: 'NOT_APPLICABLE',
          document: 'NOT_APPLICABLE',
          minimumImageCount: 0,
          minimumDocumentCount: 0,
        },
        {},
      ),
    );
    expect(result.imageRequirement).toBe(L.NOT_APPLICABLE);
    expect(result.documentRequirement).toBe(L.NOT_APPLICABLE);
    expect(result.minimumImageCount).toBe(0);
    expect(result.maximumImageCount).toBe(0);
    expect(result.minimumDocumentCount).toBe(0);
  });

  it('uses documented legacy defaults for older snapshots', () => {
    const result = articleRequirementColumnsFromSchema({
      requirements: { brand: 'REQUIRED', identifier: 'ANY_PART_NUMBER' },
      attributes: [],
    });

    expect(result).toMatchObject({
      brandRequirement: L.REQUIRED,
      identifierRequirement: I.ANY_PART_NUMBER,
      gtinRequirement: L.OPTIONAL,
      fitmentRequirement: L.REQUIRED,
      imageRequirement: L.REQUIRED,
      minimumImageCount: 1,
      maximumImageCount: 20,
      documentRequirement: L.OPTIONAL,
      minimumDocumentCount: 0,
      priceRequirement: L.REQUIRED,
      stockRequirement: L.REQUIRED,
      conditionRequirement: L.REQUIRED,
      warrantyRequirement: L.OPTIONAL,
    });
  });

  it('rejects invalid requirement levels and impossible media counts', () => {
    expect(() =>
      articleRequirementColumnsFromSchema(version({ brand: 'PUBLISHED' }, {})),
    ).toThrow();
    expect(() =>
      articleRequirementColumnsFromSchema(
        version({ minimumDocumentCount: -1 }, {}),
      ),
    ).toThrow();
    expect(() =>
      articleRequirementColumnsFromSchema(
        version({ minimumImageCount: 2.5 }, {}),
      ),
    ).toThrow();
    expect(() =>
      articleRequirementColumnsFromSchema(
        version({ identifier: 'ANY_THING' }, {}),
      ),
    ).toThrow();
    expect(() => articleRequirementColumnsFromSchema(version({ minimumImageCount: 4, maximumImageCount: 2 }, {}))).toThrow();
    expect(() => articleRequirementColumnsFromSchema(version({ maximumImageCount: 21 }, {}))).toThrow();
    expect(() => articleRequirementColumnsFromSchema(null)).toThrow();
  });

  it('preserves legacy OEM policy and rejects malformed requirement sections', () => {
    expect(
      articleRequirementColumnsFromSchema({
        requirements: { oemReference: 'REQUIRED' },
      }).oemReferenceRequirement,
    ).toBe(L.REQUIRED);
    for (const value of [null, [], 'REQUIRED']) {
      expect(() =>
        articleRequirementColumnsFromSchema({ articleRequirements: value }),
      ).toThrow();
      expect(() =>
        articleRequirementColumnsFromSchema({ offerRequirements: value }),
      ).toThrow();
    }
    expect(() =>
      articleRequirementColumnsFromSchema(
        version({ minimumImageCount: '2' }, {}),
      ),
    ).toThrow();
    expect(() =>
      articleRequirementColumnsFromSchema(
        version({ minimumImageCount: 21 }, {}),
      ),
    ).toThrow();
  });

  it('keeps original Article requirements unchanged when the Product Type is republished', () => {
    const oldSchema = version({ brand: 'REQUIRED', gtin: 'OPTIONAL' }, {});
    const original = articleRequirementColumnsFromSchema(oldSchema);
    const newSchema = version({ brand: 'OPTIONAL', gtin: 'REQUIRED' }, {});
    const updated = articleRequirementColumnsFromSchema(newSchema);

    expect(original.brandRequirement).toBe(L.REQUIRED);
    expect(original.gtinRequirement).toBe(L.OPTIONAL);
    expect(updated.brandRequirement).toBe(L.OPTIONAL);
    expect(updated.gtinRequirement).toBe(L.REQUIRED);
    expect(original).not.toEqual(updated);
  });
});
