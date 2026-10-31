import { describe, expect, it } from 'vitest';
import {
  MASTER_ATTRIBUTE_LIBRARY,
  validateMasterAttributeLibrary,
} from './master-attribute-library.js';
import { COMMON_ATTRIBUTE_CODES } from './master-reference-data.js';
import {
  NON_TECHNICAL_ATTRIBUTE_CODES,
  NON_TECHNICAL_ATTRIBUTE_GROUP_CODES,
} from '../catalog/catalog-attribute-policy.js';

describe('Master Attribute Library v2', () => {
  it('is structurally valid and all references resolve', () => {
    expect(validateMasterAttributeLibrary()).toEqual([]);
  });

  it('retains every platform-critical common attribute code', () => {
    const codes = new Set(
      MASTER_ATTRIBUTE_LIBRARY.attributes.map((attribute) => attribute.code),
    );

    for (const code of COMMON_ATTRIBUTE_CODES) {
      expect(codes.has(code), `Missing common attribute ${code}`).toBe(true);
    }
  });

  it('provides a broad normalized automotive foundation rather than a flat demo list', () => {
    const unitCount = MASTER_ATTRIBUTE_LIBRARY.unitDimensions.reduce(
      (total, dimension) => total + dimension.units.length,
      0,
    );
    const optionValueCount = MASTER_ATTRIBUTE_LIBRARY.optionSets.reduce(
      (total, optionSet) => total + optionSet.values.length,
      0,
    );

    expect(MASTER_ATTRIBUTE_LIBRARY.groups.length).toBeGreaterThanOrEqual(20);
    expect(MASTER_ATTRIBUTE_LIBRARY.unitDimensions.length).toBeGreaterThanOrEqual(15);
    expect(unitCount).toBeGreaterThanOrEqual(25);
    expect(MASTER_ATTRIBUTE_LIBRARY.optionSets.length).toBeGreaterThanOrEqual(25);
    expect(optionValueCount).toBeGreaterThanOrEqual(100);
    expect(MASTER_ATTRIBUTE_LIBRARY.attributes.length).toBeGreaterThanOrEqual(180);
  });

  it('supports multi-function lighting assemblies with complete controlled values', () => {
    const lightFunction = MASTER_ATTRIBUTE_LIBRARY.attributes.find(
      (attribute) => attribute.code === 'ATTR_LIGHT_FUNCTION',
    );
    const optionSet = MASTER_ATTRIBUTE_LIBRARY.optionSets.find(
      (set) => set.code === 'LIGHT_FUNCTION',
    );

    expect(lightFunction).toMatchObject({
      dataType: 'SELECT',
      optionSetCode: 'LIGHT_FUNCTION',
      repeatable: true,
    });
    expect(optionSet?.values.map((value) => value.label)).toEqual(
      expect.arrayContaining([
        'Low Beam',
        'High Beam',
        'Turn Signal',
        'Side Marker',
        'License Plate',
        'Interior / Courtesy',
        'Cargo',
      ]),
    );
  });

  it('keeps compatibility values generated from reusable Option Sets', () => {
    const selectable = MASTER_ATTRIBUTE_LIBRARY.attributes.filter(
      (attribute) =>
        attribute.dataType === 'SELECT' ||
        attribute.dataType === 'MULTI_SELECT',
    );

    for (const attribute of selectable) {
      const values = MASTER_ATTRIBUTE_LIBRARY.allowedValues.filter(
        (value) => value.attributeCode === attribute.code,
      );
      expect(values.length, `No values generated for ${attribute.code}`).toBeGreaterThan(0);
    }
  });
  it('keeps the generic Attribute Library technical-only', () => {
    const groupCodes = new Set(
      MASTER_ATTRIBUTE_LIBRARY.groups.map((group) => group.code),
    );
    const attributeCodes = new Set(
      MASTER_ATTRIBUTE_LIBRARY.attributes.map((attribute) => attribute.code),
    );

    for (const code of NON_TECHNICAL_ATTRIBUTE_GROUP_CODES) {
      expect(groupCodes.has(code), `Nontechnical group ${code} must not be seeded`).toBe(false);
    }

    for (const code of NON_TECHNICAL_ATTRIBUTE_CODES) {
      expect(attributeCodes.has(code), `Nontechnical attribute ${code} must not be seeded`).toBe(false);
    }
  });

});
