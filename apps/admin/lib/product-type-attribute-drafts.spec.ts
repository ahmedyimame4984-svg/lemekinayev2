import { describe, expect, it } from 'vitest';
import type { ProductTypeAttributeAssignmentRecord } from './catalog-attribute-contracts';
import {
  ATTRIBUTE_SETTINGS_LIMIT_MESSAGE,
  stageAttributeSettings,
  stageAttributeSettingsBatch,
  verifySavedAttributeSettings,
} from './product-type-attribute-drafts';

const saved = {
  id: 'row-1', requirement: 'OPTIONAL', displayMode: 'VISIBLE',
  displayOrder: 10, searchable: false, filterable: false,
  comparable: false, variantDefining: false, marketplaceVisible: true,
  sellerEditable: true,
} as ProductTypeAttributeAssignmentRecord;

describe('local staged Attribute settings', () => {
  it('stages multiple changes without modifying the saved record', () => {
    const first = stageAttributeSettings({}, saved, { requirement: 'MANDATORY' });
    const result = stageAttributeSettings(first, saved, { searchable: true });
    expect(result[saved.id]).toEqual({ requirement: 'MANDATORY', searchable: true });
    expect(saved.requirement).toBe('OPTIONAL');
  });
  it('does not mix changes for different Attributes', () => {
    const first = stageAttributeSettings({}, saved, { filterable: true });
    const result = stageAttributeSettings(first, { ...saved, id: 'row-2' }, { sellerEditable: false });
    expect(result).toEqual({ 'row-1': { filterable: true }, 'row-2': { sellerEditable: false } });
  });
  it('removes the pending edit when a value is restored to its saved setting', () => {
    const first = stageAttributeSettings({}, saved, { searchable: true, requirement: 'MANDATORY' });
    const second = stageAttributeSettings(first, saved, { searchable: false });
    expect(stageAttributeSettings(second, saved, { requirement: 'OPTIONAL' })).toEqual({});
  });
});

describe('bounded atomic Attribute staging', () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({
    ...saved, id: `row-${index}`, productTypeId: 'product-type-1', version: 1,
  }));

  it('allows exactly 200 edited rows and verifies the complete saved response', () => {
    const result = stageAttributeSettingsBatch({}, rows.slice(0, 200), { searchable: true });
    expect(result.error).toBe('');
    expect(Object.keys(result.drafts)).toHaveLength(200);
    const requested = rows.slice(0, 200).map((row) => ({
      id: row.id, version: row.version, ...result.drafts[row.id],
    }));
    const response = rows.slice(0, 200).map((row) => ({
      ...row, ...result.drafts[row.id], version: row.version + 1,
    }));
    expect(verifySavedAttributeSettings(requested, response, 'product-type-1')).toHaveLength(200);
  });

  it('rejects a 201st edited row without modifying the existing 200 drafts', () => {
    const current = stageAttributeSettingsBatch({}, rows.slice(0, 200), { searchable: true }).drafts;
    const before = structuredClone(current);
    const result = stageAttributeSettingsBatch(current, [rows[200]], { comparable: true });
    expect(result).toEqual({ drafts: before, error: ATTRIBUTE_SETTINGS_LIMIT_MESSAGE });
    expect(result.drafts).toBe(current);
    expect(current).toEqual(before);
    expect(result.drafts[rows[200].id]).toBeUndefined();
  });

  it('rejects an oversized bulk action without staging a partial selection', () => {
    const current = stageAttributeSettingsBatch({}, [rows[0]], { comparable: true }).drafts;
    const result = stageAttributeSettingsBatch(current, rows, { searchable: true });
    expect(result.error).toBe(ATTRIBUTE_SETTINGS_LIMIT_MESSAGE);
    expect(result.drafts).toBe(current);
    expect(result.drafts).toEqual({ [rows[0].id]: { comparable: true } });
  });

  it('rejects an oversized bulk selection even when there are no prior edits', () => {
    expect(stageAttributeSettingsBatch({}, rows, { searchable: true })).toEqual({
      drafts: {}, error: ATTRIBUTE_SETTINGS_LIMIT_MESSAGE,
    });
  });

  it('allows more settings on already-edited rows at the limit', () => {
    const current = stageAttributeSettingsBatch({}, rows.slice(0, 200), { searchable: true }).drafts;
    const result = stageAttributeSettingsBatch(current, rows.slice(0, 200), { sellerEditable: false });
    expect(result.error).toBe('');
    expect(Object.keys(result.drafts)).toHaveLength(200);
    expect(result.drafts[rows[0].id]).toEqual({ searchable: true, sellerEditable: false });
  });

  it('allows reverting a row at the limit and staging a different row afterward', () => {
    const current = stageAttributeSettingsBatch({}, rows.slice(0, 200), { searchable: true }).drafts;
    const reverted = stageAttributeSettingsBatch(current, [rows[0]], { searchable: false });
    expect(reverted.error).toBe('');
    expect(Object.keys(reverted.drafts)).toHaveLength(199);
    const result = stageAttributeSettingsBatch(reverted.drafts, [rows[200]], { searchable: true });
    expect(result.error).toBe('');
    expect(Object.keys(result.drafts)).toHaveLength(200);
    expect(result.drafts[rows[0].id]).toBeUndefined();
  });

  it('counts actual edits rather than selected rows', () => {
    const current = stageAttributeSettingsBatch({}, rows.slice(0, 200), { searchable: true }).drafts;
    const result = stageAttributeSettingsBatch(current, rows, { searchable: false });
    expect(result).toEqual({ drafts: {}, error: '' });
  });
});

describe('Save All response verification', () => {
  const expected = [
    { id: 'row-1', version: 1, searchable: true, requirement: 'MANDATORY' as const },
    { id: 'row-2', version: 2, filterable: true, sellerEditable: false },
  ];
  const first = {
    ...saved, productTypeId: 'product-type-1', version: 2,
    searchable: true, requirement: 'MANDATORY',
  } as ProductTypeAttributeAssignmentRecord;
  const second = {
    ...saved, id: 'row-2', productTypeId: 'product-type-1',
    version: 3, filterable: true, sellerEditable: false,
  } as ProductTypeAttributeAssignmentRecord;
  const savedRows = [first, second];

  it('confirms all requested rows, advanced settings and incremented versions', () => {
    expect(verifySavedAttributeSettings(expected, savedRows, 'product-type-1'))
      .toEqual(savedRows);
    expect(expected[0].version).toBe(1);
  });

  it('rejects empty, missing and malformed responses instead of confirming a save', () => {
    for (const response of [[], [first], null, {}, [first, null]]) {
      expect(() => verifySavedAttributeSettings(expected, response, 'product-type-1'))
        .toThrow('Your edits are retained');
    }
  });

  it('rejects duplicate, foreign and unexpected assignment IDs', () => {
    for (const response of [
      [first, first],
      [first, { ...second, id: 'another-row' }],
      [first, { ...second, productTypeId: 'wrong-type' }],
    ]) {
      expect(() => verifySavedAttributeSettings(expected, response, 'product-type-1'))
        .toThrow('Your edits are retained');
    }
  });

  it('rejects unchanged versions and saved values that differ from staged edits', () => {
    for (const response of [
      [first, { ...second, version: 2 }],
      [{ ...first, searchable: false }, second],
      [first, { ...second, sellerEditable: true }],
      [{ ...first, requirement: 'OPTIONAL' }, second],
    ]) {
      expect(() => verifySavedAttributeSettings(expected, response, 'product-type-1'))
        .toThrow('Your edits are retained');
    }
  });
});
