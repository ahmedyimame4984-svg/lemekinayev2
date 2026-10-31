import { ArticleIdentifierType } from '@prisma/client';
import {
  canonicalPartNumber,
  normalizePartNumber,
} from './article-identity.js';

const gtinLengths: Record<ArticleIdentifierType, number | null> = {
  [ArticleIdentifierType.GTIN_8]: 8,
  [ArticleIdentifierType.GTIN_12]: 12,
  [ArticleIdentifierType.GTIN_13]: 13,
  [ArticleIdentifierType.GTIN_14]: 14,
  [ArticleIdentifierType.TRADE_NUMBER]: null,
};

export function canonicalArticleIdentifierValue(
  type: ArticleIdentifierType,
  value: string,
): string {
  if (type === ArticleIdentifierType.TRADE_NUMBER) {
    return canonicalPartNumber(value);
  }
  return value.trim().replace(/[\s-]+/gu, '');
}

export function normalizeArticleIdentifierValue(
  type: ArticleIdentifierType,
  value: string,
): string {
  if (type === ArticleIdentifierType.TRADE_NUMBER) {
    return normalizePartNumber(value);
  }
  return value.trim().replace(/[\s-]+/gu, '');
}

export function expectedGtinLength(
  type: ArticleIdentifierType,
): number | null {
  return gtinLengths[type];
}

export function isGtinType(type: ArticleIdentifierType): boolean {
  return type !== ArticleIdentifierType.TRADE_NUMBER;
}

export function hasValidGtinCheckDigit(value: string): boolean {
  if (!/^\d+$/u.test(value) || value.length < 2) return false;

  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index--, position++) {
    const digit = digits[index]!;
    sum += digit * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function articleIdentifierGlobalKey(
  type: ArticleIdentifierType,
  normalizedValue: string,
): string | null {
  return isGtinType(type) ? `GTIN:${normalizedValue}` : null;
}

export function normalizeArticleIdentifierLookup(value: string): string {
  return normalizePartNumber(value);
}
