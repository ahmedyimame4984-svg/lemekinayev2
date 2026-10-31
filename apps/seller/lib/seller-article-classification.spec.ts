import { describe, expect, it } from 'vitest';
import {
  getPartGroupsForCategory,
  getProductTypesForPartGroup,
} from './seller-article-classification';

const groups = [
  { id: 'g1', categoryId: 'brakes', name: 'Brake Pads' },
  { id: 'g2', categoryId: 'engine', name: 'Filters' },
  { id: 'g3', categoryId: 'brakes', name: 'Brake Discs' },
];

describe('Seller Article DB classification hierarchy', () => {
  it('preserves a Category and Part Group even when no Product Types are published', () => {
    expect(getPartGroupsForCategory(groups, 'brakes').map(x => x.id)).toEqual(['g1', 'g3']);
    expect(getProductTypesForPartGroup([], 'brakes', 'g1')).toEqual([]);
  });

  it('resets dependent options and never shows Product Types from another Category', () => {
    const types = [
      { id: 'p1', categoryId: 'brakes', productFamilyId: 'g1' },
      { id: 'p2', categoryId: 'engine', productFamilyId: 'g2' },
    ];
    expect(getProductTypesForPartGroup(types, 'brakes', 'g1').map(x => x.id)).toEqual(['p1']);
    expect(getProductTypesForPartGroup(types, 'brakes', 'g2')).toEqual([]);
    expect(getPartGroupsForCategory(groups, '')).toEqual([]);
    expect(getProductTypesForPartGroup(types, 'brakes', '')).toEqual([]);
  });
});
