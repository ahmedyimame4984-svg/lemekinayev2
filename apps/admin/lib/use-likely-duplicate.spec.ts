import { describe, expect, it } from 'vitest';
import {
  findLikelyDuplicate,
  normalizeIdentity,
} from './use-likely-duplicate';

describe('duplicate preflight matching', () => {
  it('normalizes punctuation, spacing, case and Unicode compatibility forms', () => {
    expect(normalizeIdentity(' Bosch-Automotive ')).toBe('boschautomotive');
    expect(normalizeIdentity('ＢＯＳＣＨ')).toBe('bosch');
  });

  it('finds an exact normalized business-name match', () => {
    const match = findLikelyDuplicate(
      [{ id: 'brand-1', name: 'Bosch Automotive', code: 'BOSCH_AUTOMOTIVE' }],
      'bosch-automotive',
      'BOSCH_AUTOMOTIVE_NEW',
    );

    expect(match).toMatchObject({
      reason: 'name',
      record: { id: 'brand-1' },
    });
  });

  it('supports label-based and code-only canonical records', () => {
    expect(
      findLikelyDuplicate(
        [{ id: 'value-1', label: 'Ventilated', code: 'VENTILATED' }],
        'ventilated',
      ),
    ).toMatchObject({
      reason: 'name',
      record: { id: 'value-1' },
    });

    expect(
      findLikelyDuplicate(
        [{ id: 'config-1', code: 'TOYOTA_COROLLA_E140_GLI_2ZR_AT' }],
        '',
        'toyota-corolla-e140-gli-2zr-at',
      ),
    ).toMatchObject({
      reason: 'code',
      record: { id: 'config-1' },
    });
  });

  it('excludes the record currently being edited', () => {
    expect(
      findLikelyDuplicate(
        [{ id: 'self', name: 'Corolla', code: 'COROLLA' }],
        'Corolla',
        'COROLLA',
        'self',
      ),
    ).toBeNull();
  });
});
