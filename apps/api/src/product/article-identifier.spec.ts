import { ArticleIdentifierType } from '@prisma/client';
import {
  articleIdentifierGlobalKey,
  canonicalArticleIdentifierValue,
  hasValidGtinCheckDigit,
  normalizeArticleIdentifierValue,
} from './article-identifier.js';

describe('Article identifier normalization', () => {
  it('normalizes and validates a GTIN-13 without losing its check digit', () => {
    expect(
      normalizeArticleIdentifierValue(
        ArticleIdentifierType.GTIN_13,
        '4006 3813-33931',
      ),
    ).toBe('4006381333931');
    expect(hasValidGtinCheckDigit('4006381333931')).toBe(true);
    expect(
      articleIdentifierGlobalKey(
        ArticleIdentifierType.GTIN_13,
        '4006381333931',
      ),
    ).toBe('GTIN:4006381333931');
  });

  it('rejects a bad GTIN check digit at the checksum helper', () => {
    expect(hasValidGtinCheckDigit('4006381333932')).toBe(false);
  });

  it('keeps trade-number display punctuation separate from search normalization', () => {
    expect(
      canonicalArticleIdentifierValue(
        ArticleIdentifierType.TRADE_NUMBER,
        ' bp-494 / 123 ',
      ),
    ).toBe('BP-494 / 123');
    expect(
      normalizeArticleIdentifierValue(
        ArticleIdentifierType.TRADE_NUMBER,
        ' bp-494 / 123 ',
      ),
    ).toBe('BP494123');
    expect(
      articleIdentifierGlobalKey(
        ArticleIdentifierType.TRADE_NUMBER,
        'BP494123',
      ),
    ).toBeNull();
  });
});
