import { describe, expect, it } from 'vitest';
import type { ProductTypeRecord } from './catalog-contracts';
import {
  buildProductTypePaths,
  toDraftValues,
  toProductValues,
  type ProductSchemaAttribute,
} from './product-master-form';

const attributes: ProductSchemaAttribute[] = [
  { code: 'ATTR_QTY', dataType: 'INTEGER' },
  { code: 'ATTR_PRICE', dataType: 'DECIMAL' },
  { code: 'ATTR_FLAG', dataType: 'BOOLEAN' },
  { code: 'ATTR_POSITION', dataType: 'SELECT' },
  { code: 'ATTR_TAGS', dataType: 'MULTI_SELECT' },
];

describe('Product Master form helpers', () => {
  it('converts browser draft values to schema-typed Product values', () => {
    expect(
      toProductValues(attributes, {
        ATTR_QTY: '4',
        ATTR_PRICE: '12.5',
        ATTR_FLAG: 'true',
        ATTR_POSITION: 'FRONT',
        ATTR_TAGS: ['OEM', 'PREMIUM'],
      }),
    ).toEqual({
      ATTR_QTY: 4,
      ATTR_PRICE: 12.5,
      ATTR_FLAG: true,
      ATTR_POSITION: 'FRONT',
      ATTR_TAGS: ['OEM', 'PREMIUM'],
    });
  });

  it('restores persisted values into editable browser draft values', () => {
    expect(
      toDraftValues(attributes, {
        ATTR_QTY: 4,
        ATTR_FLAG: false,
        ATTR_TAGS: ['OEM', 'PREMIUM'],
      }),
    ).toEqual({
      ATTR_QTY: '4',
      ATTR_FLAG: 'false',
      ATTR_TAGS: ['OEM', 'PREMIUM'],
    });
  });

  it('builds nested Product Type paths', () => {
    const root = {
      id: 'root',
      categoryId: 'category',
      productFamilyId: null,
      parentId: null,
      code: 'BRAKE',
      name: 'Brake',
      slug: 'brake',
      description: null,
      sortOrder: 0,
      brandRequirement: 'OPTIONAL',
      identifierRequirement: 'ANY_PART_NUMBER',
      gtinRequirement: 'OPTIONAL',
      oemReferenceRequirement: 'OPTIONAL',
      crossReferenceRequirement: 'OPTIONAL',
      fitmentRequirement: 'REQUIRED',
      imageRequirement: 'REQUIRED',
      minimumImageCount: 1,
      documentRequirement: 'OPTIONAL',
      minimumDocumentCount: 0,
      priceRequirement: 'REQUIRED',
      stockRequirement: 'REQUIRED',
      conditionRequirement: 'REQUIRED',
      warrantyRequirement: 'OPTIONAL',
      status: 'ACTIVE',
      version: 1,
      currentSchemaVersionId: null,
      createdAt: '',
      updatedAt: '',
    } satisfies ProductTypeRecord;
    const child = {
      ...root,
      id: 'child',
      parentId: root.id,
      code: 'BRAKE_PAD',
      name: 'Brake Pad',
      slug: 'brake-pad',
    } satisfies ProductTypeRecord;

    expect(buildProductTypePaths([root, child]).get(child.id)).toBe(
      'Brake / Brake Pad',
    );
  });
});
