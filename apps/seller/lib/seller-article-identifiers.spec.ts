import { describe, expect, it } from 'vitest';
import {
  clearSavedIdentifier, emptyPendingArticleIdentifiers,
  pendingArticleIdentifierRequests, pendingIdentifierError,
  gtinValidationError, normalizeGtin,
} from './seller-article-identifiers';

const type = { oeReferenceRequirement: 'OPTIONAL', crossReferenceRequirement: 'REQUIRED' };

describe('pre-Draft Article numbers', () => {
  it('queues GTIN, OE and cross-reference against the new canonical Article', () => {
    expect(pendingArticleIdentifierRequests({
      gtinType: 'GTIN_13', gtin: ' 1234567890123 ',
      oeReference: ' 123-AB ', crossReference: 'ALT-123',
      issuerBrandId: 'issuer',
    }, type, true)).toEqual([
      { key: 'gtin', path: 'direct-identifiers', body: { type: 'GTIN_13', value: '1234567890123' } },
      { key: 'oeReference', path: 'identifiers', body: {
        type: 'OE', partNumber: '123-AB', issuerBrandId: 'issuer',
      } },
      { key: 'crossReference', path: 'identifiers', body: {
        type: 'CROSS_REFERENCE', partNumber: 'ALT-123', issuerBrandId: 'issuer',
      } },
    ]);
  });

  it('checks GTIN length and reference limits without dropping leading zeros', () => {
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtin: '0012345678905',
    }, type, true)).toBeNull();
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtin: '00123',
    }, type, true)).toMatch(/13 digits/);
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtin: 'ABCDEFGHIJKLM',
    }, type, true)).toMatch(/13 digits/);
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, oeReference: 'x'.repeat(161),
    }, type, true)).toMatch(/160 characters/);
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtin: 'bad',
    }, type, false)).toBeNull();
  });

  it('requires the issuing Brand when an OE reference is supplied', () => {
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, oeReference: 'OE-123',
    }, type, true)).toMatch(/issuing Brand/);
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, oeReference: 'OE-123', issuerBrandId: 'issuer',
    }, type, true)).toBeNull();
  });

  it('keeps unused or unsupported identifiers out of the request queue', () => {
    expect(pendingArticleIdentifierRequests({
      ...emptyPendingArticleIdentifiers,
      gtin: '1234567890123', oeReference: 'OE-1', crossReference: 'X-1',
    }, { oeReferenceRequirement: 'NOT_APPLICABLE', crossReferenceRequirement: 'NOT_APPLICABLE' }, false))
      .toEqual([]);
  });

  it('clears only a successfully saved number and preserves edits for retry', () => {
    const pending = { ...emptyPendingArticleIdentifiers, oeReference: 'OE-1', crossReference: 'X-1' };
    expect(clearSavedIdentifier(pending, 'oeReference', 'OE-1')).toEqual({
      ...pending, oeReference: '',
    });
    expect(clearSavedIdentifier(pending, 'oeReference', 'different')).toEqual(pending);
    expect(clearSavedIdentifier(pending, 'crossReference', 'X-1').oeReference).toBe('OE-1');
  });
});

describe('GTIN frontend validation matches the API checksum', () => {
  const valid = [
    ['GTIN_8', '96385074'],
    ['GTIN_12', '036000291452'],
    ['GTIN_13', '4006381333931'],
    ['GTIN_14', '10614141000415'],
  ] as const;

  it.each(valid)('accepts %s with a valid check digit', (type, digits) => {
    expect(gtinValidationError(digits, type)).toBeNull();
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtinType: type, gtin: digits,
    }, { oeReferenceRequirement: 'OPTIONAL', crossReferenceRequirement: 'OPTIONAL' }, true))
      .toBeNull();
  });

  it.each(valid)('rejects %s when only the final check digit is changed', (type, digits) => {
    const wrong = digits.slice(0, -1) + (digits.endsWith('9') ? '0' : '9');
    expect(gtinValidationError(wrong, type)).toMatch(/invalid check digit/i);
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtinType: type, gtin: wrong,
    }, { oeReferenceRequirement: 'OPTIONAL', crossReferenceRequirement: 'OPTIONAL' }, true))
      .toMatch(/invalid check digit/i);
  });

  it('checks length, non-digits and the GTIN type when a value is entered', () => {
    expect(gtinValidationError('12345', 'GTIN_13')).toMatch(/exactly 13 digits/);
    expect(gtinValidationError('40063813339a1', 'GTIN_13')).toMatch(/only digits/);
    expect(gtinValidationError('4006381333931', 'GTIN_14')).toMatch(/exactly 14 digits/);
    expect(gtinValidationError('', 'GTIN_13')).toBeNull();
  });

  it('ignores spaces and hyphens but preserves leading zeros', () => {
    expect(normalizeGtin(' 0360-0029 1452 ')).toBe('036000291452');
    expect(gtinValidationError(' 0360-0029 1452 ', 'GTIN_12')).toBeNull();
    const pending = {
      ...emptyPendingArticleIdentifiers, gtinType: 'GTIN_12' as const,
      gtin: ' 0360-0029 1452 ',
    };
    expect(pendingArticleIdentifierRequests(pending, type, true)[0]?.body.value)
      .toBe('036000291452');
    expect(clearSavedIdentifier(pending, 'gtin', '036000291452').gtin).toBe('');
    expect(clearSavedIdentifier(pending, 'gtin', 'another-value').gtin).toBe(pending.gtin);
  });

  it('does not reject a malformed GTIN when the Product Type disallows GTIN', () => {
    expect(pendingIdentifierError({
      ...emptyPendingArticleIdentifiers, gtin: '1234567890123',
    }, type, false)).toBeNull();
  });
});
