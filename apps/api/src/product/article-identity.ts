import { PartNumberType } from '@prisma/client';

export function canonicalPartNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/gu, ' ');
}

export function normalizePartNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, '');
}

export function articleIdentityKey(
  type: PartNumberType,
  issuerBrandId: string | null,
  normalizedPartNumber: string,
): string | null {
  if (
    type !== PartNumberType.MANUFACTURER ||
    !issuerBrandId ||
    !normalizedPartNumber
  ) {
    return null;
  }
  return `${issuerBrandId}:${normalizedPartNumber}`;
}
