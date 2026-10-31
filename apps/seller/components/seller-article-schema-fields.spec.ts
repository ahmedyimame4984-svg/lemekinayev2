import { describe, expect, it } from 'vitest';
import { groupSellerAttributes, hasSchemaValue, isAttributeRequired } from './seller-article-schema-fields';
import type { SellerSchemaAttribute } from '@/lib/seller-contracts';

describe('Published Article attribute form', () => {
  it('keeps published ordering when grouping technical specifications', () => {
    const attrs: SellerSchemaAttribute[] = [
      { code: 'height', name: 'Height', group: { name: 'Dimensions' } },
      { code: 'weight', name: 'Weight', group: { name: 'Dimensions' } },
      { code: 'material', name: 'Material' },
    ];
    expect(groupSellerAttributes(attrs).map(group => [group.name, group.attributes.map(x => x.code)])).toEqual([
      ['Dimensions', ['height', 'weight']],
      ['Other specifications', ['material']],
    ]);
    expect(attrs).toHaveLength(3);
  });

  it('distinguishes required and conditional requirements without marking all values globally unique', () => {
    expect(isAttributeRequired({ requirement: 'MANDATORY' }, {})).toBe(true);
    expect(isAttributeRequired({ requirement: 'OPTIONAL' }, {})).toBe(false);
    expect(isAttributeRequired({ requirement: 'CONDITIONAL', conditionalRule: {
      operator: 'EQUALS', attributeCode: 'fuel', value: 'DIESEL',
    } }, { fuel: 'DIESEL' })).toBe(true);
    expect(isAttributeRequired({ requirement: 'CONDITIONAL', conditionalRule: {
      operator: 'EQUALS', attributeCode: 'fuel', value: 'DIESEL',
    } }, { fuel: 'PETROL' })).toBe(false);
  });

  it('allows valid zero and false values while rejecting empty values', () => {
    expect(hasSchemaValue(0)).toBe(true);
    expect(hasSchemaValue(false)).toBe(true);
    expect(hasSchemaValue('  ')).toBe(false);
    expect(hasSchemaValue([])).toBe(false);
  });
});
