import { describe, expect, it } from 'vitest';
import { sellerTablePage } from './seller-table';

const rows = [
  { id: 'a', sku: 'SKU-ALPHA' },
  { id: 'b', sku: 'SKU-BETA' },
  { id: 'c', sku: 'SKU-GAMMA' },
];

describe('Seller record table pagination', () => {
  it('searches case-insensitively without changing the source list', () => {
    const result = sellerTablePage(rows, ' alpha ', row => row.sku, 1, 2);
    expect(result.rows.map(row => row.id)).toEqual(['a']);
    expect(rows).toHaveLength(3);
    expect(result.totalMatches).toBe(1);
  });

  it('paginates and clamps page numbers after filtering', () => {
    expect(sellerTablePage(rows, '', row => row.sku, 2, 2).rows.map(row => row.id)).toEqual(['c']);
    expect(sellerTablePage(rows, '', row => row.sku, 99, 2).page).toBe(2);
    expect(sellerTablePage(rows, 'missing', row => row.sku, 3).page).toBe(1);
    expect(sellerTablePage(rows, 'missing', row => row.sku, 3).rows).toEqual([]);
  });

  it('preserves distinct rows with equal display labels', () => {
    const duplicates = [{ id: '1', sku: 'PART' }, { id: '2', sku: 'PART' }];
    expect(sellerTablePage(duplicates, 'part', row => row.sku, 1).rows).toEqual(duplicates);
  });
});
