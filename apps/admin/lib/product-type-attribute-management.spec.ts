import { describe, expect, it } from 'vitest';
import type {
  AttributeDefinitionRecord,
  ProductTypeAttributeAssignmentRecord,
} from './catalog-attribute-contracts';
import {
  buildValidationRule,
  getAvailableAttributes,
  hasCatalogManagePermission,
  resolveAvailableAttributes,
  parseOptionalRuleJson,
} from './product-type-attribute-management';

const attribute = (id: string, code: string): AttributeDefinitionRecord => ({
  id,
  groupId: null,
  optionSetId: null,
  unitDimensionId: null,
  defaultUnitId: null,
  code,
  name: code,
  dataType: 'TEXT',
  scope: 'PRODUCT',
  valueSource: 'NONE',
  unit: null,
  description: null,
  exampleValue: null,
  validationRule: null,
  repeatable: false,
  translatable: false,
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
});

const assignment = (attributeId: string): ProductTypeAttributeAssignmentRecord => ({
  id: `assignment-${attributeId}`,
  productTypeId: 'product-type',
  attributeId,
  requirement: 'OPTIONAL',
  displayMode: 'VISIBLE',
  displayOrder: 0,
  validationRule: null,
  conditionalRule: null,
  defaultUnitId: null,
  searchable: false,
  filterable: false,
  comparable: false,
  variantDefining: false,
  marketplaceVisible: true,
  sellerEditable: true,
  status: 'DRAFT',
  version: 1,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
});

describe('Product Type attribute management helpers', () => {
  it('checks catalog.manage explicitly', () => {
    expect(hasCatalogManagePermission(['catalog.manage'])).toBe(true);
    expect(hasCatalogManagePermission(['vehicle.manage'])).toBe(false);
  });

  it('returns only unassigned attributes in canonical-code order', () => {
    expect(
      getAvailableAttributes(
        [attribute('b', 'ATTR_Z'), attribute('a', 'ATTR_A')],
        [assignment('b')],
      ).map((item) => item.code),
    ).toEqual(['ATTR_A']);
  });

  it('recovers availability from the master Attribute Library when the dedicated endpoint is empty', () => {
    expect(
      resolveAvailableAttributes(
        [attribute('a', 'ATTR_A'), attribute('b', 'ATTR_B')],
        [assignment('b')],
        [],
      ).map((item) => item.code),
    ).toEqual(['ATTR_A']);
  });

  it('falls back to the dedicated availability response when the master library request is unavailable', () => {
    expect(
      resolveAvailableAttributes(
        [],
        [assignment('b')],
        [attribute('a', 'ATTR_A'), attribute('b', 'ATTR_B')],
      ).map((item) => item.code),
    ).toEqual(['ATTR_A']);
  });

  it('builds structured validation ranges without raw JSON', () => {
    expect(
      buildValidationRule({
        min: '1.5',
        max: '10',
        minLength: '',
        maxLength: '',
      }),
    ).toEqual({ min: 1.5, max: 10 });

    expect(
      buildValidationRule({
        min: '',
        max: '',
        minLength: '2',
        maxLength: '8',
      }),
    ).toEqual({ minLength: 2, maxLength: 8 });

    expect(() =>
      buildValidationRule({
        min: '10',
        max: '2',
        minLength: '',
        maxLength: '',
      }),
    ).toThrow('Minimum cannot be greater than maximum.');

    expect(() =>
      buildValidationRule({
        min: '',
        max: '',
        minLength: '1.5',
        maxLength: '',
      }),
    ).toThrow('Minimum length must be a non-negative whole number.');
  });

  it('parses optional rule JSON objects and rejects arrays', () => {
    expect(parseOptionalRuleJson('')).toBeNull();
    expect(parseOptionalRuleJson('{"operator":"EQUALS"}')).toEqual({
      operator: 'EQUALS',
    });
    expect(() => parseOptionalRuleJson('[1,2]')).toThrow(
      'Rule JSON must be a JSON object.',
    );
  });
});
