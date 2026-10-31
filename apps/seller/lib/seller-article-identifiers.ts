/** Pre-Draft numbers are persisted after the canonical Article has an ID. */
export type GtinType = 'GTIN_8' | 'GTIN_12' | 'GTIN_13' | 'GTIN_14';
export type PendingIdentifierKey = 'gtin' | 'oeReference' | 'crossReference';

export interface PendingArticleIdentifiers {
  gtinType: GtinType;
  gtin: string;
  oeReference: string;
  crossReference: string;
  issuerBrandId: string;
}

export interface ArticleIdentifierRequirement {
  oeReferenceRequirement: string;
  crossReferenceRequirement: string;
}

export interface PendingArticleIdentifierRequest {
  key: PendingIdentifierKey;
  path: 'direct-identifiers' | 'identifiers';
  body: { type: string; value?: string; partNumber?: string; issuerBrandId?: string };
}

export const emptyPendingArticleIdentifiers: PendingArticleIdentifiers = {
  gtinType: 'GTIN_13', gtin: '', oeReference: '', crossReference: '', issuerBrandId: '',
};

export function pendingArticleIdentifierRequests(
  pending: PendingArticleIdentifiers,
  productType: ArticleIdentifierRequirement,
  gtinAllowed: boolean,
): PendingArticleIdentifierRequest[] {
  const requests: PendingArticleIdentifierRequest[] = [];
  if (gtinAllowed && pending.gtin.trim()) {
    requests.push({ key: 'gtin', path: 'direct-identifiers', body: {
      type: pending.gtinType, value: normalizeGtin(pending.gtin),
    } });
  }
  if (productType.oeReferenceRequirement !== 'NOT_APPLICABLE' && pending.oeReference.trim()) {
    requests.push({ key: 'oeReference', path: 'identifiers', body: {
      type: 'OE', partNumber: pending.oeReference.trim(),
      ...(pending.issuerBrandId ? { issuerBrandId: pending.issuerBrandId } : {}),
    } });
  }
  if (productType.crossReferenceRequirement !== 'NOT_APPLICABLE' && pending.crossReference.trim()) {
    requests.push({ key: 'crossReference', path: 'identifiers', body: {
      type: 'CROSS_REFERENCE', partNumber: pending.crossReference.trim(),
      ...(pending.issuerBrandId ? { issuerBrandId: pending.issuerBrandId } : {}),
    } });
  }
  return requests;
}

const GTIN_LENGTHS: Record<GtinType, number> = {
  GTIN_8: 8,
  GTIN_12: 12,
  GTIN_13: 13,
  GTIN_14: 14,
};

/** Match the API's canonical GTIN normalization; never convert to a number. */
export function normalizeGtin(value: string): string {
  return value.trim().replace(/[\s-]+/gu, '');
}

/** Client-side GTIN check digit validation. The API remains authoritative. */
export function gtinValidationError(value: string, type: GtinType): string | null {
  const normalized = normalizeGtin(value);
  if (!normalized) return null;

  const expectedLength = GTIN_LENGTHS[type];
  if (!/^\d+$/u.test(normalized)) {
    return `GTIN-${expectedLength} must contain only digits (spaces and hyphens are allowed).`;
  }
  if (normalized.length !== expectedLength) {
    return `GTIN-${expectedLength} must contain exactly ${expectedLength} digits.`;
  }

  const digits = [...normalized].map(Number);
  const checkDigit = digits.pop();
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index--, position++) {
    sum += digits[index]! * (position % 2 === 0 ? 3 : 1);
  }
  if ((10 - (sum % 10)) % 10 !== checkDigit) {
    return `GTIN-${expectedLength} has an invalid check digit. Check the final digit.`;
  }
  return null;
}

/** Check user-entered identifiers before the API repeats validation and duplicate checks. */
export function pendingIdentifierError(
  pending: PendingArticleIdentifiers,
  productType: ArticleIdentifierRequirement,
  gtinAllowed: boolean,
): string | null {
  if (gtinAllowed && pending.gtin.trim()) {
    const error = gtinValidationError(pending.gtin, pending.gtinType);
    if (error) return error;
  }
  if (productType.oeReferenceRequirement !== 'NOT_APPLICABLE' &&
      pending.oeReference.trim().length > 160) {
    return 'OE reference must not exceed 160 characters.';
  }
  if (productType.crossReferenceRequirement !== 'NOT_APPLICABLE' &&
      pending.crossReference.trim().length > 160) {
    return 'Cross reference must not exceed 160 characters.';
  }
  if (productType.oeReferenceRequirement !== 'NOT_APPLICABLE' &&
      pending.oeReference.trim() && !pending.issuerBrandId) {
    return 'Select the issuing Brand for this OE reference.';
  }
  return null;
}

export function clearSavedIdentifier(
  pending: PendingArticleIdentifiers,
  key: PendingIdentifierKey,
  savedValue: string,
): PendingArticleIdentifiers {
  // Do not erase a number the Seller has already changed while a request was in flight.
  const currentValue = pending[key];
  const unchanged = key === 'gtin'
    ? normalizeGtin(currentValue) === normalizeGtin(savedValue)
    : currentValue.trim() === savedValue.trim();
  return unchanged ? { ...pending, [key]: '' } : pending;
}
